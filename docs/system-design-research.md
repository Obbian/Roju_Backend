# System Design Research & Implementation Plan — Roju Ride

Status: **draft** — several sections depend on client answers that aren't confirmed yet
(marked `[OPEN]` below). Companion docs: the client-facing Discovery Brief and the Uber
Reference Profile (both shared as artifacts) cover the same ground for a non-technical
audience; this one is the engineering version — research, task list, and the actual
algorithms we need to write.

---

## 1. Research summary

### 1.1 Sources

- Uber's own published system-design breakdown ("System Design of Uber App — Uber System
  Architecture," GeeksforGeeks) — the only one of the three competitors with a detailed,
  citable public engineering architecture.
- Uber's Q4/FY2025 investor earnings release + SEC Form 8-K — used only for real-world scale
  numbers (trips/day, footprint), to sanity-check the traffic numbers we've been given.
- Rapido / Ola — **no equivalent public architecture write-up exists for either.** Our
  research on them is limited to market-facing numbers (fleet size, city presence) supplied by
  the client, not internal engineering design. Anything below attributed to "typical
  ride-hailing practice" rather than a named source is inference, not a sourced fact — flagging
  this so nobody mistakes it for researched Rapido/Ola architecture.

### 1.2 What Uber's architecture actually consists of

| Component | What it does | Why it's built that way |
|---|---|---|
| DISCO (dispatch) | Matches riders ↔ drivers | Node.js, event-driven — processes many concurrent ride requests without blocking |
| Geospatial cells (Google S2) | Splits the map into small cells with IDs | Matching only searches nearby cells, not the whole city; cell IDs double as a sharding key |
| Supply Service + Kafka | Ingests GPS pings (~1 every 4s per driver) | A message queue absorbs the write volume so the database is never hit by the full flood directly |
| Demand Service (WebSocket) | Pushes live updates to riders | Avoids polling; instant "driver assigned" / "driver arriving" |
| Schemaless / Cassandra / Riak | High-throughput, always-available storage | Location & trip-state writes need speed and to survive node failures more than strict relational guarantees |
| Redis | Caching + short-lived queues | Absorbs read-heavy, short-TTL data (live positions, sessions) without touching the primary store |
| Kafka → Hadoop → ElasticSearch | Analytics & fraud detection | Kept off the live path so reporting/fraud checks never slow down an actual ride |
| Own routing engine (Dijkstra + OSRM) | ETA & route calculation | Avoids per-ride cost of a third-party maps API at their volume; models real roads/traffic/turn restrictions |
| Ringpop (consistent hashing) | Rebalances work across servers | Adding/removing servers doesn't require manual repartitioning |
| Map grading (A/B/AB/C) | Prioritizes map-quality investment | ~90% of trips happen in dense urban cores (Grade A) — that's where data quality matters most; highways (Grade C) matter for long-trip routing, not pickup precision |

### 1.3 What we're adopting vs. not, and why

**Adopting (same idea, our own implementation):**
- A message-queue buffer in front of driver location writes (Kafka, or a comparable
  managed queue — final choice open, see §5)
- A Redis geo-cache (keyed by H3 cell — already a column in our schema, `surge_zones_history.h3Cell`)
  for live "nearest driver" lookups, instead of querying Postgres for that
- WebSocket + a Redis pub/sub adapter for real-time fan-out across multiple server nodes
- An async pipeline for invoices/analytics, off the live booking path
- Designing the schema/queries so a `city` shard key is ready to use later, even before we
  physically shard

**Not adopting at this stage, and why:**
- **Building our own maps/routing engine** — self-hosting **OSRM** on OpenStreetMap data gets
  us the same cost benefit (avoiding per-ride API fees) without years of investment in an
  in-house routing stack.
- **Cassandra/Schemaless-style storage** — Postgres with daily partitions + the queue buffer
  above should carry us for a good while. Swap only if partition-write throughput becomes a
  *measured* bottleneck, not preemptively.
- **The driver-phone-state disaster-recovery trick** — clever, but a lot of engineering for a
  niche failure mode. A well-configured multi-AZ Postgres with automatic failover covers most
  of the same risk far more simply.

---

## 2. The client's numbers, and how we're planning to handle them

Stated target — Hyderabad, month 1:

| | Autos | Two-wheelers | Cabs | Total |
|---|---|---|---|---|
| Drivers | 100,000 | 1,000,000 | 50,000 | **1,150,000** |
| Rides/day | 1,500,000 | 10,000,000 | 250,000 | **11,750,000** |

**Reality check (unresolved, see §5):** this is ~29% of Uber's entire *global* daily trip
volume (~40M/day, Q4 2025, 70+ countries) — from one city, in month one. Needs client
reconfirmation before we lock spend/infra decisions to it.

**Derived load, if the number holds:**
- ~136 rides/sec average, ~490/sec at a busy-hour peak
- ~180,000–200,000 location-ping writes/sec at peak (the dominant load — ~400× the ride-transaction rate)
- ~35M total records/day (ride + B2C invoice + B2B settlement invoice per completed ride — matches our existing `rides` / `invoices` / `wallet_ledger` split)

**How each part of the system is designed to absorb it:**

1. **Location ingestion** — driver app → ingest endpoint → queue → two consumers: (a) upsert
   latest position into Redis by H3 cell, (b) batch-insert into the partitioned
   `ride_route_points` table. Never a direct per-ping write to Postgres.
2. **Matching** — reads only from the Redis geo-cache, never PostGIS, for "who's nearby."
   PostGIS stays for static geofencing (`areas`) only.
3. **Real-time layer** — multiple WebSocket nodes + Redis pub/sub adapter; back-of-envelope
   ~10–20+ nodes at 50–100K connections/node for 1.15M potential concurrent drivers.
4. **Database** — single Postgres primary + read replicas is fine for the ~490 rides/sec
   transactional load; the `city` shard key gets reserved in the schema/query layer now so a
   physical split is a config change later, not a rewrite.
5. **Invoicing/analytics** — ride completion → outbox event → queue → one consumer generates
   invoices, a separate consumer streams into an analytics store, so reporting never competes
   with live booking traffic.
6. **Routing/ETA cost** — Google Maps Directions API per ride at this volume estimates to
   **~$60K–120K/day** (~$1.8M–3.6M/month). Self-hosted OSRM is close to mandatory on cost
   grounds alone if this scale is real.

---

## 3. What we have to build (module checklist)

Status as of this doc: **only Auth is built.**

**Rider app:** Auth ✅ · Catalog/Home · Locations (saved/recent) · Book a ride (+ price
bidding if confirmed in scope) · Matching · Live ride tracking · Cancellation · Payment ·
Rating · Safety toolkit · Notifications · Promos & referrals · Rentals/Outstation/Airport

**Driver app:** Auth ✅ · Onboarding/compliance (documents, vehicle) · Online/offline · Ride
offers · Live ride · Earnings/wallet · Incentives · Ratings & badges · Cancellation

**Admin (web):** Catalog management · Document review queue · Incident triage · Penalty
waivers/refunds · Settlement oversight & DLQ retry · Promo/referral campaign management ·
Surge/area management · Audit log review

**Platform engine (shared):** Matching/dispatch · Pricing (metered + surge + rentals +
outstation + airport) · Payment gateway + webhooks · Notification delivery · Outbox event
relay · Real-time location tracking · GST invoicing · Wallet ledger & nightly settlement

Suggested build order: **Catalog → Ride lifecycle/Matching → Pricing → Payments/Wallet →
Safety/Compliance → Growth/Pooling**, since each roughly depends on the one before it.

---

## 4. Algorithms we need to write

### 4.1 Matching / dispatch

```
input: ride request (pickup lat/lon, category, city)

1. resolve H3 cell for the pickup point
2. query Redis for online, compliance-verified drivers of the requested
   vehicleType in that cell + a ring of neighboring cells
   - if none found, widen the ring (bounded by a max radius / timeout) [OPEN: exact radius]
3. score each candidate:
     score = w1 * (1 / distance) + w2 * driverRating + w3 * acceptanceRate
     [OPEN: weights — pending client's nearest vs. rated vs. fair-rotation answer]
4. offer to the top-scored driver with an accept timeout (e.g. 15s)
   - on timeout/reject -> offer next candidate
   - candidates exhausted within max search time -> ride.status = REQUESTED stays,
     surface "No Ride Found" to rider
5. on accept: rides.status = ACCEPTED, set driverId/acceptedAt;
   increment drivers.offersAcceptedCount (and offersReceivedCount for every driver offered)
```

### 4.2 Fare calculation

```
fare = baseFare
     + perKmRate * distanceKm
     + perMinuteRate * durationMin
     + (nightSurchargeFare if within [nightStartHour, nightEndHour])
     + perExtraStopFare * stopCount
     + perWaitingMinuteFare * max(0, waitingMinutes - freeWaitingMinutes)

fare = max(fare, minimumFare)
fare = fare * surgeMultiplier          # tollPaise / airportSurchargePaise added AFTER surge — not surgeable
fare = fare - promoDiscount

commissionPaise   = fare * commissionRate     # currently one global rate; per-category fare_configs.commissionRate not yet wired in
driverEarningPaise = fare - commissionPaise
gstPaise           = fare * gstRatePercent / 100
  -> split CGST+SGST if buyer/seller same state, else IGST   [OPEN: single vs. per-state GSTIN, Sheet 05]
```

### 4.3 Surge computation (per H3 cell, per tick — e.g. every 1–2 min)

```
demandCount = open ride requests in this cell during the current window
supplyCount = online available drivers in this cell
ratio       = demandCount / max(supplyCount, 1)
surgeMultiplier = clamp(curve(ratio), 1.0, cityMaxSurgeCap)   # curve: tuned step/logistic, not linear
write to surge_zones_history; publish the new multiplier for the cell
```

### 4.4 Cancellation penalty escalation

```
offenceIndex = count of non-waived cancellations by this user in the rolling window + 1
penaltyPaise = tieredTable[min(offenceIndex, maxTier)]        [OPEN: tier amounts, Sheet 02 Q6]
no penalty if minutesSinceRequest < graceMinutes              [OPEN: grace period length]
```

### 4.5 Settlement / payout batch (nightly, per driver per period)

```
grossPaise      = sum(rideFareBreakdown.totalPaise)        over COMPLETED rides in period
commissionPaise = sum(rideFareBreakdown.commissionPaise)   over same rides
incentivePaise  = sum(achieved, unpaid incentive bonuses in period)
penaltyPaise    = sum(non-waived cancellation penalties in period)

netPayoutPaise  = grossPaise - commissionPaise + incentivePaise - penaltyPaise
                = sum(driverEarningPaise) + incentivePaise - penaltyPaise

settlements row: PENDING -> LEDGERED (writes SETTLEMENT_DEBIT to wallet_ledger)
              -> bank transfer attempted
              -> PAID  (on success)
              -> FAILED + SETTLEMENT_REVERSAL ledger entry (re-credit) on failure
```

### 4.6 Driver badge computation (nightly sweep)

```
isNeverCancelBadge = zero non-waived DRIVER-role cancellation_penalties, lifetime
isTopDriverBadge   = rating >= 4.8 AND completionRate >= 98% AND totalRides >= 100
                     [OPEN: thresholds pending client confirmation — currently draft values]
```

### 4.7 Incentive progress

```
on each ride completion:
  increment matching ACTIVE driver_incentives.completedRides / achievedEarningsPaise
  target reached -> status = ACHIEVED
payout job: write exactly one INCENTIVE_CREDIT ledger entry, set ledgerEntryId, status = PAID
  (idempotent via the unique (driverId, incentiveType, periodStart) constraint)
```

### 4.8 Referral qualification

```
on each ride completion by refereeUserId:
  increment referral_redemptions.qualifyingRidesCompleted
  reaches referral_codes.qualifyingRides -> status = QUALIFIED, qualifiedAt, qualifyingRideId set
payout job: credit both referrer + referee rewards -> status = REWARDED
```

### 4.9 Invoice numbering (gap-free)

```
SELECT ... FOR UPDATE on invoice_sequences(financialYear, series)
lastNumber += 1
invoiceNumber = `{series}/{financialYear}/{lastNumber, zero-padded}`
invoice: DRAFT -> ISSUED
```

### 4.10 Location-ping ingestion (infra-level)

```
driver app -> ingest endpoint -> queue (Kafka topic or Redis Stream) [OPEN: final broker choice]
  consumer A: upsert Redis GEO/H3 key (latest position, short TTL)   -> feeds matching
  consumer B: batch N pings / T seconds -> bulk insert into ride_route_points (current-day partition)
```

### 4.11 Fraud/abuse heuristics (post-MVP, not blocking launch)

- Rate-limit OTP requests / booking attempts per user, device, IP (OTP cooldown already built)
- Flag GPS-jump anomalies (implausible `speedKmph` between consecutive `ride_route_points`) for review
- Flag repeated same-pair rider/driver cancellations (possible collusion) via a
  `cancellation_penalties` pattern query

---

## 5. Open items gating exact parameters

These need a client or ops-team answer before the algorithms above can be tuned precisely
(cross-referenced to the Discovery Brief sheet that raised them):

- Traffic-volume confirmation — is 11.75M rides/day really month-1, or a longer-term target? (Sheet 01/11)
- Matching priority weights — nearest vs. rated vs. fair rotation (Sheet 04, Sheet 11)
- Max search radius / timeout before "No Ride Found" (Sheet 04)
- Cancellation grace period + tier penalty amounts (Sheet 02)
- Surge curve shape and city-level cap (Sheet 05)
- Commission model — flat vs. per-city/category (Sheet 03/05)
- GST — single vs. per-state GSTIN, which categories at 5% vs. 18% (Sheet 05)
- Top Driver / Never Cancels badge thresholds — confirm or override the draft values above (Sheet 03)
- Message-queue choice for location ingestion — Kafka vs. a managed/lighter alternative (Sheet 11 / budget)
