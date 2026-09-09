import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { incentiveStatus, referralStatus, userRole } from './enums';
import { drivers, rides, users } from './core';
import { walletLedger } from './finance';

export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 16 }).notNull().unique(),
    ownerUserId: uuid('ownerUserId')
      .notNull()
      .references(() => users.id),
    // which side of the marketplace this code recruits
    targetRole: userRole('targetRole').notNull().default('RIDER'),
    refereeRewardPaise: integer('refereeRewardPaise').notNull().default(0),
    referrerRewardPaise: integer('referrerRewardPaise').notNull().default(0),
    qualifyingRides: integer('qualifyingRides').notNull().default(1),
    // 0 = unlimited
    maxRedemptions: integer('maxRedemptions').notNull().default(0),
    redemptionCount: integer('redemptionCount').notNull().default(0),
    validFrom: timestamp('validFrom'),
    validUntil: timestamp('validUntil'),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index('IDX_referral_codes_owner').on(table.ownerUserId),
    activeIdx: index('IDX_referral_codes_active')
      .on(table.code)
      .where(sql`${table.isActive} = true`),
  }),
);

export const referralRedemptions = pgTable(
  'referral_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralCodeId: uuid('referralCodeId')
      .notNull()
      .references(() => referralCodes.id),
    referrerUserId: uuid('referrerUserId')
      .notNull()
      .references(() => users.id),
    // UNIQUE — one referral per account, ever
    refereeUserId: uuid('refereeUserId')
      .notNull()
      .unique()
      .references(() => users.id),
    status: referralStatus('status').notNull().default('PENDING'),
    qualifyingRidesCompleted: integer('qualifyingRidesCompleted').notNull().default(0),
    // the ride that tipped the referee over the qualifying threshold
    qualifyingRideId: uuid('qualifyingRideId').references(() => rides.id),
    referrerRewardPaise: integer('referrerRewardPaise').notNull().default(0),
    refereeRewardPaise: integer('refereeRewardPaise').notNull().default(0),
    rejectionReason: text('rejectionReason'),
    qualifiedAt: timestamp('qualifiedAt'),
    rewardedAt: timestamp('rewardedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    referrerIdx: index('IDX_referral_redemptions_referrer').on(
      table.referrerUserId,
      table.createdAt,
    ),
    payoutIdx: index('IDX_referral_redemptions_payout')
      .on(table.status, table.qualifiedAt)
      .where(sql`${table.status} = 'QUALIFIED'`),
  }),
);

// Progress increments on ride completion; payout writes exactly one INCENTIVE_CREDIT ledger
// entry, guarded by the PAID status transition.
export const driverIncentives = pgTable(
  'driver_incentives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driverId')
      .notNull()
      .references(() => drivers.userId),
    // 'DAILY_RIDES' | 'WEEKLY_RIDES' | 'PEAK_HOURS' | 'STREAK' ...
    incentiveType: varchar('incentiveType', { length: 32 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    targetRides: integer('targetRides').notNull().default(0),
    completedRides: integer('completedRides').notNull().default(0),
    targetEarningsPaise: integer('targetEarningsPaise').notNull().default(0),
    achievedEarningsPaise: integer('achievedEarningsPaise').notNull().default(0),
    bonusPaise: integer('bonusPaise').notNull().default(0),
    status: incentiveStatus('status').notNull().default('ACTIVE'),
    city: varchar('city', { length: 50 }),
    periodStart: timestamp('periodStart').notNull(),
    periodEnd: timestamp('periodEnd').notNull(),
    achievedAt: timestamp('achievedAt'),
    paidAt: timestamp('paidAt'),
    // the wallet_ledger row that paid this out — proves single payment
    ledgerEntryId: uuid('ledgerEntryId').references(() => walletLedger.id),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqDriverTypePeriod: uniqueIndex('UQ_driver_incentives_driver_type_period').on(
      table.driverId,
      table.incentiveType,
      table.periodStart,
    ),
    activeIdx: index('IDX_driver_incentives_active')
      .on(table.driverId, table.periodEnd)
      .where(sql`${table.status} = 'ACTIVE'`),
    payoutIdx: index('IDX_driver_incentives_payout')
      .on(table.achievedAt)
      .where(sql`${table.status} = 'ACHIEVED'`),
  }),
);
