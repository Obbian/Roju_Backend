import {
  bigserial,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { invoiceStatus, ledgerEntryType, settlementStatus } from './enums';
import { rides } from './core';

// Append-only. drivers.walletBalancePaise is a CACHE of this table's tail — this table is
// the source of truth. Never UPDATEd.
export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // monotonic insert order — the replay key, DB-assigned
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    driverId: uuid('driverId').notNull(),
    entryType: ledgerEntryType('entryType').notNull(),
    // signed; sign derived from entryType
    amountPaise: integer('amountPaise').notNull(),
    balanceBeforePaise: integer('balanceBeforePaise').notNull(),
    balanceAfterPaise: integer('balanceAfterPaise').notNull(),
    referenceType: varchar('referenceType', { length: 32 }),
    referenceId: uuid('referenceId'),
    // exactly-once guard — never Date.now() or random
    idempotencyKey: varchar('idempotencyKey', { length: 160 }).notNull().unique(),
    // mandatory for MANUAL_ADJUSTMENT
    reason: text('reason'),
    createdBy: uuid('createdBy'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    driverSeqIdx: index('IDX_wallet_ledger_driver_seq').on(table.driverId, table.seq),
    driverCreatedIdx: index('IDX_wallet_ledger_driver_created').on(table.driverId, table.createdAt),
    referenceIdx: index('IDX_wallet_ledger_reference').on(table.referenceType, table.referenceId),
  }),
);

// One row per (driver, period) nightly payout run. PENDING -> LEDGERED -> PAID/FAILED.
// Only netPayoutPaise moves the wallet, and only once PAID (SETTLEMENT_DEBIT in wallet_ledger).
export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    driverId: uuid('driverId').notNull(),
    periodStart: timestamp('periodStart').notNull(),
    periodEnd: timestamp('periodEnd').notNull(),
    rideCount: integer('rideCount').notNull().default(0),
    grossPaise: integer('grossPaise').notNull().default(0),
    commissionPaise: integer('commissionPaise').notNull().default(0),
    incentivePaise: integer('incentivePaise').notNull().default(0),
    penaltyPaise: integer('penaltyPaise').notNull().default(0),
    // gross - commission + incentive - penalty; stored, not derived
    netPayoutPaise: integer('netPayoutPaise').notNull().default(0),
    commissionPercent: numeric('commissionPercent', { precision: 5, scale: 2 }).notNull(),
    status: settlementStatus('status').notNull().default('PENDING'),
    payoutReference: varchar('payoutReference', { length: 128 }),
    payoutMode: varchar('payoutMode', { length: 16 }),
    failureReason: text('failureReason'),
    attempts: integer('attempts').notNull().default(0),
    ledgeredAt: timestamp('ledgeredAt'),
    paidAt: timestamp('paidAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqDriverPeriod: uniqueIndex('UQ_settlements_driver_period').on(
      table.driverId,
      table.periodStart,
      table.periodEnd,
    ),
    statusCreatedIdx: index('IDX_settlements_status_created').on(table.status, table.createdAt),
    driverCreatedIdx: index('IDX_settlements_driver_created').on(table.driverId, table.createdAt),
  }),
);

// One row per ride, written once at completion. A RECORD, never recomputed — answers
// "why was I charged this" even after fare_configs changes later.
export const rideFareBreakdown = pgTable(
  'ride_fare_breakdown',
  {
    rideId: uuid('rideId')
      .primaryKey()
      .references(() => rides.id),
    basePaise: integer('basePaise').notNull().default(0),
    distancePaise: integer('distancePaise').notNull().default(0),
    timePaise: integer('timePaise').notNull().default(0),
    surgePaise: integer('surgePaise').notNull().default(0),
    waitingPaise: integer('waitingPaise').notNull().default(0),
    tollPaise: integer('tollPaise').notNull().default(0),
    nightPaise: integer('nightPaise').notNull().default(0),
    extraStopPaise: integer('extraStopPaise').notNull().default(0),
    // flat AIRPORT_TAXI surcharge, non-surgeable like tollPaise
    airportSurchargePaise: integer('airportSurchargePaise').notNull().default(0),
    tipPaise: integer('tipPaise').notNull().default(0),
    promoDiscountPaise: integer('promoDiscountPaise').notNull().default(0),
    cancellationFeePaise: integer('cancellationFeePaise').notNull().default(0),
    subtotalPaise: integer('subtotalPaise').notNull().default(0),
    taxPaise: integer('taxPaise').notNull().default(0),
    totalPaise: integer('totalPaise').notNull().default(0),
    // mirrors the wallet_ledger RIDE_EARNING amount for this ride
    driverEarningPaise: integer('driverEarningPaise').notNull().default(0),
    commissionPaise: integer('commissionPaise').notNull().default(0),
    surgeMultiplier: numeric('surgeMultiplier', { precision: 3, scale: 2 })
      .notNull()
      .default('1.0'),
    // snapshot of the fare_configs row used, for audit after config edits
    fareConfigId: uuid('fareConfigId'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index('IDX_ride_fare_breakdown_created').on(table.createdAt),
  }),
);

// GST invoice per ride. ISSUED rows immutable — corrections are CANCELLED + re-issued.
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rideId: uuid('rideId')
      .notNull()
      .unique()
      .references(() => rides.id),
    invoiceNumber: varchar('invoiceNumber', { length: 32 }).notNull().unique(),
    financialYear: varchar('financialYear', { length: 9 }).notNull(),
    status: invoiceStatus('status').notNull().default('DRAFT'),
    taxableValuePaise: integer('taxableValuePaise').notNull(),
    cgstPaise: integer('cgstPaise').notNull().default(0),
    sgstPaise: integer('sgstPaise').notNull().default(0),
    igstPaise: integer('igstPaise').notNull().default(0),
    totalPaise: integer('totalPaise').notNull(),
    gstRatePercent: numeric('gstRatePercent', { precision: 5, scale: 2 }).notNull(),
    // passenger transport by road
    sacCode: varchar('sacCode', { length: 8 }).notNull().default('996422'),
    sellerGstin: varchar('sellerGstin', { length: 15 }),
    sellerLegalName: varchar('sellerLegalName', { length: 160 }),
    buyerGstin: varchar('buyerGstin', { length: 15 }),
    buyerLegalName: varchar('buyerLegalName', { length: 160 }),
    placeOfSupply: varchar('placeOfSupply', { length: 64 }),
    pdfUrl: varchar('pdfUrl', { length: 512 }),
    issuedAt: timestamp('issuedAt'),
    cancelledAt: timestamp('cancelledAt'),
    cancellationReason: text('cancellationReason'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    fyNumberIdx: index('IDX_invoices_fy_number').on(table.financialYear, table.invoiceNumber),
    buyerGstinIdx: index('IDX_invoices_buyer_gstin').on(table.buyerGstin),
    issuedIdx: index('IDX_invoices_issued').on(table.issuedAt),
  }),
);

// Gap-free invoice number counter. Issuer takes FOR UPDATE on this row to serialise
// concurrent issuance. No surrogate id — (financialYear, series) is the natural key.
export const invoiceSequences = pgTable(
  'invoice_sequences',
  {
    financialYear: varchar('financialYear', { length: 9 }).notNull(),
    series: varchar('series', { length: 16 }).notNull(),
    lastNumber: integer('lastNumber').notNull().default(0),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqFySeries: uniqueIndex('UQ_invoice_sequences_fy_series').on(table.financialYear, table.series),
  }),
);
