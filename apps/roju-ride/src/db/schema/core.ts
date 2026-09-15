import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  cancellationReason,
  driverStatus,
  outboxStatus,
  paymentMethod,
  paymentStatus,
  rideStatus,
} from './enums';

// ─────────────────────────────────────────────────────────────────────────
// CATALOG — services, ride categories, localized copy
// ─────────────────────────────────────────────────────────────────────────

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull().unique(),
    displayName: jsonb('display_name').notNull(),
    iconUrl: varchar('icon_url', { length: 512 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    activeSortIdx: index('IDX_services_active_sort').on(table.isActive, table.sortOrder),
  }),
);

export const rideCategories = pgTable(
  'ride_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The bookable SUB-CATEGORY (e.g. AUTO, AUTO_LITE, AUTO_QUICK, AUTO_POOLING, CABX, CABXL,
    // COMFORT, BIKE, BIKE_LITE, SCOOTY, RENTAL_CABS, OUTSTATION, AIRPORT_TAXI, ...). Every
    // rideType/ride_type varchar column elsewhere (rides, fare_configs, ride_pools, ...)
    // stores this same value as a soft reference. New sub-categories are just new rows —
    // no schema change needed. vehicleClass below is the PARENT grouping (one of 4).
    code: varchar('code', { length: 32 }).notNull().unique(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    displayName: jsonb('display_name').notNull(),
    description: jsonb('description'),
    iconUrl: varchar('icon_url', { length: 512 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 512 }),
    // Seat capacity per row — no default: every category must set its own value explicitly
    // (Bike/Bike Lite/Scooty/She-Bike=1, Auto family=3, Cab=4, Cab XL/Comfort=6, ...)
    capacity: integer('capacity').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    // Per-category feature switches, e.g. {"rental":true}/{"outstation":true}/{"airport":true}
    flags: jsonb('flags').notNull().default({}),
    // Parent vehicle-category grouping: BIKE, SCOOTY, AUTO, or CAB
    vehicleClass: varchar('vehicle_class', { length: 32 }),
    etaFactor: numeric('eta_factor', { precision: 4, scale: 2 }).notNull().default('1.0'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    serviceIdx: index('IDX_ride_categories_service').on(table.serviceId),
    activeSortIdx: index('IDX_ride_categories_active_sort').on(table.isActive, table.sortOrder),
  }),
);

export const rideCategoryCities = pgTable(
  'ride_category_cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rideCategoryId: uuid('ride_category_id')
      .notNull()
      .references(() => rideCategories.id),
    city: varchar('city', { length: 50 }).notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uqCategoryCity: uniqueIndex('UQ_ride_category_city').on(table.rideCategoryId, table.city),
    cityIdx: index('IDX_ride_category_cities_city').on(table.city, table.isAvailable),
  }),
);

export const catalogVersions = pgTable('catalog_versions', {
  scope: varchar('scope', { length: 50 }).primaryKey(),
  version: bigint('version', { mode: 'number' }).notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messageCatalog = pgTable('message_catalog', {
  key: varchar('key', { length: 128 }).primaryKey(),
  scope: varchar('scope', { length: 50 }).notNull().default('global'),
  message: jsonb('message').notNull(),
  description: varchar('description', { length: 256 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// USERS — identity lives in roju-identity now (its own database). userId columns
// below are cross-service soft references (plain uuid, no DB-enforced FK) to that
// service's users.id — see docs/roju-ride-hld.md §6 (identity extraction).
// ─────────────────────────────────────────────────────────────────────────

export const savedLocations = pgTable(
  'saved_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    label: varchar('label', { length: 50 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    address: varchar('address'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('IDX_saved_locations_userId').on(table.userId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// DRIVERS
// ─────────────────────────────────────────────────────────────────────────

export const drivers = pgTable(
  'drivers',
  {
    // 1:1 with roju-identity's users.id — no separate surrogate key. Cross-service soft
    // reference (no DB-enforced FK — see the schema-file header note above).
    userId: uuid('userId').primaryKey(),
    licenseNumber: varchar('licenseNumber', { length: 50 }).notNull().unique(),
    vehicleRegistration: varchar('vehicleRegistration', { length: 50 }).notNull().unique(),
    vehicleModel: varchar('vehicleModel', { length: 100 }),
    vehicleColor: varchar('vehicleColor', { length: 20 }),
    // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
    vehicleType: varchar('vehicleType', { length: 32 }).notNull(),
    status: driverStatus('status').notNull().default('OFFLINE'),
    rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.0'),
    // Increments only on ride completion
    totalRides: integer('totalRides').notNull().default(0),
    completionRate: numeric('completionRate', { precision: 5, scale: 2 })
      .notNull()
      .default('100.0'),
    acceptanceRate: numeric('acceptanceRate', { precision: 5, scale: 2 })
      .notNull()
      .default('100.0'),
    offersReceivedCount: integer('offersReceivedCount').notNull().default(0),
    offersAcceptedCount: integer('offersAcceptedCount').notNull().default(0),
    languages: varchar('languages', { length: 10 }).array(),
    // CACHE, recomputed nightly by the badge sweep — not manually set
    isNeverCancelBadge: boolean('isNeverCancelBadge').notNull().default(false),
    isTopDriverBadge: boolean('isTopDriverBadge').notNull().default(false),
    badgesCheckedAt: timestamp('badgesCheckedAt'),
    // CACHE of wallet_ledger tail — never the source of truth
    walletBalance: numeric('walletBalance', { precision: 10, scale: 2 }).notNull().default('0'),
    walletBalancePaise: integer('walletBalancePaise').notNull().default(0),
    bankAccount: varchar('bankAccount', { length: 20 }),
    upiId: varchar('upiId'),
    isComplianceVerified: boolean('isComplianceVerified').notNull().default(false),
    complianceCheckedAt: timestamp('complianceCheckedAt'),
    activeVehicleId: uuid('activeVehicleId'),
    lastLocationUpdateAt: timestamp('lastLocationUpdateAt'),
    onlineSince: timestamp('onlineSince'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('IDX_drivers_status').on(table.status),
    matchableIdx: index('IDX_drivers_matchable')
      .on(table.status, table.vehicleType)
      .where(sql`${table.status} = 'ONLINE' AND ${table.isComplianceVerified} = true`),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// RIDES
// ─────────────────────────────────────────────────────────────────────────

export const rides = pgTable(
  'rides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    riderId: uuid('riderId').notNull(),
    driverId: uuid('driverId').references(() => drivers.userId),
    // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
    rideType: varchar('rideType', { length: 32 }).notNull(),
    status: rideStatus('status').notNull().default('REQUESTED'),
    pickupLat: doublePrecision('pickupLat').notNull(),
    pickupLon: doublePrecision('pickupLon').notNull(),
    pickupAddress: varchar('pickupAddress'),
    dropoffLat: doublePrecision('dropoffLat').notNull(),
    dropoffLon: doublePrecision('dropoffLon').notNull(),
    dropoffAddress: varchar('dropoffAddress'),
    city: varchar('city', { length: 50 }).notNull().default('Delhi'),
    estimatedFare: numeric('estimatedFare', { precision: 10, scale: 2 }).notNull(),
    totalFare: numeric('totalFare', { precision: 10, scale: 2 }),
    surgeMultiplier: numeric('surgeMultiplier', { precision: 3, scale: 2 })
      .notNull()
      .default('1.0'),
    distanceKm: numeric('distanceKm', { precision: 10, scale: 2 }).notNull().default('0'),
    durationMin: integer('durationMin').notNull().default(0),
    // Live ETA refreshed from GPS while ACCEPTED/ARRIVED/IN_PROGRESS; durationMin stays the original quote
    etaMinutes: integer('etaMinutes'),
    etaUpdatedAt: timestamp('etaUpdatedAt'),
    stopCount: integer('stopCount').notNull().default(0),
    promoCode: varchar('promoCode'),
    promoDiscount: numeric('promoDiscount', { precision: 10, scale: 2 }).notNull().default('0'),
    paymentStatus: paymentStatus('paymentStatus').notNull().default('PENDING'),
    paymentMethod: paymentMethod('paymentMethod').notNull().default('UPI'),
    acceptedAt: timestamp('acceptedAt'),
    arrivedAt: timestamp('arrivedAt'),
    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    cancelledAt: timestamp('cancelledAt'),
    cancellationReason: cancellationReason('cancellationReason'),
    cancellationFee: numeric('cancellationFee', { precision: 10, scale: 2 }).notNull().default('0'),
    // (arrivedAt -> startedAt) minus fareConfigs.freeWaitingMinutes, at fareConfigs.perWaitingMinuteFare
    // per minute — computed once in RidesService.complete(), folded into totalFare.
    waitingCharge: numeric('waitingCharge', { precision: 10, scale: 2 }).notNull().default('0'),
    riderRating: integer('riderRating'),
    driverRating: integer('driverRating'),
    // "Book for someone else" — free text, display-only. riderId stays the sole billing/penalty identity.
    passengerName: varchar('passengerName', { length: 100 }),
    passengerPhone: varchar('passengerPhone', { length: 15 }),
    rentalPackageId: uuid('rentalPackageId').references(() => rentalPackages.id),
    outstationPlannedDistanceKm: numeric('outstationPlannedDistanceKm', {
      precision: 10,
      scale: 2,
    }),
    outstationDriverAllowanceDays: integer('outstationDriverAllowanceDays'),
    // HUMAN (navigation UI) or HUMANOID (Roju AI chat/voice) — set server-side only
    bookingChannel: varchar('bookingChannel', { length: 10 }).notNull().default('HUMAN'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    riderIdx: index('IDX_rides_riderId').on(table.riderId),
    driverIdx: index('IDX_rides_driverId').on(table.driverId),
    statusIdx: index('IDX_rides_status').on(table.status),
    rideTypeIdx: index('IDX_rides_rideType').on(table.rideType),
    riderStatusCreatedIdx: index('IDX_rides_rider_status_created').on(
      table.riderId,
      table.status,
      table.createdAt,
    ),
    cityStatusCreatedIdx: index('IDX_rides_city_status_created').on(
      table.city,
      table.status,
      table.createdAt,
    ),
    driverActiveIdx: index('IDX_rides_driver_active')
      .on(table.driverId, table.status)
      .where(sql`${table.status} IN ('ACCEPTED','ARRIVED','IN_PROGRESS')`),
    settlementSweepIdx: index('IDX_rides_settlement_sweep')
      .on(table.driverId, table.completedAt)
      .where(sql`${table.status} = 'COMPLETED'`),
  }),
);

export const scheduledRides = pgTable(
  'scheduled_rides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    riderId: uuid('riderId').notNull(),
    rideId: uuid('rideId').references(() => rides.id),
    pickupLat: doublePrecision('pickupLat').notNull(),
    pickupLon: doublePrecision('pickupLon').notNull(),
    dropoffLat: doublePrecision('dropoffLat').notNull(),
    dropoffLon: doublePrecision('dropoffLon').notNull(),
    // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
    rideType: varchar('rideType', { length: 32 }).notNull(),
    city: varchar('city', { length: 50 }).notNull().default('Delhi'),
    scheduledFor: timestamp('scheduledFor').notNull(),
    // app-level values: PENDING/DISPATCHED/CANCELLED/FAILED — not a DB enum
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    bookingChannel: varchar('bookingChannel', { length: 10 }).notNull().default('HUMAN'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    dueIdx: index('IDX_scheduled_rides_due')
      .on(table.status, table.scheduledFor)
      .where(sql`${table.status} = 'PENDING'`),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// PAYMENTS & PRICING
// ─────────────────────────────────────────────────────────────────────────

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rideId: uuid('rideId')
      .notNull()
      .references(() => rides.id),
    userId: uuid('userId').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    status: paymentStatus('status').notNull().default('PENDING'),
    method: paymentMethod('method').notNull().default('UPI'),
    gateway: varchar('gateway', { length: 50 }).notNull().default('RAZORPAY'),
    gatewayOrderId: varchar('gatewayOrderId', { length: 255 }),
    gatewayPaymentId: varchar('gatewayPaymentId', { length: 255 }),
    failureReason: varchar('failureReason'),
    retryCount: integer('retryCount').notNull().default(0),
    refundedAmountPaise: integer('refundedAmountPaise').notNull().default(0),
    paidAt: timestamp('paidAt'),
    refundedAt: timestamp('refundedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    rideIdx: index('IDX_payments_rideId').on(table.rideId),
    userIdx: index('IDX_payments_userId').on(table.userId),
    gatewayOrderIdx: index('IDX_payments_gatewayOrderId').on(table.gatewayOrderId),
    pendingIdx: index('IDX_payments_pending')
      .on(table.status, table.createdAt)
      .where(sql`${table.status} IN ('PENDING','PROCESSING')`),
  }),
);

export const promos = pgTable('promos', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  discountPercent: numeric('discountPercent', { precision: 5, scale: 2 }).notNull(),
  maxDiscount: numeric('maxDiscount', { precision: 10, scale: 2 }).notNull().default('0'),
  maxUsesPerUser: integer('maxUsesPerUser').notNull().default(1),
  validFrom: timestamp('validFrom'),
  validUntil: timestamp('validUntil'),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const fareConfigs = pgTable(
  'fare_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    city: varchar('city', { length: 50 }).notNull(),
    // Catalog-driven, references ride_categories.code — soft FK, not DB-enforced
    rideType: varchar('rideType', { length: 32 }).notNull(),
    baseFare: numeric('baseFare', { precision: 10, scale: 2 }).notNull().default('50'),
    perKmRate: numeric('perKmRate', { precision: 10, scale: 2 }).notNull().default('10'),
    perMinuteRate: numeric('perMinuteRate', { precision: 10, scale: 2 }).notNull().default('1'),
    surgeMultiplier: numeric('surgeMultiplier', { precision: 3, scale: 2 })
      .notNull()
      .default('1.0'),
    minimumFare: numeric('minimumFare', { precision: 10, scale: 2 }).notNull().default('20'),
    // Platform fee excluding GST. NOTE: not currently read by the live settlement path —
    // commission is computed from the single global settlement.commissionPercent config today.
    commissionRate: numeric('commissionRate', { precision: 3, scale: 2 }).notNull().default('0.25'),
    // PLACEHOLDER pending finance/tax sign-off; not yet wired into invoice generation.
    gstRatePercent: numeric('gstRatePercent', { precision: 5, scale: 2 }).notNull().default('5.00'),
    perExtraStopFare: numeric('perExtraStopFare', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    // ₹1/minute after the free window, per the 2026-09-15 pricing brief.
    perWaitingMinuteFare: numeric('perWaitingMinuteFare', { precision: 10, scale: 2 })
      .notNull()
      .default('1'),
    freeWaitingMinutes: integer('freeWaitingMinutes').notNull().default(3),
    nightSurchargeFare: numeric('nightSurchargeFare', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    nightStartHour: integer('nightStartHour').notNull().default(23),
    nightEndHour: integer('nightEndHour').notNull().default(5),
    // PLACEHOLDER rate, only populated for OUTSTATION category rows
    outstationPerKmRatePaise: integer('outstationPerKmRatePaise'),
    outstationDriverAllowancePerDayPaise: integer('outstationDriverAllowancePerDayPaise'),
    // PLACEHOLDER rate, only populated for AIRPORT_TAXI category rows
    airportSurchargePaise: integer('airportSurchargePaise'),
    isActive: boolean('isActive').notNull().default(true),
  },
  (table) => ({
    cityIdx: index('IDX_fare_configs_city').on(table.city),
    lookupIdx: index('IDX_fare_configs_lookup')
      .on(table.city, table.rideType)
      .where(sql`${table.isActive} = true`),
  }),
);

export const rentalPackages = pgTable(
  'rental_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    city: varchar('city', { length: 50 }).notNull(),
    // Catalog-driven, references ride_categories.code (e.g. RENTAL_CABS) — soft FK, not DB-enforced
    rideType: varchar('ride_type', { length: 32 }).notNull(),
    tierName: varchar('tier_name', { length: 32 }).notNull(),
    durationHours: integer('duration_hours').notNull(),
    includedKm: integer('included_km').notNull(),
    packagePricePaise: integer('package_price_paise').notNull(),
    extraKmRatePaise: integer('extra_km_rate_paise').notNull(),
    extraHourRatePaise: integer('extra_hour_rate_paise').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uqCityTypeTier: uniqueIndex('UQ_rental_packages_city_type_tier').on(
      table.city,
      table.rideType,
      table.tierName,
    ),
    lookupIdx: index('IDX_rental_packages_lookup')
      .on(table.city, table.rideType)
      .where(sql`${table.isActive} = true`),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// OUTBOX & SAFETY
// ─────────────────────────────────────────────────────────────────────────

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: varchar('topic', { length: 100 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    aggregateType: varchar('aggregateType', { length: 50 }).notNull(),
    aggregateId: uuid('aggregateId').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatus('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('lastError'),
    retriedAt: timestamp('retriedAt'),
    retriedBy: uuid('retriedBy'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    publishedAt: timestamp('publishedAt'),
  },
  (table) => ({
    dispatchIdx: index('idx_outbox_dispatch').on(table.status, table.createdAt),
    aggregateIdx: index('idx_outbox_aggregate').on(table.aggregateType, table.aggregateId),
    dlqIdx: index('IDX_outbox_dlq')
      .on(table.createdAt)
      .where(sql`${table.status} = 'FAILED'`),
  }),
);

export const safetyEvents = pgTable(
  'safety_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId').notNull(),
    rideId: uuid('rideId').references(() => rides.id),
    sessionId: varchar('sessionId', { length: 64 }),
    trigger: varchar('trigger', { length: 32 }).notNull(),
    locationLat: numeric('locationLat', { precision: 10, scale: 7 }),
    locationLon: numeric('locationLon', { precision: 10, scale: 7 }),
    source: varchar('source', { length: 32 }).notNull().default('rider_app'),
    // app-level values, not a DB enum
    status: varchar('status', { length: 24 }).notNull().default('OPEN'),
    acknowledgedAt: timestamp('acknowledgedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index('IDX_safety_events_created').on(table.createdAt),
    userCreatedIdx: index('IDX_safety_events_user_created').on(table.userId, table.createdAt),
    openIdx: index('IDX_safety_events_open')
      .on(table.status)
      .where(sql`${table.status} <> 'RESOLVED'`),
  }),
);
