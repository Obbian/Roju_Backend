# Roju Ride Backend

Backend API for the Roju Ride platform — multi-modal ride-hailing (auto/bike/scooty/cab),
rentals/outstation/airport rides, She-Share & Corporate Pooling, driver compliance and
wallet/settlement finance, and a real-time safety layer.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL + PostGIS, via Drizzle ORM
- **Cache / queues**: Redis + BullMQ (outbox relay, background jobs)
- **Real-time**: Socket.io (live tracking, matching)

## Getting started

1. Copy the env template and fill in secrets:
   ```
   cp .env.example .env
   ```
2. Start Postgres (with PostGIS) and Redis:
   ```
   docker compose up -d
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Generate and apply the initial migration from the Drizzle schema:
   ```
   npm run db:generate
   npm run db:migrate
   ```
5. Run the API in watch mode:
   ```
   npm run start:dev
   ```
   Health check: `GET http://localhost:3000/api/v1/health`

## Project layout

```
src/
  db/
    schema/        # Drizzle table definitions, one file per domain area
    client.ts       # Database type + schema re-export
    db.module.ts    # Nest global module exposing the Drizzle instance (DRIZZLE token)
    migrate.ts      # Standalone migration runner (npm run db:migrate)
    migrations/     # drizzle-kit generated SQL migrations
  config/           # Env validation (zod) + structured ConfigService values
  modules/          # One Nest module per domain (health, auth, rides, ... to follow)
  app.module.ts
  main.ts
```

The schema in `src/db/schema/` is organized to mirror the source database design:
`core` (users/auth/catalog/rides/pricing/outbox/safety), `finance` (wallet ledger,
settlements, invoices), `compliance` (driver documents/vehicles), `trips` (stops, route
breadcrumbs, reviews), `ops` (incidents, cancellation penalties, webhook dedupe, audit log),
`engagement` (devices, notifications), `growth` (referrals, incentives), `geo` (areas, surge
history), and `shared-rides` (pooling, groups).

Two tables (`ride_route_points`, `surge_zones_history`) are designed for native Postgres
`PARTITION BY RANGE` partitioning; Drizzle's schema builder has no declarative support for
that, so the partitioning DDL needs to be added by hand-editing the generated migration (or a
follow-up raw-SQL migration) before it's run against production.

## Notes / open items

- `ride_category_faqs` in the schema is a best-effort reconstruction — the source table
  definition was truncated before the `answer` field in the original design doc.
- Business logic modules (auth, catalog, rides/matching, pricing, payments, safety,
  compliance, growth, pooling) are not yet implemented — this is project scaffolding only.
