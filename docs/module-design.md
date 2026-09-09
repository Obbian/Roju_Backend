# Module-Level Design — Roju Ride

Low-level design for the 10 modules still pending, following on from
`docs/roju-ride-hld.md` (architecture) and `docs/system-design-research.md` (algorithms).
Each section below is written to the same shape on purpose, so picking any one of them up
later doesn't require re-deriving the pattern: **purpose → owns → depends on → API → core
logic → Uber mapping** (HLD §5's component table, cross-referenced so nothing here drifts
from that document).

Build order: **Rides → Matching → Pricing → Payments → Compliance → Safety → Growth →
Notifications → Realtime Gateway → Admin.** Rides before Matching because a ride row has to
exist before anything can be dispatched; Admin last because it reaches into nearly every
other module and has the least value until they exist.

---

## 1. Rides

**Purpose:** the ride state machine — `REQUESTED → MATCHING → ACCEPTED → ARRIVED →
IN_PROGRESS → COMPLETED/CANCELLED` — and everything that hangs off a single ride.

**Owns:** `rides`, `ride_stops`, `ride_reviews`, `scheduled_rides`, `cancellation_penalties`.

**Depends on:** Catalog (validate `rideType` exists/available in city), Drivers (assigned
driver lookup), Matching (hand off dispatch after creating a `REQUESTED` row), Pricing (fare
estimate at creation, final fare at completion), Payments (kick off payment on completion).

**API**

| Method | Path | Notes |
|---|---|---|
| POST | `/rides` | Create a request — pickup/drop/category/promoCode/passenger info; persists `REQUESTED`, calls Pricing for the estimate, hands off to Matching |
| GET | `/rides/:id` | Rider or the assigned driver only |
| GET | `/rides` | Rider's own history, paginated |
| PATCH | `/rides/:id/stops` | Add/edit stops — pickup-side only, before `IN_PROGRESS` |
| POST | `/rides/:id/cancel` | Reason required; runs the cancellation-penalty algorithm |
| POST | `/rides/:id/rate` | Post-ride rating + review (rider→driver or driver→rider) |
| POST | `/rides/:id/arrive` | Driver-only, must be the assigned driver |
| POST | `/rides/:id/start` | Driver-only |
| POST | `/rides/:id/complete` | Driver-only — triggers Pricing's final-fare calc + Payments |

**Core logic:** a strict state-transition guard (reject any status change that isn't a valid
`from → to` edge in the state machine above — no skipping `ACCEPTED` straight to
`COMPLETED`); `stopCount` kept in sync with `ride_stops` rows; cancellation penalty tiers per
`system-design-research.md §4.4`.

**Uber mapping:** closest to the request-intake half of the Demand Service — trip state
itself, distinct from the matching decision (which lives in Matching, below).

---

## 2. Matching

**Purpose:** find a driver for a `REQUESTED` ride and get it to `ACCEPTED`.

**Owns:** no tables of its own — reads `drivers`, writes `rides.driverId/status/acceptedAt`,
increments `drivers.offersReceivedCount`/`offersAcceptedCount`.

**Depends on:** Location (`LocationGeoCacheService.searchNearby` — already built), Rides
(status transition), Realtime Gateway (push the offer to the driver's socket).

**API**

| Method | Path | Notes |
|---|---|---|
| — | *(internal)* | `MatchingService.dispatch(rideId)` — called by Rides right after creating a `REQUESTED` row, not exposed over HTTP |
| POST | `/matching/:rideId/accept` | Driver-only, must be the offered driver |
| POST | `/matching/:rideId/reject` | Driver-only — triggers the next-candidate offer |

**Core logic:** exactly `system-design-research.md §4.1` — resolve the pickup's geo-cache
key by `vehicleType`, expanding-radius search, score by distance/rating/acceptance-rate
(weights pending the client's Sheet 04/11 answer), offer with an accept timeout, fall
through candidates until one accepts or the search is exhausted (`NO_DRIVER_FOUND`, not a
`CANCELLED` ride).

**Uber mapping:** DISCO.

---

## 3. Pricing

**Purpose:** fare estimation at booking time, final fare + surge at completion time.

**Owns:** `fare_configs`, `rental_packages`, `ride_fare_breakdown`, `promos`.

**Depends on:** Catalog (`rideType` → category flags: rental/outstation/airport pricing
model), Geo (`surge_zones_history` for the live multiplier).

**API**

| Method | Path | Notes |
|---|---|---|
| GET | `/pricing/estimate` | `?pickup&drop&rideType&city` — used by the booking screen before confirming |
| — | *(internal)* | `PricingService.computeFinalFare(ride)` — called by Rides on completion |
| GET | `/pricing/rental-packages` | `?city&rideType` — for the Rentals booking flow |

**Core logic:** the fare formula and surge computation from `system-design-research.md
§4.2–§4.3`, unchanged from that spec — this module is where that pseudocode actually gets
implemented.

**Uber mapping:** not a single named Uber service in the source article; the calculation
underneath their dynamic-pricing feature.

---

## 4. Payments

**Purpose:** collect payment for a completed ride, issue the GST invoice.

**Owns:** `payments`, `invoices`, `invoice_sequences`, `processed_webhooks`.

**Depends on:** Rides (completion trigger), Razorpay (external).

**API**

| Method | Path | Notes |
|---|---|---|
| POST | `/payments/:rideId/initiate` | Creates a gateway order for the final fare |
| POST | `/payments/webhook/razorpay` | Gateway webhook — deduped via `processed_webhooks` before any side effect |
| GET | `/payments/:rideId/invoice` | Fetch the GST invoice PDF/details |

**Core logic:** invoice numbering per `system-design-research.md §4.9` (`FOR UPDATE` on
`invoice_sequences`, gap-free); webhook handler is insert-first into `processed_webhooks` —
conflict means already-processed, exit without reprocessing.

**Uber mapping:** Payment Service.

---

## 5. Compliance

**Purpose:** gate `drivers.isComplianceVerified` behind actual verified documents.

**Owns:** `driver_documents`, `driver_vehicles`.

**Depends on:** Drivers (flips the verified flag), object storage (S3, for signed upload/read
URLs — never a public URL, per the schema's own note on `storageKey`).

**API**

| Method | Path | Notes |
|---|---|---|
| POST | `/compliance/documents` | Upload a document — one row per (driver, type, vehicle?) |
| GET | `/compliance/documents` | List own documents + status |
| POST | `/compliance/vehicles` | Register a vehicle |
| PATCH | `/admin/compliance/documents/:id/verify` | Admin-only |
| PATCH | `/admin/compliance/documents/:id/reject` | Admin-only, requires `rejectionReason` |

**Core logic:** relies on the DB's own `UQ_driver_documents_live_slot` constraint (exactly
one live doc per slot — already enforced, nothing to duplicate in code); a nightly sweep
flips `VERIFIED → EXPIRED` past `expiresAt` and recomputes `drivers.isComplianceVerified`
whenever every mandatory document type is `VERIFIED`.

**Uber mapping:** the onboarding half of the Driver Service.

---

## 6. Safety

**Purpose:** real-time SOS intake, plus the after-the-fact incident case file.

**Owns:** `safety_events`, `incidents`.

**Depends on:** Rides (context — which ride an event/incident is tied to), Users.

**API**

| Method | Path | Notes |
|---|---|---|
| POST | `/safety/sos` | Triggers a `safety_events` row, routes to ops (Sheet 06 open item: 112 vs. internal desk first) |
| POST | `/safety/events/:id/acknowledge` | Ops-only |
| POST | `/safety/incidents` | Rider/driver files an incident report |
| GET | `/safety/incidents/:id` | Reporter, the party it's against, or admin |
| PATCH | `/admin/incidents/:id` | Triage/assign/resolve, admin-only |

**Core logic:** `safety_events` never auto-resolves (matches the schema note — someone has to
acknowledge it); `incidents` carries the full triage lifecycle
(`OPEN → TRIAGED → INVESTIGATING → RESOLVED/DISMISSED`).

**Uber mapping:** no single named Uber component in the source article — this is the backend
behind the Safety Toolkit screens (RideCheck-equivalent is a client-side feature; this module
is where its server-side signal lands).

---

## 7. Growth

**Purpose:** referral rewards, driver incentive campaigns.

**Owns:** `referral_codes`, `referral_redemptions`, `driver_incentives`.

**Depends on:** Users/Drivers, Rides (completion events drive both referral qualification and
incentive progress).

**API**

| Method | Path | Notes |
|---|---|---|
| GET | `/growth/referral-code` | The caller's own code, creating one on first request |
| POST | `/growth/referral/redeem` | New user redeems someone else's code at signup |
| GET | `/growth/incentives` | Driver's active incentive campaigns + progress |

**Core logic:** referral qualification and incentive progress exactly as in
`system-design-research.md §4.7–§4.8` — both are idempotent against their unique constraints
(`refereeUserId` unique; `(driverId, incentiveType, periodStart)` unique), so a retried event
can't double-pay.

**Uber mapping:** not named in the source article; general marketplace growth mechanics.

---

## 8. Notifications

**Purpose:** deliver push + in-app notifications, fed by every other module's events.

**Owns:** `user_devices`, `notifications`.

**Depends on:** consumes outbox events from every other module — never called synchronously
by them.

**API**

| Method | Path | Notes |
|---|---|---|
| POST | `/notifications/devices` | Register a device/push token |
| GET | `/notifications` | List mine, newest first |
| PATCH | `/notifications/:id/read` | Mark read |
| — | *(internal)* | `NotificationsService.send(userId, type, payload)` — invoked by the outbox consumer, not by other modules directly |

**Core logic:** a dead push token (repeated send failures) retires itself
(`pushFailureCount`) without touching the user record — matches the schema note on why
tokens live on `user_devices`, not `users`.

**Uber mapping:** Notification Service.

---

## 9. Realtime Gateway

**Purpose:** the WebSocket layer — live ride status, live driver location, matching offers.

**Owns:** no tables.

**Depends on:** Redis (pub/sub adapter for multi-node fan-out — HLD §9), Auth (socket
handshake authenticates the same JWT access token as the REST API).

**API** — Socket.io namespace `/realtime`, not REST:

| Event (server → client) | Emitted when |
|---|---|
| `ride:status` | Any `rides.status` transition on a ride the connected user is part of |
| `driver:location` | A matched ride's driver location updates (sourced from the Location geo-cache, not `ride_route_points`) |
| `matching:offer` | A driver receives a ride offer (replaces polling) |

**Core logic:** one Socket.io node + the Redis adapter from day one, even before real
concurrent-driver counts demand more than one node — the code path is identical at 1 node
or 20, so there's no reason to build it without the adapter and retrofit later.

**Uber mapping:** Demand Service.

---

## 10. Admin

**Purpose:** back-office operations for the ops/support/finance team.

**Owns:** no new tables — writes to `admin_audit_log` on every privileged action, and reaches
into nearly every other module's tables through their own services (never a raw
cross-module query, per HLD §6.5).

**API** (representative, not exhaustive — grows as other modules land)

| Method | Path | Notes |
|---|---|---|
| PATCH | `/admin/fare-configs/:id` | Catalog/Pricing management |
| PATCH | `/admin/compliance/documents/:id/verify` \| `/reject` | Compliance (listed there too — same endpoint, admin-guarded) |
| PATCH | `/admin/incidents/:id` | Safety triage |
| POST | `/admin/cancellation-penalties/:id/waive` | Rides |
| POST | `/admin/settlements/:id/retry` | Payments/Finance |
| GET | `/admin/audit-log` | Its own table |

**Core logic:** every mutating endpoint here writes one `admin_audit_log` row
(`actorUserId`, `action`, `targetType`/`targetId`, `reason`) in the same transaction as the
underlying change — no exceptions, since this table is the only accountability trail for
privileged actions.

**Uber mapping:** their internal ops/support tooling (not detailed in the public
architecture article — this module's shape is inferred from what the schema already
supports, not sourced from Uber's writeup).
