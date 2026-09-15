ALTER TABLE "fare_configs" ADD COLUMN "peakSurgeMultiplier" numeric(3, 2) DEFAULT '1.2' NOT NULL;--> statement-breakpoint
ALTER TABLE "fare_configs" ADD COLUMN "peakMorningStartHour" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "fare_configs" ADD COLUMN "peakMorningEndHour" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "fare_configs" ADD COLUMN "peakEveningStartHour" integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE "fare_configs" ADD COLUMN "peakEveningEndHour" integer DEFAULT 20 NOT NULL;