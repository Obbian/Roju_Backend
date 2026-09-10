import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './core';

// The piece that makes "one login, many apps" real: one users row can hold any combination
// of (service, role) — a Ride customer, a Ride driver, a FixIt customer, a FixIt provider,
// all on the same phone number/account. serviceCode is a soft reference to whatever each
// app's own catalog calls its services ('RIDE', 'FIXIT', ...) — Identity doesn't own or
// need a catalog of its own.
export const serviceMemberships = pgTable(
  'service_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    serviceCode: varchar('serviceCode', { length: 32 }).notNull(),
    // 'CUSTOMER' | 'PROVIDER' — app-level values, not a DB enum (kept loose since each
    // service may eventually want its own vocabulary here).
    membershipRole: varchar('membershipRole', { length: 16 }).notNull(),
    // 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' — a PROVIDER enrollment can need
    // service-specific onboarding (documents, skills) before it's usable; a CUSTOMER
    // enrollment is ACTIVE immediately.
    status: varchar('status', { length: 24 }).notNull().default('ACTIVE'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqUserServiceRole: uniqueIndex('UQ_service_memberships_user_service_role').on(
      table.userId,
      table.serviceCode,
      table.membershipRole,
    ),
  }),
);
