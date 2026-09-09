import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['RIDER', 'DRIVER', 'ADMIN']);

// Legacy fixed enum. Only driver_vehicles.vehicleType still uses this directly —
// rides/fare_configs/rental_packages moved to catalog-driven varchar (see ride_categories).
export const rideTypeEnum = pgEnum('ride_type_enum', [
  'CABX_SAVER',
  'CABX',
  'CABXL',
  'COMFORT',
  'AUTO',
  'TWO_WHEELER',
]);

export const rideStatus = pgEnum('ride_status', [
  'REQUESTED',
  'MATCHING',
  'ACCEPTED',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const driverStatus = pgEnum('driver_status', ['ONLINE', 'OFFLINE', 'ON_RIDE']);

export const paymentStatus = pgEnum('payment_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REFUNDING',
  'REFUNDED',
]);

export const paymentMethod = pgEnum('payment_method', ['UPI', 'CASH', 'WALLET', 'CARD']);

export const cancellationReason = pgEnum('cancellation_reason', [
  'USER_CANCELLED',
  'DRIVER_CANCELLED',
  'NO_DRIVER_FOUND',
  'SYSTEM',
]);

export const outboxStatus = pgEnum('outbox_status', [
  'PENDING',
  'PROCESSING',
  'PUBLISHED',
  'FAILED',
]);

export const ledgerEntryType = pgEnum('ledger_entry_type', [
  'RIDE_EARNING',
  'COMMISSION_DEBIT',
  'SETTLEMENT_DEBIT',
  'SETTLEMENT_REVERSAL',
  'INCENTIVE_CREDIT',
  'PENALTY_DEBIT',
  'REFUND_ADJUSTMENT',
  'MANUAL_ADJUSTMENT',
  'TIP_CREDIT',
]);

export const settlementStatus = pgEnum('settlement_status', [
  'PENDING',
  'LEDGERED',
  'PAID',
  'FAILED',
  'CANCELLED',
]);

export const driverDocumentType = pgEnum('driver_document_type', [
  'DRIVING_LICENSE',
  'VEHICLE_REGISTRATION',
  'VEHICLE_INSURANCE',
  'VEHICLE_FITNESS',
  'VEHICLE_PERMIT',
  'POLLUTION_CERTIFICATE',
  'AADHAAR',
  'PAN',
  'PROFILE_PHOTO',
  'BANK_PROOF',
]);

export const documentStatus = pgEnum('document_status', [
  'PENDING',
  'IN_REVIEW',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
]);

export const rideStopStatus = pgEnum('ride_stop_status', [
  'PENDING',
  'ARRIVED',
  'COMPLETED',
  'SKIPPED',
]);

export const invoiceStatus = pgEnum('invoice_status', ['DRAFT', 'ISSUED', 'CANCELLED']);

export const incidentType = pgEnum('incident_type', [
  'ACCIDENT',
  'HARASSMENT',
  'FRAUD',
  'PROPERTY_DAMAGE',
  'ROUTE_DEVIATION',
  'OVERCHARGE',
  'VEHICLE_MISMATCH',
  'RUDE_BEHAVIOUR',
  'LOST_ITEM',
  'OTHER',
]);

export const incidentStatus = pgEnum('incident_status', [
  'OPEN',
  'TRIAGED',
  'INVESTIGATING',
  'RESOLVED',
  'DISMISSED',
]);

export const incidentSeverity = pgEnum('incident_severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const devicePlatform = pgEnum('device_platform', ['ANDROID', 'IOS', 'WEB']);

export const notificationType = pgEnum('notification_type', [
  'RIDE_UPDATE',
  'PAYMENT',
  'PROMO',
  'SAFETY',
  'INCENTIVE',
  'DOCUMENT',
  'SETTLEMENT',
  'SYSTEM',
]);

// INACTIVE = user-initiated pause (self-deactivation); SUSPENDED = admin-imposed for a
// violation. Both block authentication the same way.
export const accountStatus = pgEnum('account_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BANNED',
  'DELETED',
]);

export const areaType = pgEnum('area_type', [
  'CITY_BOUNDARY',
  'AIRPORT',
  'RAILWAY_STATION',
  'RESTRICTED_PICKUP',
  'RESTRICTED_DROPOFF',
  'SURGE_ZONE',
  'DRIVER_QUEUE',
  'TOLL_ZONE',
]);

export const incentiveStatus = pgEnum('incentive_status', [
  'ACTIVE',
  'ACHIEVED',
  'PAID',
  'EXPIRED',
  'CANCELLED',
]);

export const referralStatus = pgEnum('referral_status', [
  'PENDING',
  'QUALIFIED',
  'REWARDED',
  'REJECTED',
]);

export const poolStatus = pgEnum('pool_status', [
  'FORMING',
  'LOCKED',
  'DISPATCHED',
  'COMPLETED',
  'CANCELLED',
]);

export const joinStatus = pgEnum('join_status', ['PENDING', 'CONFIRMED', 'REMOVED']);

export const groupType = pgEnum('group_type', ['PUBLIC', 'PRIVATE', 'COMMUNITY', 'CORPORATE']);

export const groupRole = pgEnum('group_role', ['ADMIN', 'MEMBER']);
