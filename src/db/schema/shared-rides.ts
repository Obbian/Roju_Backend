import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { groupRole, groupType, joinStatus, poolStatus } from './enums';
import { rides } from './core';

// She-Share / Corporate Pooling pool. Booking entry for these categories is a Humanoid/Roju
// AI-only flow (access-control rule on the booking API, not a DB placement decision) — pool
// state still needs the same transactional guarantees as every other ride, so it stays
// relational. The matching/pricing algorithm itself is a separate, not-yet-designed task.
export const ridePools = pgTable(
  'ride_pools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
    categoryCode: varchar('category_code', { length: 32 }).notNull(),
    city: varchar('city', { length: 50 }).notNull(),
    status: poolStatus('status').notNull().default('FORMING'),
    maxSeats: integer('max_seats').notNull().default(4),
    bookedSeats: integer('booked_seats').notNull().default(0),
    originLat: doublePrecision('origin_lat').notNull(),
    originLon: doublePrecision('origin_lon').notNull(),
    destLat: doublePrecision('dest_lat').notNull(),
    destLon: doublePrecision('dest_lon').notNull(),
    corridorPolyline: text('corridor_polyline'),
    // nullable: private/corporate groups only
    groupId: uuid('group_id').references((): any => groups.id),
    windowStart: timestamp('window_start'),
    windowEnd: timestamp('window_end'),
    // Total pool fare; split across members via ride_pool_members.share_fare_paise
    totalFarePaise: integer('total_fare_paise').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    statusCityIdx: index('IDX_ride_pools_status_city').on(table.status, table.city),
    groupIdx: index('IDX_ride_pools_group').on(table.groupId),
  }),
);

export const ridePoolMembers = pgTable(
  'ride_pool_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => ridePools.id),
    // set once the member individual ride is created
    rideId: uuid('ride_id').references(() => rides.id),
    // NOT a DB-enforced FK to users.id despite being a user id — stored as plain varchar
    riderId: varchar('rider_id', { length: 36 }).notNull(),
    seats: integer('seats').notNull().default(1),
    // This member's portion of ride_pools.total_fare_paise
    shareFarePaise: integer('share_fare_paise').notNull().default(0),
    joinStatus: joinStatus('join_status').notNull().default('PENDING'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uqPoolMember: uniqueIndex('UQ_pool_member').on(table.poolId, table.riderId),
    rideIdx: index('IDX_pool_members_ride').on(table.rideId),
  }),
);

// Public/private/community/corporate groups — creatable via ROJU Sync.
export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: groupType('type').notNull().default('PUBLIC'),
    // NOT a DB-enforced FK to users.id — stored as plain varchar
    ownerId: varchar('owner_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    city: varchar('city', { length: 50 }),
    isGroupPoolEnabled: boolean('is_group_pool_enabled').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index('IDX_groups_owner').on(table.ownerId),
  }),
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    // NOT a DB-enforced FK to users.id — stored as plain varchar
    userId: varchar('user_id', { length: 36 }).notNull(),
    role: groupRole('role').notNull().default('MEMBER'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uqGroupMember: uniqueIndex('UQ_group_member').on(table.groupId, table.userId),
  }),
);

// NOTE: the source DBML for this table was cut off mid-definition (truncated after the
// `answer` field) — sort_order/is_active/created_at/updated_at below are inferred by
// analogy with the other catalog tables (services, ride_categories, rental_packages) and
// should be confirmed against the real source once available.
export const rideCategoryFaqs = pgTable('ride_category_faqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
  categoryCode: varchar('category_code', { length: 32 }).notNull(),
  question: jsonb('question').notNull(),
  answer: jsonb('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
