import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { areaType } from './enums';

// Geofenced areas driving operational rules — airports, restricted zones, surge zones.
export const areas = pgTable(
  'areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    // stable key referenced by config/rules, e.g. hyd-airport
    slug: varchar('slug', { length: 96 }).notNull().unique(),
    areaType: areaType('areaType').notNull(),
    city: varchar('city', { length: 50 }).notNull(),
    // PostGIS geography(Polygon,4326), declared as text for Drizzle typing — always
    // read/written via ST_* raw SQL
    boundary: text('boundary').notNull(),
    surchargePaise: integer('surchargePaise').notNull().default(0),
    minSurgeMultiplier: numeric('minSurgeMultiplier', { precision: 3, scale: 2 }),
    isRestricted: boolean('isRestricted').notNull().default(false),
    restrictionMessage: text('restrictionMessage'),
    // higher wins when polygons overlap
    priority: smallint('priority').notNull().default(0),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    cityTypeIdx: index('IDX_areas_city_type')
      .on(table.city, table.areaType)
      .where(sql`${table.isActive} = true`),
    priorityIdx: index('IDX_areas_priority').on(table.priority),
  }),
);

// Surge audit trail, one row per (city, H3 cell, tick) — answers "why was I surged" and
// trains predictive surge. RANGE-partitioned by computedAt (monthly), applied via a raw SQL
// migration since Drizzle has no declarative PARTITION BY support. No single-column PK for
// the same reason as ride_route_points.
export const surgeZonesHistory = pgTable(
  'surge_zones_history',
  {
    id: uuid('id').defaultRandom().notNull(),
    city: varchar('city', { length: 50 }).notNull(),
    // H3 resolution-8 cell index
    h3Cell: varchar('h3Cell', { length: 20 }).notNull(),
    surgeMultiplier: numeric('surgeMultiplier', { precision: 3, scale: 2 }).notNull(),
    demandCount: integer('demandCount').notNull().default(0),
    supplyCount: integer('supplyCount').notNull().default(0),
    demandSupplyRatio: numeric('demandSupplyRatio', { precision: 8, scale: 3 })
      .notNull()
      .default('0'),
    computedAt: timestamp('computedAt').notNull(),
  },
  (table) => ({
    cellTimeIdx: index('IDX_surge_history_cell_time').on(table.h3Cell, table.computedAt),
    cityTimeIdx: index('IDX_surge_history_city_time').on(table.city, table.computedAt),
    uqCellTick: uniqueIndex('UQ_surge_history_cell_tick').on(table.h3Cell, table.computedAt),
  }),
);
