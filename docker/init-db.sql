-- Runs once, on first container creation, alongside the default POSTGRES_DB.
-- Keeps roju-identity's data physically separate from roju-ride's from day one, even
-- though both currently share one Postgres server for local-dev simplicity.
CREATE DATABASE roju_identity;
