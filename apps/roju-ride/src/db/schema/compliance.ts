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
import { documentStatus, driverDocumentType, rideTypeEnum } from './enums';
import { drivers } from './core';

// Evidence trail behind drivers.isComplianceVerified. One row per (driver, documentType,
// vehicle?); rejected/expired history is kept, not deleted.
export const driverDocuments = pgTable(
  'driver_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driverId')
      .notNull()
      .references(() => drivers.userId),
    // NULL for person-scoped docs (Aadhaar, PAN); set for vehicle-scoped ones
    vehicleId: uuid('vehicleId'),
    documentType: driverDocumentType('documentType').notNull(),
    status: documentStatus('status').notNull().default('PENDING'),
    // object-store key, signed on read — never a public URL
    storageKey: varchar('storageKey', { length: 512 }).notNull(),
    documentNumber: varchar('documentNumber', { length: 64 }),
    issuedAt: timestamp('issuedAt'),
    // NULL = never expires (PAN/Aadhaar); else swept nightly
    expiresAt: timestamp('expiresAt'),
    verifiedBy: uuid('verifiedBy'),
    verifiedAt: timestamp('verifiedAt'),
    rejectionReason: text('rejectionReason'),
    submissionCount: integer('submissionCount').notNull().default(1),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    // exactly one LIVE doc per slot, history preserved
    liveSlotIdx: uniqueIndex('UQ_driver_documents_live_slot')
      .on(table.driverId, table.documentType, table.vehicleId)
      .where(sql`${table.status} IN ('PENDING','IN_REVIEW','VERIFIED')`),
    driverStatusIdx: index('IDX_driver_documents_driver_status').on(table.driverId, table.status),
    reviewQueueIdx: index('IDX_driver_documents_review_queue')
      .on(table.createdAt)
      .where(sql`${table.status} IN ('PENDING','IN_REVIEW')`),
    expiryIdx: index('IDX_driver_documents_expiry')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'VERIFIED' AND ${table.expiresAt} IS NOT NULL`),
  }),
);

// Replaces the old 1:1 registration columns on drivers, which lost history on every vehicle
// swap. drivers.activeVehicleId points at the one currently in service (soft reference).
export const driverVehicles = pgTable(
  'driver_vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driverId')
      .notNull()
      .references(() => drivers.userId),
    registrationNumber: varchar('registrationNumber', { length: 32 }).notNull().unique(),
    // Still the FIXED legacy enum, unlike rides.rideType/fareConfigs.rideType which moved to
    // catalog-driven varchar
    vehicleType: rideTypeEnum('vehicleType').notNull(),
    make: varchar('make', { length: 64 }),
    model: varchar('model', { length: 64 }),
    color: varchar('color', { length: 32 }),
    manufactureYear: integer('manufactureYear'),
    seatingCapacity: integer('seatingCapacity'),
    insuranceExpiresAt: timestamp('insuranceExpiresAt'),
    fitnessExpiresAt: timestamp('fitnessExpiresAt'),
    permitExpiresAt: timestamp('permitExpiresAt'),
    pucExpiresAt: timestamp('pucExpiresAt'),
    isVerified: boolean('isVerified').notNull().default(false),
    // false = retired/sold; kept for ride-history integrity
    isActive: boolean('isActive').notNull().default(true),
    retiredAt: timestamp('retiredAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    driverIdx: index('IDX_driver_vehicles_driver').on(table.driverId, table.isActive),
    expiryIdx: index('IDX_driver_vehicles_expiry')
      .on(table.insuranceExpiresAt)
      .where(sql`${table.isActive} = true`),
  }),
);
