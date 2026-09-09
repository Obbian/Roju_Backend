import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { devicePlatform, notificationType } from './enums';
import { users } from './core';

// Push tokens live here (not on users) because one account has several devices, and a dead
// token retires without touching the user.
export const userDevices = pgTable(
  'user_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    // app-generated stable install id
    deviceId: varchar('deviceId', { length: 128 }).notNull(),
    platform: devicePlatform('platform').notNull(),
    // FCM/APNs token; nullable before push permission granted
    pushToken: varchar('pushToken', { length: 512 }),
    appVersion: varchar('appVersion', { length: 24 }),
    osVersion: varchar('osVersion', { length: 24 }),
    deviceModel: varchar('deviceModel', { length: 64 }),
    // e.g. en-IN / hi-IN
    locale: varchar('locale', { length: 12 }),
    isPushEnabled: boolean('isPushEnabled').notNull().default(true),
    pushFailureCount: integer('pushFailureCount').notNull().default(0),
    lastActiveAt: timestamp('lastActiveAt').notNull().defaultNow(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    uqUserDevice: uniqueIndex('UQ_user_devices_user_device').on(table.userId, table.deviceId),
    pushableIdx: index('IDX_user_devices_pushable')
      .on(table.userId)
      .where(sql`${table.isPushEnabled} = true AND ${table.pushToken} IS NOT NULL`),
    tokenIdx: index('IDX_user_devices_token').on(table.pushToken),
  }),
);

// Persisted in-app notification centre — a rider offline when their ride completed still
// sees the receipt on reconnect.
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    notificationType: notificationType('notificationType').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    // deep-link route + params — never raw PII
    data: jsonb('data'),
    referenceType: varchar('referenceType', { length: 32 }),
    referenceId: uuid('referenceId'),
    readAt: timestamp('readAt'),
    // set once at least one device accepted the push
    pushedAt: timestamp('pushedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index('IDX_notifications_user_created').on(table.userId, table.createdAt),
    unreadIdx: index('IDX_notifications_unread')
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
  }),
);
