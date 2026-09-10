# Roju Identity

The shared login/signup for every Roju app — phone+OTP, JWT issuance, and which apps a
person is enrolled in (`service_memberships`). No app-specific data lives here; it's
identity and enrollment only. Part of the `Roju_Backend` workspace — see the
[root README](../../README.md).

## Why this is its own app, not a module inside `roju-ride`

Roju Ride, FixIt, and any future Roju app all need the *same* signup/login screen — the
same phone number, the same OTP flow, one session that works across all of them. That only
works if one service owns identity and every other app trusts its tokens, rather than each
app running its own login. See `docs/roju-ride-hld.md §6` for the full reasoning (this is
the one case in this codebase where "extract it into its own service" was the right call
from day one, not something deferred until load demanded it).

## How other apps use this

- They never call this service per request — a token issued here is verified **locally** by
  each app (same `JWT_ACCESS_SECRET`), so there's no network hop on the hot path.
- They only call here for what actually needs to happen centrally: login, refresh, logout.
- `service_memberships` is how "one account, many apps" actually works: a single
  `users` row can hold a `RIDE`/`CUSTOMER` row, a `RIDE`/`PROVIDER` row, a `FIXIT`/`CUSTOMER`
  row, etc. — all independent, all on one phone number.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` | Send an OTP to a phone number |
| POST | `/auth/otp/verify` | Verify it — creates the account on first use, returns tokens + active `service_memberships` for the calling app |
| POST | `/auth/refresh` | Rotates the refresh token — the WhatsApp-style "don't ask OTP again" mechanism, see `TokenService` |
| POST | `/auth/logout` | Revokes a refresh token |
| GET | `/auth/me` | The splash-screen check: valid session → profile + memberships, no OTP needed |

## Getting started

Run these from the **repo root** — npm workspaces resolves `-w apps/roju-identity` here.

1. ```
   cp apps/roju-identity/.env.example apps/roju-identity/.env
   ```
2. `docker compose up -d` (provisions both `roju_ride` and `roju_identity` databases via
   `docker/init-db.sql` — only runs on a fresh volume; drop the existing one if it predates
   this)
3. `npm install`
4. ```
   npm run db:generate -w apps/roju-identity
   npm run db:migrate -w apps/roju-identity
   ```
5. `npm run start:dev -w apps/roju-identity` — health check: `GET http://localhost:3100/api/v1/health`

**`JWT_ACCESS_SECRET` must be identical to `roju-ride`'s** — that's the entire trust
mechanism. A mismatch means every request to `roju-ride` gets rejected as unauthorized.

## Open items

- `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are a shared symmetric key (HS256) for now —
  move to RS256 (this service holds the private key, every other app only gets the public
  key) once there's a second real consumer app to prove the key-distribution story out.
- `users.role` (RIDER/DRIVER/ADMIN) still exists alongside `service_memberships` — narrowing
  it to admin-only meaning is a follow-up once FixIt actually needs the CUSTOMER/PROVIDER
  split enforced here, not before.
- **MSG91 delivers OTPs** (`src/modules/auth/sms/`) — falls back to logging the code to
  console when `MSG91_AUTH_KEY` is unset, so dev/CI never needs real credentials. Verified
  against the real API: it returns `{"type":"success"}` even for a completely invalid
  authkey — a 204 from `/auth/otp/request` is never proof an SMS actually sent once live
  credentials are in place; confirm real credentials against a phone you control, not by
  trusting the response here.
