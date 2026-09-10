# Roju Ride

Backend for the ride-hailing app — multi-modal ride-hailing (auto/bike/scooty/cab),
rentals/outstation/airport rides, She-Share & Corporate Pooling, driver compliance and
wallet/settlement finance, and a real-time safety layer.

Part of the `Roju_Backend` workspace — see the [root README](../../README.md) for how this
app fits alongside `roju-identity` and future apps. This app has **no login of its own** —
every request carries a token issued by `roju-identity`, verified here via the shared
`JWT_ACCESS_SECRET` (see `src/identity/`).

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL + PostGIS, via Drizzle ORM
- **Cache / queues**: Redis + BullMQ (location-archive queue, matching-timeout queue)
- **Real-time**: Socket.io (live tracking, matching) — not yet built

## Getting started

Run these from the **repo root**, not this directory — npm workspaces resolves `-w
apps/roju-ride` to here automatically.

1. Copy the env template and fill in secrets:
   ```
   cp apps/roju-ride/.env.example apps/roju-ride/.env
   ```
2. Start Postgres (with PostGIS) and Redis:
   ```
   docker compose up -d
   ```
3. Install dependencies (installs for every app in the workspace):
   ```
   npm install
   ```
4. Generate and apply the initial migration, then seed the catalog:
   ```
   npm run db:generate -w apps/roju-ride
   npm run db:migrate -w apps/roju-ride
   npm run db:seed -w apps/roju-ride
   ```
5. Run the API in watch mode:
   ```
   npm run dev:ride
   ```
   Health check: `GET http://localhost:3000/api/v1/health`

## Project layout

```
apps/roju-ride/
  src/
    db/
      schema/        # Drizzle table definitions, one file per domain area
      client.ts       # Database type + schema re-export
      db.module.ts    # Nest global module exposing the Drizzle instance (DRIZZLE token)
      migrate.ts      # Standalone migration runner
      seed.ts         # Idempotent catalog seed (Hyderabad launch categories)
      migrations/     # drizzle-kit generated SQL migrations
    config/           # Env validation (zod) + structured ConfigService values
    identity/         # Verification-only JwtAuthGuard/RolesGuard — trusts roju-identity's
                       # tokens, never issues its own (see root README)
    modules/          # One Nest module per domain — see docs/module-design.md
    app.module.ts
    main.ts
```

The schema in `src/db/schema/` is organized to mirror the source database design:
`core` (catalog/rides/pricing/outbox/safety — `users`/`refresh_tokens` moved to
roju-identity's own database), `finance` (wallet ledger, settlements, invoices),
`compliance` (driver documents/vehicles), `trips` (stops, route breadcrumbs, reviews), `ops`
(incidents, cancellation penalties, webhook dedupe, audit log), `engagement` (devices,
notifications), `growth` (referrals, incentives), `geo` (areas, surge history), and
`shared-rides` (pooling, groups). Every `userId`/`riderId`/`ownerUserId`-style column is a
**cross-service soft reference** to roju-identity's `users.id` — plain uuid, no DB-enforced
FK, since it's a different database now.

Two tables (`ride_route_points`, `surge_zones_history`) are designed for native Postgres
`PARTITION BY RANGE` partitioning; Drizzle's schema builder has no declarative support for
that, so the partitioning DDL needs to be added by hand-editing the generated migration (or a
follow-up raw-SQL migration) before it's run against production.

## Notes / open items

- `ride_category_faqs` in the schema is a best-effort reconstruction — the source table
  definition was truncated before the `answer` field in the original design doc.
- **Auth/Users moved out** to `apps/roju-identity` — a shared login across every Roju app is
  a platform requirement, not something this app owns on its own. This app only verifies
  tokens (`src/identity/`); it has no signup/login endpoints of its own anymore.
- Pending modules: pricing surge, payments/invoicing, compliance, safety, growth, admin,
  notifications, realtime gateway — see `docs/module-design.md` for each one's design.
