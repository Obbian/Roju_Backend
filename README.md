# Roju Backend

An npm workspace holding one independently deployable service per Roju app. Being in one
repo is a source-control/tooling convenience only — each app under `apps/` has its own
`package.json`, runs as its own process, and owns its own database. Nothing here couples
their runtimes together.

## Apps

| App | Status | Purpose |
|---|---|---|
| [`apps/roju-identity`](apps/roju-identity) | Built | Shared login/signup across every Roju app — phone+OTP, JWT issuance, service enrollment (`service_memberships`). Every other app trusts its tokens; none of them issue their own. |
| [`apps/roju-ride`](apps/roju-ride) | In progress | Ride-hailing backend — booking, matching, pricing, driver compliance, wallet/settlement. Verifies (never issues) roju-identity's tokens via the shared access secret. |
| `apps/roju-fixit` | Not yet created | Scaffolded once FixIt's actual requirements are defined — will authenticate against roju-identity the same way roju-ride does. |

## Shared packages

`packages/` will hold code shared *between* apps once there's a second consumer of
roju-identity's tokens to prove the contract out (e.g. a `packages/auth-client` both
`roju-ride` and `roju-fixit` import instead of each keeping their own copy of the JWT
verification guard). Empty for now — see `docs/roju-ride-hld.md §6` for why this wasn't
built speculatively.

## Working in this repo

```
npm install                        # installs every app's dependencies (npm workspaces)
npm run dev:ride                   # start Roju Ride in watch mode
npm run <script> -w apps/<app>     # run any app-specific script directly, e.g.:
npm run start:dev -w apps/roju-identity
```

Both `roju-ride` and `roju-identity` must share the same `JWT_ACCESS_SECRET` — that's the
whole trust mechanism between them (see each app's `.env.example`).

See each app's own README for its setup, and `docs/` for the platform-wide architecture:

- `docs/roju-ride-hld.md` — high-level design, modeled on Uber's published architecture
- `docs/module-design.md` — per-module design for Roju Ride
- `docs/system-design-research.md` — research notes and core algorithms
