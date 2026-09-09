import { sql } from 'drizzle-orm';
import {
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
import { cancellationReason, incidentSeverity, incidentStatus, incidentType } from './enums';
import { rides, users } from './core';

// The after-the-fact case file (triage/severity/resolution). Distinct from safety_events
// (real-time SOS intake).
export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // e.g. INC-8F3K2Q, quoted in support conversations
    reference: varchar('reference', { length: 16 }).notNull().unique(),
    rideId: uuid('rideId').references(() => rides.id),
    reportedByUserId: uuid('reportedByUserId')
      .notNull()
      .references(() => users.id),
    // counterparty the report is about, when applicable
    againstUserId: uuid('againstUserId').references(() => users.id),
    incidentType: incidentType('incidentType').notNull(),
    severity: incidentSeverity('severity').notNull().default('MEDIUM'),
    status: incidentStatus('status').notNull().default('OPEN'),
    description: text('description').notNull(),
    attachmentKeys: varchar('attachmentKeys', { length: 512 }).array(),
    // NULL = unassigned queue
    assignedToUserId: uuid('assignedToUserId').references(() => users.id),
    resolution: text('resolution'),
    compensationPaise: integer('compensationPaise').notNull().default(0),
    resolvedByUserId: uuid('resolvedByUserId').references(() => users.id),
    resolvedAt: timestamp('resolvedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    openQueueIdx: index('IDX_incidents_open_queue')
      .on(table.severity, table.createdAt)
      .where(sql`${table.status} IN ('OPEN','TRIAGED','INVESTIGATING')`),
    rideIdx: index('IDX_incidents_ride').on(table.rideId),
    againstUserIdx: index('IDX_incidents_against_user').on(table.againstUserId, table.createdAt),
    reporterIdx: index('IDX_incidents_reporter').on(table.reportedByUserId, table.createdAt),
    assigneeIdx: index('IDX_incidents_assignee')
      .on(table.assignedToUserId, table.status)
      .where(sql`${table.assignedToUserId} IS NOT NULL`),
  }),
);

// Escalating penalty ledger — offenceIndex lets repeat cancellers pay progressively more
// instead of a flat fee.
export const cancellationPenalties = pgTable(
  'cancellation_penalties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    rideId: uuid('rideId')
      .notNull()
      .references(() => rides.id),
    // 'RIDER' | 'DRIVER' — app-level, not a DB enum
    role: varchar('role', { length: 8 }).notNull(),
    reason: cancellationReason('reason').notNull(),
    // count of chargeable cancellations in the rolling window — the escalation-tier key
    offenceIndex: integer('offenceIndex').notNull().default(1),
    penaltyPaise: integer('penaltyPaise').notNull().default(0),
    minutesSinceRequest: numeric('minutesSinceRequest', { precision: 8, scale: 2 })
      .notNull()
      .default('0'),
    isWaived: boolean('isWaived').notNull().default(false),
    waivedReason: text('waivedReason'),
    waivedByUserId: uuid('waivedByUserId').references(() => users.id),
    waivedAt: timestamp('waivedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    uqRideUser: uniqueIndex('UQ_cancellation_penalties_ride_user').on(table.rideId, table.userId),
    userWindowIdx: index('IDX_cancellation_penalties_user_window')
      .on(table.userId, table.createdAt)
      .where(sql`${table.isWaived} = false`),
  }),
);

// Inbound webhook dedupe. INSERT-first, conflict = already-processed. Without this, a
// retried payment.captured double-applies.
export const processedWebhooks = pgTable(
  'processed_webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 'RAZORPAY' | 'ROJU_AGENT' | ...
    source: varchar('source', { length: 32 }).notNull(),
    // provider's own event id — the dedupe key
    eventId: varchar('eventId', { length: 191 }).notNull(),
    eventType: varchar('eventType', { length: 96 }),
    referenceType: varchar('referenceType', { length: 32 }),
    referenceId: uuid('referenceId'),
    payloadDigest: varchar('payloadDigest', { length: 64 }),
    metadata: jsonb('metadata'),
    processedAt: timestamp('processedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqSourceEvent: uniqueIndex('UQ_processed_webhooks_source_event').on(
      table.source,
      table.eventId,
    ),
    processedIdx: index('IDX_processed_webhooks_processed').on(table.processedAt),
  }),
);

// Append-only audit of every privileged mutation (ban, waive, refund, document verdict,
// DLQ retry).
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actorUserId')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('targetType', { length: 32 }).notNull(),
    targetId: varchar('targetId', { length: 191 }),
    reason: text('reason'),
    // redacted before/after snapshot — no PII beyond ids
    metadata: jsonb('metadata'),
    requestId: varchar('requestId', { length: 64 }),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    actorCreatedIdx: index('IDX_admin_audit_actor_created').on(table.actorUserId, table.createdAt),
    targetIdx: index('IDX_admin_audit_target').on(table.targetType, table.targetId),
    createdIdx: index('IDX_admin_audit_created').on(table.createdAt),
  }),
);

// Durable source for active traffic/incident areas; a ride corridor intersecting one
// triggers RouteOptimizationService reroute + advisory. TTL-cached in Redis, this table is
// the durable backing store for ops dashboards.
export const incidentAreas = pgTable(
  'incident_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: varchar('incident_id', { length: 64 }),
    // app-level values RESTRICTED/DIVERSION/CONGESTION — NOT the same enum as areas.areaType
    areaType: varchar('area_type', { length: 20 }).notNull().default('RESTRICTED'),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    radiusM: integer('radius_m').notNull().default(500),
    reason: varchar('reason', { length: 256 }),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index('IDX_incident_areas_active').on(table.isActive),
    locationIdx: index('IDX_incident_areas_location').on(table.lat, table.lon),
  }),
);
