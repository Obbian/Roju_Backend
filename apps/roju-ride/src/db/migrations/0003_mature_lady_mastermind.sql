CREATE TABLE IF NOT EXISTS "rush_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"catchment_radius_meters" integer DEFAULT 3000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rush_areas_city" ON "rush_areas" USING btree ("city","is_active");
--> statement-breakpoint
-- Seeds the areas that were previously hardcoded in matching.service.ts, so this migration
-- preserves current behavior exactly. Coordinates are approximate — confirm/adjust once MD
-- shares the detailed rush-area list (2026-09-15 brief).
INSERT INTO "rush_areas" ("city", "name", "lat", "lon") VALUES
	('Hyderabad', 'Gachibowli', 17.4401, 78.3489),
	('Hyderabad', 'Financial District', 17.4132, 78.3414),
	('Hyderabad', 'HITEC City', 17.4435, 78.3772),
	('Hyderabad', 'Kondapur', 17.4615, 78.3491),
	('Hyderabad', 'Madhapur', 17.4483, 78.3915),
	('Hyderabad', 'Jubilee Hills', 17.4325, 78.4071),
	('Hyderabad', 'Film Nagar', 17.4184, 78.4116);