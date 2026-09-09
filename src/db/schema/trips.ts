import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
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
import { rideStopStatus } from './enums';
import { rides, users } from './core';

// Intermediate stops for multi-destination rides. 0 rows = classic point-to-point ride.
export const rideStops = pgTable(
  'ride_stops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rideId: uuid('rideId')
      .notNull()
      .references(() => rides.id),
    // 1-based; ride pickup/dropoff columns remain the first/last legs
    stopOrder: smallint('stopOrder').notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    address: varchar('address', { length: 512 }),
    status: rideStopStatus('status').notNull().default('PENDING'),
    // drives waitingPaise on the fare
    waitingMinutes: integer('waitingMinutes').notNull().default(0),
    arrivedAt: timestamp('arrivedAt'),
    departedAt: timestamp('departedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    uqRideOrder: uniqueIndex('UQ_ride_stops_ride_order').on(table.rideId, table.stopOrder),
    rideIdx: index('IDX_ride_stops_ride').on(table.rideId),
  }),
);

// Sampled GPS breadcrumb trail, ~1 point/4s/active ride — the highest-volume table in the
// system. RANGE-partitioned by recordedAt (daily) — applied via a raw SQL migration since
// Drizzle's schema builder has no declarative PARTITION BY support. Deliberately NO foreign
// key to rides — a partitioned child cannot carry one cheaply at this write volume; orphan
// rows age out with the partition. No single-column PK for the same reason.
export const rideRoutePoints = pgTable(
  'ride_route_points',
  {
    id: uuid('id').defaultRandom().notNull(),
    rideId: uuid('rideId').notNull(),
    driverId: uuid('driverId').notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    speedKmph: numeric('speedKmph', { precision: 6, scale: 2 }),
    headingDegrees: smallint('headingDegrees'),
    // >50m points are low-trust
    accuracyMetres: smallint('accuracyMetres'),
    recordedAt: timestamp('recordedAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    rideTimeIdx: index('IDX_ride_route_points_ride_time').on(table.rideId, table.recordedAt),
  }),
);

// Rich two-way reviews (free text/tags/moderation) — distinct from the fast denormalised
// rides.riderRating/driverRating.
export const rideReviews = pgTable(
  'ride_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rideId: uuid('rideId')
      .notNull()
      .references(() => rides.id),
    fromUserId: uuid('fromUserId')
      .notNull()
      .references(() => users.id),
    toUserId: uuid('toUserId')
      .notNull()
      .references(() => users.id),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    tags: varchar('tags', { length: 32 }).array(),
    isFlagged: boolean('isFlagged').notNull().default(false),
    moderationNote: text('moderationNote'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    uqRideFrom: uniqueIndex('UQ_ride_reviews_ride_from').on(table.rideId, table.fromUserId),
    toUserIdx: index('IDX_ride_reviews_to_user')
      .on(table.toUserId, table.createdAt)
      .where(sql`${table.isFlagged} = false`),
    flaggedIdx: index('IDX_ride_reviews_flagged')
      .on(table.createdAt)
      .where(sql`${table.isFlagged} = true`),
  }),
);
