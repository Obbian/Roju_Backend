import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { accountStatus, userRole } from './enums';

// The one identity every Roju app shares — phone, OTP, tokens, basic profile. Nothing
// service-specific lives here; see service_memberships for "which Roju app, as what role."
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneNumber: varchar('phoneNumber', { length: 15 }).notNull().unique(),
    email: varchar('email'),
    firstName: varchar('firstName'),
    lastName: varchar('lastName'),
    profileImageUrl: varchar('profileImageUrl'),
    role: userRole('role').notNull().default('RIDER'),
    rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('5.0'),
    isVerified: boolean('isVerified').notNull().default(false),
    accountStatus: accountStatus('accountStatus').notNull().default('ACTIVE'),
    suspendedUntil: timestamp('suspendedUntil'),
    moderationReason: text('moderationReason'),
    ratingCount: integer('ratingCount').notNull().default(0),
    referralCode: varchar('referralCode', { length: 16 }).unique(),
    // MALE / FEMALE / OTHER / PREFER_NOT_TO_SAY — app-level values, not a DB enum.
    gender: varchar('gender', { length: 20 }),
    emergencyContactName: varchar('emergencyContactName', { length: 100 }),
    emergencyContactPhone: varchar('emergencyContactPhone', { length: 15 }),
    // CONSUMER_APP / EXECUTIVE_APP / ADMIN_WEB — which app shell created the account.
    registeredVia: varchar('registeredVia', { length: 20 }).notNull().default('CONSUMER_APP'),
    // e.g. 'en-IN' / 'hi-IN' — set from the onboarding language-picker screen.
    preferredLanguage: varchar('preferredLanguage', { length: 12 }),
    lastLoginAt: timestamp('lastLoginAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    accountStatusIdx: index('IDX_users_account_status')
      .on(table.accountStatus)
      .where(sql`${table.accountStatus} <> 'ACTIVE'`),
  }),
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    tokenHash: varchar('tokenHash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expiresAt').notNull(),
    deviceInfo: varchar('deviceInfo'),
    revokedAt: timestamp('revokedAt'),
    rotatedAt: timestamp('rotatedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('IDX_refresh_tokens_userId').on(table.userId),
  }),
);
