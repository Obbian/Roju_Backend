ALTER TABLE "fare_configs" ALTER COLUMN "perWaitingMinuteFare" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "fare_configs" ALTER COLUMN "freeWaitingMinutes" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "waitingCharge" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
-- Existing rows were seeded under the old defaults (0 / 5 min) — apply the 2026-09-15
-- pricing brief (₹1/min after 3 free min) to whatever's already there, not just new rows.
UPDATE "fare_configs" SET "perWaitingMinuteFare" = '1', "freeWaitingMinutes" = 3
WHERE "perWaitingMinuteFare" = '0' AND "freeWaitingMinutes" = 5;