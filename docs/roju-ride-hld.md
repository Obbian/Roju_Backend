# Roju Ride — High-Level Design (HLD)

**Status:** draft, for review
**Modeled on:** Uber's own published system architecture (see `docs/system-design-research.md`
for the underlying research and algorithm-level detail — this document is the architecture
itself; that one is the working notes it's built from)
**Sized against:** the client-provided Hyderabad month-1 target — 1.15M drivers, 11.75M
rides/day (flagged as needing reconfirmation throughout; the design below holds even if the
real number is an order of magnitude smaller — it just means some components launch smaller
than sized here)

---

## 1. Purpose & scope

This document describes the end-to-end architecture for Roju Ride's backend — the rider app,
driver app, and admin web all run against the same system. It's written to mirror how Uber
structures its own architecture, component-for-component, substituting our own stack where
Uber's choice is either proprietary or not justified at our current scale.

**In scope:** ride booking, matching/dispatch, live location tracking, pricing (metered +
surge + rentals/outstation/airport), payments, wallet/settlement, driver compliance, safety,
notifications, growth (referrals/incentives), catalog, admin operations.

**Out of scope for this phase** (data-modeled already, not architected here):
Corporate Pooling / She-Share, the Roju AI (Humanoid) conversational channel — both are
separate workstreams pending the client's scope decision (Discovery Brief, Sheet 07).

---

## 2. Goals / non-goals

**Goals**
- Handle the target transaction and location-tracking load without the database or real-time
  layer becoming the bottleneck
- Real-time matching and live tracking with a bounded, predictable latency
- Correct-by-construction money handling (fares, wallet, settlements, GST invoices) — no
  double-writes, no lost updates
- A schema and service boundary that can grow from one city to many without a rewrite

**Non-goals (this phase)**
- Building an in-house maps/routing engine (we self-host OSRM instead — see §5)
- Building a custom wide-column store (Postgres + partitioning first; revisit only if proven
  necessary — see §5)
- Multi-region active-active deployment (single-region, multi-AZ is the target for now)

---

## 3. Assumptions & constraints

| # | Assumption | Status |
|---|---|---|
| 1 | Hyderabad launch target: 1.15M drivers, 11.75M rides/day, month 1 | **Unconfirmed** — flagged to client (≈29% of Uber's entire global daily volume, from one city) |
| 2 | Single region (India) deployment for the current phase | Working assumption |
| 3 | Payment gateway: Razorpay | Assumed from existing schema, not yet contracted |
| 4 | Maps/routing: self-hosted OSRM (not a paid per-call API) | Recommended, cost-driven — see §5, §7 |
| 5 | Infra budget ceiling | **Open** — not yet provided |
| 6 | Matching priority (nearest / rated / fair-rotation), cancellation grace/penalty tiers, surge cap, commission model, GST split | **Open** — see `docs/system-design-research.md §5` for the full list |

Nothing below is blocked on these being answered — the architecture is designed to hold
either way, but the exact tuning (cache sizes, node counts, cost estimates) all move with #1.

---

## 4. High-level architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                            Client layer                            │
│          Rider App          Driver App          Admin Web          │
└──────────────────────────────────┬──────────────────────────────────┘
                                    │  HTTPS / WSS
┌───────────────────────────────────▼──────────────────────────────────┐
│              Load balancer / API gateway (TLS, rate-limit)           │
└───────────┬────────────────────────────────────────┬──────────────────┘
            │                                        │
┌───────────▼────────────┐              ┌────────────▼─────────────┐
│      REST API tier       │              │     Realtime gateway      │
│  (NestJS, stateless,     │              │  (Socket.io + Redis        │
│   horizontally scaled)   │              │   pub/sub adapter)         │
└───────────┬────────────┘              └────────────┬─────────────┘
            │                                         │
            │              ┌──────────────────────────┘
            │              │
┌───────────▼──────────────▼───────────┐      ┌────────────────────────────┐
│          Matching service              │◄────►│           Redis             │
│  H3-cell candidate search, scoring,    │      │  live driver geo-cache,     │
│  offer dispatch with accept timeout    │      │  sessions, OTP, rate limits │
└───────────┬─────────────────────────────┘      └─────────────▲───────────────┘
            │                                                   │
┌───────────▼─────────────────────────┐      ┌──────────────────┴────────────────┐
│      Postgres (OLTP, primary)         │      │      Location ingestion tier       │
│  rides · users · drivers · payments ·  │      │  driver app → ingest endpoint →   │
│  wallet_ledger · compliance · catalog  │      │  message queue → 2 consumers:     │
│  (ride_route_points partitioned daily; │      │   (a) upsert Redis geo-cache      │
│   city shard key reserved, not yet cut │      │   (b) batch-write Postgres        │
│   over)                                │      └────────────────────────────────────┘
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│    Outbox → message queue             │
│    → async workers: invoicing,        │
│      settlement, badges, incentives,  │
│      notifications, referrals         │
└───────────┬─────────────────────────┘
            │
┌───────────▼─────────────────────────┐
│    Analytics sink (ClickHouse/BQ)     │
│    — reporting & fraud signals,       │
│      isolated from the live path      │
└──────────────────────────────────────┘

Third-party integrations (called from the API/worker tiers only, never in the hot path):
  Payment gateway (Razorpay) · SMS/OTP provider · Self-hosted OSRM (routing/ETA) · Push (FCM/APNs)
```

---

## 5. Component breakdown — mapped against Uber's own architecture

| Uber's component | What it does | Roju Ride's equivalent | Why matched / diverged |
|---|---|---|---|
| DISCO (dispatch, Node.js) | Matches riders↔drivers via geo-cells | **Matching Service** (NestJS module) | Same event-driven approach; NestJS gives us the same non-blocking model without a separate runtime |
| Google S2 (geospatial cells) | Map divided into cells with sharding-friendly IDs | **H3 cells** (already a column in our schema — `surge_zones_history.h3Cell`) | H3 is open, well-documented, same purpose. No reason to depend on Google's proprietary S2 |
| Supply Service + Kafka | Streams GPS pings (~1/4s/driver) through a queue | **Location Ingestion tier** — ingest endpoint → queue → 2 consumers (geo-cache + archive) | Identical pattern — this is the one piece we adopt near-verbatim, because the throughput math forces it (§9) |
| Demand Service (WebSocket) | Live push to riders | **Realtime Gateway** — Socket.io + Redis pub/sub adapter | Same mechanism; Redis adapter is our answer to Uber's multi-node fan-out |
| Schemaless / Cassandra / Riak | High-throughput, always-available storage | **Postgres**, partitioned, with a reserved `city` shard key | Deliberate divergence — see below |
| Redis | Caching, short-lived queues | **Redis** | Same role: geo-cache, sessions, OTP, rate limits |
| Kafka → Hadoop → ElasticSearch | Analytics & fraud, off the live path | **Outbox → queue → analytics sink (ClickHouse/BigQuery)** | Same separation-of-concerns; smaller-scale tooling for now |
| Own routing engine (Dijkstra + OSRM) | ETA/routing without per-ride API cost | **Self-hosted OSRM** on OpenStreetMap data | Same cost motivation, without building the routing engine itself from scratch |
| Ringpop (consistent hashing) | Auto-rebalances work across nodes | **Stateless replicas behind the load balancer + Redis coordination** | At our current scale, horizontal autoscaling + Redis gives the same practical benefit without building a custom hashing layer |
| Map grading (A/B/AB/C) | Prioritizes map-quality investment by traffic density | **City go-live checklist** — verify routing/pickup accuracy in dense zones before a city launches, highway routing verified separately for Outstation | Same principle, applied as an operational checklist rather than a software system (we don't own the map data) |
| Customer / Driver / Payment / Notification services | Domain services | **Users, Drivers (Auth ✅), Payments, Notifications modules** | Direct equivalent, already reflected in our module list |

**Where we deliberately diverge, and why it's the right call for now:**
- **Postgres over Cassandra/Schemaless** — our transactional load (~490 rides/sec peak) doesn't
  need a wide-column store; it needs correctness (foreign keys, transactions) more than
  Cassandra's write-availability trade-off. The one workload that *does* need
  Cassandra-style throughput — location pings — gets the queue buffer instead, which solves
  the same problem without giving up relational guarantees everywhere else.
- **No in-house routing engine** — self-hosted OSRM gets the cost benefit (no per-ride API
  fee) without the multi-year investment Uber made in owning the whole stack.
- **No custom Ringpop-equivalent** — reasonable at Uber's server count; premature at ours.
  Horizontal autoscaling + Redis coordination is the standard, much cheaper answer until
  proven insufficient.

---

## 6. Microservices vs. modular monolith — the actual call

Uber runs dozens of independently deployed services (Dispatch, Supply, Demand, Payment,
Driver, Customer, Notification, and more), each owned by its own team. It's tempting to copy
that shape directly. As senior dev on this: **don't, not yet** — but design for it, because
one piece of this system already needs it on day one regardless of team size.

### 6.1 Why not full microservices now

Microservices aren't a free upgrade — they trade one set of problems for another:
- A function call becomes a network call, with its own latency, timeout, and failure mode
- Data that used to be one transaction now needs a saga/outbox pattern across services
- Debugging a request means distributed tracing across N services, not one stack trace
- Every extra service is another deployment pipeline, another thing to monitor, another
  on-call surface

Uber's shape works *because* they have a large engineering org — one team per service is what
makes "many small services" actually manageable. We're building the **first module** of this
system right now (Auth). Taking on microservices' operational cost before there's a team to
carry it would slow us down, not speed us up — this is the same conclusion Sheet 11, Q16
(Discovery Brief) was steering toward.

### 6.2 What we're building instead: a modular monolith with service-shaped seams

One deployable NestJS application, but every module (`src/modules/*`) is written as if it
were already a separate service — it owns its own data access, talks to other modules only
through a defined interface (never reaches into another module's tables directly), and has no
in-memory state that would break if it suddenly ran in a different process. That's what makes
extraction later a config change, not a rewrite.

### 6.3 The one exception: Location Ingestion splits out from day one

Everything else in this system scales with *request volume*. Location ingestion scales with
*connected-driver count*, and per §9 that's ~400× the throughput of every other component
combined. Bundling it into the same deployable as the REST API means the whole app has to be
sized (and re-deployed) around the location firehose — that's the one seam worth cutting
immediately, not deferring:

| Extract now | Stays in the monolith for now |
|---|---|
| **Location Ingestion service** — ingest endpoint + queue consumers (Redis geo-cache writer, `ride_route_points` batch writer). Scales on connected-driver count. | Auth, Users, Catalog, Payments, Compliance, Growth, Admin — all request/response-shaped CRUD, same scaling profile, no reason to separate yet |

### 6.4 Extraction order, when the time comes

Not a commitment to build these as separate services now — a map of *which module hits its
scaling ceiling first*, so extraction happens in the right order instead of guessing under
pressure:

1. **Location Ingestion** — extracted from day one (§6.3), scales on connected-driver count
2. **Matching/Dispatch** — next candidate; scales on concurrent "in matching" rides and needs
   a tight latency budget the rest of the API doesn't
3. **Realtime Gateway** (WebSocket) — scales on concurrent connections, a different axis
   entirely from request rate; extract once WS node count (§9) becomes hard to manage inside
   the main deployable
4. **Async workers** (settlement, invoicing, badges, incentives, notifications) — already
   logically separate (BullMQ-based background processors, not the request path) even inside
   the monolith; a physical split later is low-risk since they're already decoupled
5. **Everything else** — stays one deployable indefinitely, or splits only if a specific
   module's load genuinely diverges from the rest (evidence-driven, not calendar-driven)

### 6.5 How the pieces talk to each other

- **Inside the monolith**: direct function calls via NestJS's dependency injection — no
  network hop, no serialization cost
- **Monolith ↔ Location Ingestion / future extracted services**: async, via the message
  queue, for anything that tolerates a few seconds of lag (location archival, notifications,
  settlement, analytics); synchronous only where latency genuinely requires it (Matching
  reading the Redis geo-cache directly, never over HTTP through another service)
- **Data ownership**: one shared Postgres for now, not database-per-service — but each module
  only writes to the tables it owns, and reads across module boundaries go through that
  module's service layer, never a raw cross-module query. That's what makes a later physical
  split (its own database, its own deployable) mechanical instead of a schema migration
  nightmare.

---

## 7. Core data flows

### 6.1 Ride booking & matching

1. Rider submits a ride request (pickup, drop, category) → **REST API tier** validates and
   writes `rides` row, `status = REQUESTED`.
2. Request handed to **Matching Service**: resolve pickup's H3 cell → query Redis geo-cache
   for online, compliance-verified drivers of the requested category in that cell + a
   neighboring ring.
3. Score candidates (distance / rating / acceptance-rate — weighting pending client input),
   offer to the top candidate via the **Realtime Gateway** with an accept timeout.
4. On accept: `rides.status = ACCEPTED`, `driverId`/`acceptedAt` set; `offersAcceptedCount`
   incremented for the accepting driver, `offersReceivedCount` for every driver offered.
5. On timeout/reject: offer the next candidate; if the search radius/time is exhausted,
   surface "No Ride Found" to the rider (`rides.status` stays `REQUESTED`, no `CANCELLED`).

### 6.2 Live location tracking

1. Driver app sends a GPS ping (~every 4s) to the **Location Ingestion tier**.
2. Ping is pushed onto the **message queue** immediately — never written directly to Postgres.
3. **Consumer A** upserts the driver's latest position into the Redis geo-cache (short TTL) —
   this is the only thing Matching and live-map rendering ever read.
4. **Consumer B** batches pings and bulk-writes them into the current day's
   `ride_route_points` partition, for trip replay / audit — this path can lag by seconds
   without affecting anything user-facing.

### 6.3 Ride completion → fare → invoice → settlement

1. Ride marked `COMPLETED` → fare computed per the formula in
   `docs/system-design-research.md §4.2` → `ride_fare_breakdown` row written once, immutably.
2. An **outbox event** (`ride.completed`) is written in the same transaction as the status
   change, then relayed to the queue.
3. Downstream consumers, independently: generate the B2C GST invoice, generate the B2B
   driver-settlement line item, update `driver_incentives` progress, and notify both parties.
4. Nightly **settlement batch worker** aggregates each driver's completed rides for the
   period into one `settlements` row → `wallet_ledger` `SETTLEMENT_DEBIT` entry → payout
   attempted → `PAID` or `FAILED` (+ `SETTLEMENT_REVERSAL` re-credit on failure).

### 6.4 Driver going online

1. Driver toggles online → API checks `drivers.isComplianceVerified`; blocked if any
   mandatory `driver_documents` row isn't `VERIFIED` or is `EXPIRED`.
2. On success: `drivers.status = ONLINE`, `onlineSince` set, driver begins appearing in the
   Redis geo-cache once their first location ping arrives.

---

## 8. Project & database structure

What §6's "modular monolith with service-shaped seams" actually looks like on disk today —
this is the real, current layout, not a proposal.

### 8.1 Source layout

```
src/
  main.ts                  bootstrap: helmet, compression, global ValidationPipe, /api/v1 prefix
  app.module.ts             root module — wires ConfigModule, DbModule, RedisModule, feature modules

  config/
    configuration.ts        structured config object (database.url, auth.*, otp.*, razorpay.*, ...)
    env.validation.ts       zod schema — fails fast on a missing/malformed env var

  db/
    client.ts               `Database` type + schema re-export, shared by every module
    db.module.ts             @Global — provides the Drizzle instance under the DRIZZLE token
    migrate.ts               standalone migration runner (npm run db:migrate)
    schema/                  see 8.2
    migrations/              drizzle-kit generated SQL, one file per migration + meta/ snapshots

  redis/
    redis.module.ts          @Global — provides the ioredis client under the REDIS token

  modules/
    health/                  liveness check (round-trips a real DB query)
    users/                   users.service.ts — findByPhone/findById/createByPhone/toPublicUser
    auth/
      auth.module.ts
      auth.controller.ts     POST otp/request, otp/verify, refresh, logout
      auth.service.ts        orchestrates OTP + Users + TokenService, enforces role/app-channel match
      otp.service.ts         Redis-backed OTP issue/verify (cooldown, attempt cap)
      token.service.ts       JWT access tokens + rotating opaque refresh tokens
      dto/                   RequestOtpDto, VerifyOtpDto, RefreshTokenDto, RegisteredVia enum
      guards/                JwtAuthGuard, RolesGuard
      decorators/             @Roles(), @CurrentUser()
      types/                  JwtPayload, UserRole (derived from the DB enum, not hand-duplicated)

    catalog/                 GET services, GET services/:code/categories, GET version
                              (services/ride_categories/ride_category_cities, city-filtered)

    location/                Location Ingestion — the Uber "Supply Service" equivalent
      location.module.ts     registers the location-archive BullMQ queue
      location.controller.ts POST ping (DRIVER-only)
      location.service.ts     LocationIngestService — hot path: Redis geo-cache upsert;
                              cold path: enqueues the raw point for archival
      location-geo-cache.service.ts   GEOADD/GEOSEARCH/ZREM, keyed by drivers.vehicleType
      location-archive.processor.ts   BullMQ worker — batches pings into ride_route_points

    drivers/                 PATCH status (ONLINE/OFFLINE), gated on isComplianceVerified,
                              removes the driver from the geo-cache on going OFFLINE

    (not yet built — same shape as auth/: module + controller + service + dto/ + own tables only)
    rides/  matching/  pricing/  payments/  compliance/  safety/  growth/  admin/
    notifications/  realtime-gateway/
```

Every module follows the same shape as `auth/` above: a `.module.ts` wiring it together, a
`.controller.ts` for HTTP surface, one or more `.service.ts` for logic, `dto/` for
request/response validation, and — per §6.5 — **a module only touches the tables it owns**;
anything it needs from another domain goes through that module's exported service, never a
direct query against another module's table.

### 8.2 Database schema structure

The Drizzle schema (`src/db/schema/`) is split by domain, not by table count, and the split
mirrors the module boundaries above on purpose — a schema file and the module that owns it
move together:

| Schema file | Owns | Primarily read/written by |
|---|---|---|
| `enums.ts` | Every Postgres enum (shared, no owner) | — |
| `core.ts` | catalog (`services`/`ride_categories`), `users`, `drivers`, `rides`, `payments`, `fare_configs`, `rental_packages`, `outbox_events`, `safety_events` | Auth/Users (built), Catalog/Rides/Matching/Payments/Safety (planned) |
| `finance.ts` | `wallet_ledger`, `settlements`, `ride_fare_breakdown`, `invoices`, `invoice_sequences` | Payments/Settlement worker |
| `compliance.ts` | `driver_documents`, `driver_vehicles` | Compliance module |
| `trips.ts` | `ride_stops`, `ride_route_points`, `ride_reviews` | Rides, Location Ingestion |
| `ops.ts` | `incidents`, `cancellation_penalties`, `processed_webhooks`, `admin_audit_log`, `incident_areas` | Safety/Admin |
| `engagement.ts` | `user_devices`, `notifications` | Notification worker |
| `growth.ts` | `referral_codes`, `referral_redemptions`, `driver_incentives` | Growth module |
| `geo.ts` | `areas`, `surge_zones_history` | Matching/Pricing |
| `shared-rides.ts` | `ride_pools`, `ride_pool_members`, `groups`, `group_members`, `ride_category_faqs` | Pooling (phase 3, §13) |

`schema/index.ts` re-exports all nine files as one module so Drizzle sees a single schema
graph — the split is a source-organization/ownership device, not a runtime boundary; it
doesn't imply nine databases.

### 8.3 Conventions actually in force

- **Money** is always integer paise (`amountPaise`, `totalPaise`, ...) on every table that
  moves money; the few decimal-rupee columns still around (`rides.estimatedFare`,
  `fare_configs.baseFare`) are the legacy layer being phased toward paise, not the pattern to
  copy in new tables.
- **Ledgers are append-only.** `wallet_ledger` is never UPDATEd — `drivers.walletBalancePaise`
  is a cache of its tail, recomputed, never treated as the source of truth.
- **Soft vs. real foreign keys.** A `varchar` category-code column (`rideType`, `vehicleType`
  on `fare_configs`/`rental_packages`/`ride_pools`) is a deliberate soft reference to
  `ride_categories.code` — new ride categories are a data insert, not a migration. A `uuid`
  column pointing at another table's primary key (`rides.riderId → users.id`) is always a
  real, DB-enforced `.references()`.
- **Index naming**: `IDX_<table>_<purpose>` for regular/partial indexes, `UQ_<table>_<purpose>`
  for unique constraints — grep-able, and the partial-index `WHERE` clause is always the tell
  for "this index only covers the hot subset" (e.g. `IDX_rides_driver_active` only covers
  in-progress rides, not the full history).
- **High-write tables get partitioned, not indexed harder.** `ride_route_points` and
  `surge_zones_history` intentionally have no single-column primary key — see the `TODO`
  markers in the generated migration for the daily/monthly `PARTITION BY RANGE` conversion
  still pending — the write volume driving this is quantified in §9.
- **Migrations are generated, never hand-written.** `npm run db:generate` diffs the current
  `schema/` against the last snapshot in `db/migrations/meta/`; the only hand-edits so far were
  the two Drizzle can't express natively — `areas.boundary` as a real PostGIS
  `geography(Polygon,4326)` instead of the placeholder `text`, and the partitioning `TODO`s
  above.

---

## 9. Capacity planning

Derived from the client's stated target (§3, assumption #1):

| Metric | Value |
|---|---|
| Rides/day | 11.75M |
| Rides/sec, average | ~136 |
| Rides/sec, peak hour | ~490 |
| Drivers (online at peak, ~65% of 1.15M) | ~750,000 |
| Location pings/sec at peak (1 ping/4s/online driver) | **~180,000–200,000** |
| Total records/day (ride + 2 invoice types per ride) | ~35M (~406/sec average) |

**Read from this table:** location-ping throughput is ~400× the ride-transaction throughput.
Every capacity decision in this document is driven by that one number, not by ride volume
itself — matching exactly what Uber's own writeup emphasizes about their Supply Service.

**Sizing implications:**
- Location ingestion queue: sized for ~200K msgs/sec sustained — this is the component that
  determines whether we need Kafka proper or a lighter alternative can hold (open item, §3 #6)
- Redis geo-cache: ~1.15M keys, updated every ~4s — moderate memory footprint, but very high
  write QPS; needs its own cluster, not shared with session/OTP Redis usage
- Realtime Gateway: ~750K concurrent driver connections at peak → **10–20+ WebSocket nodes**
  at a realistic 50–100K connections/node
- Postgres: ~490 tx/sec peak on OLTP tables is comfortably within a single well-tuned primary
  + read replicas; the `ride_route_points` partition is the only table under real write
  pressure, and it's already decoupled via the queue
- Routing/ETA: at 11.75M rides/day, a paid per-call maps API (e.g. Google Directions) would
  run an estimated **$60K–120K/day** — this is the single largest cost line item in the
  entire system if not addressed, which is why self-hosted OSRM (§5) is treated as
  close to mandatory rather than optional at this scale

---

## 10. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| API framework | NestJS (TypeScript) | Already in place; module structure maps 1:1 to domain boundaries |
| ORM / schema | Drizzle ORM | Already in place — full schema exists in `src/db/schema/` |
| Primary database | PostgreSQL + PostGIS | Partitioned tables for `ride_route_points`/`surge_zones_history`; `city` reserved as a future shard key |
| Cache / geo-cache | Redis (dedicated cluster for geo-cache, separate from general cache/session use) | |
| Location-ping queue | Kafka (or a managed equivalent) — **final choice open**, pending budget | BullMQ/Redis stays for the much lower-volume outbox relay (settlements, notifications) |
| Real-time | Socket.io + Redis pub/sub adapter | |
| Routing / ETA | Self-hosted OSRM on OpenStreetMap data | |
| Payments | Razorpay (assumed) | Webhook-driven, deduped via `processed_webhooks` |
| Object storage | S3-compatible (driver documents, incident attachments) | Vendor open |
| Analytics sink | ClickHouse or BigQuery | Fed via the outbox/queue, isolated from OLTP |
| Observability | Centralized logs + metrics minimum; distributed tracing if team/budget allows | Open, §3 |

---

## 11. Non-functional requirements

| Requirement | Approach |
|---|---|
| Strong consistency | Payments, `wallet_ledger`, ride state transitions — all inside Postgres transactions, idempotency keys on every ledger write |
| Eventual consistency (acceptable) | Notifications, badge recomputation, analytics, incentive progress — all async via the outbox/queue |
| Latency | Matching reads only the Redis geo-cache, never Postgres, for "nearby drivers" — keeps the search sub-100ms regardless of ride volume |
| Availability | Multi-AZ Postgres with automatic failover; stateless API/matching/gateway tiers scale horizontally behind the load balancer |
| Security | TLS everywhere, rate-limited OTP/booking endpoints (already built into `OtpService`), signed/short-lived object-storage URLs for driver documents |

---

## 12. Reliability & failure handling

- **Queue durability**: location pings and outbox events are queued before being acknowledged
  to the client — a consumer crash doesn't lose data, it just delays processing.
- **Database failover**: multi-AZ primary with automatic promotion; in-flight ride state is
  reconstructable from the outbox log if a mid-transaction failure occurs.
- **Third-party outage (maps/payment/SMS)**: each is called from the API/worker tier with
  timeouts + retry/backoff, never inline-blocking the ride state machine — a routing-provider
  outage degrades ETA display, it doesn't block booking.
- **Explicitly not building** (this phase): Uber's driver-phone-state fallback for a full
  datacenter loss — a lot of engineering for a rare failure mode; multi-AZ failover covers
  most of the same risk far more simply.

---

## 13. Phased rollout

| Phase | Scope |
|---|---|
| **Phase 0 — MVP** | Single city, Auto + one more category, fixed metered pricing, core booking/matching/payment/safety, delivered as one modular-monolith deployable (§6.2). Location Ingestion is the one piece built as its own deployable from day one (§6.3) since it's cheap to build right the first time and expensive to bolt on under load. |
| **Phase 1 — Scale-up** | Full vehicle-category set, surge pricing, rentals/outstation/airport, incentives/referrals, self-hosted OSRM live. Matching and the Realtime Gateway extracted into their own deployables once real concurrent-driver counts justify it, per the extraction order in §6.4 — not before. |
| **Phase 2 — Multi-city** | Cut over the reserved `city` shard key if/when a single Postgres primary is measurably the bottleneck; analytics sink fully live. |
| **Phase 3 — Beyond this HLD** | Corporate Pooling / She-Share, Roju AI (Humanoid) channel — separate design effort, pending client scope decision. |

---

## 14. Risks & open questions

- **The traffic number itself** — if 11.75M rides/day for month 1 is confirmed real, every
  cost and team-size estimate in this document scales accordingly; if it's a longer-term
  target, Phase 0/1 above should be re-sized against the *actual* month-1 number instead.
- All tuning parameters (matching weights, cancellation tiers, surge cap, commission model,
  GST split, badge thresholds, final queue technology) — see
  `docs/system-design-research.md §5` for the complete list, each tied to the Discovery Brief
  sheet that raises it.
