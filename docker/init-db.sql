-- Runs once, on first container creation, alongside the default POSTGRES_DB.
-- Keeps roju-identity's data physically separate from roju-ride's from day one, even
-- though both currently share one Postgres server for local-dev simplicity.
CREATE DATABASE roju_identity;

-- Every `timestamp` column in both schemas is timezone-naive by design (see each app's
-- schema files) — node-postgres parses a tz-naive value back as if it were already UTC.
-- That's only correct if the server actually writes UTC wall-clock into those columns via
-- now()/defaultNow(), which requires the session timezone to BE UTC. Left at a local zone
-- (e.g. the host machine's), every stored createdAt/updatedAt/etc. silently drifts from real
-- UTC by that offset, breaking any code that compares one against Date.now() (matching's
-- offer-expiry window and cancellation's rolling-offence lookback both do this) — found live
-- via a ride that should have expired after 45s and never did, traced to exactly this.
ALTER DATABASE roju_ride SET timezone TO 'UTC';
ALTER DATABASE roju_identity SET timezone TO 'UTC';
