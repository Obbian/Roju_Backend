CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."area_type" AS ENUM('CITY_BOUNDARY', 'AIRPORT', 'RAILWAY_STATION', 'RESTRICTED_PICKUP', 'RESTRICTED_DROPOFF', 'SURGE_ZONE', 'DRIVER_QUEUE', 'TOLL_ZONE');--> statement-breakpoint
CREATE TYPE "public"."cancellation_reason" AS ENUM('USER_CANCELLED', 'DRIVER_CANCELLED', 'NO_DRIVER_FOUND', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'IOS', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."driver_document_type" AS ENUM('DRIVING_LICENSE', 'VEHICLE_REGISTRATION', 'VEHICLE_INSURANCE', 'VEHICLE_FITNESS', 'VEHICLE_PERMIT', 'POLLUTION_CERTIFICATE', 'AADHAAR', 'PAN', 'PROFILE_PHOTO', 'BANK_PROOF');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('ONLINE', 'OFFLINE', 'ON_RIDE');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('PUBLIC', 'PRIVATE', 'COMMUNITY', 'CORPORATE');--> statement-breakpoint
CREATE TYPE "public"."incentive_status" AS ENUM('ACTIVE', 'ACHIEVED', 'PAID', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'TRIAGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('ACCIDENT', 'HARASSMENT', 'FRAUD', 'PROPERTY_DAMAGE', 'ROUTE_DEVIATION', 'OVERCHARGE', 'VEHICLE_MISMATCH', 'RUDE_BEHAVIOUR', 'LOST_ITEM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."join_status" AS ENUM('PENDING', 'CONFIRMED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('RIDE_EARNING', 'COMMISSION_DEBIT', 'SETTLEMENT_DEBIT', 'SETTLEMENT_REVERSAL', 'INCENTIVE_CREDIT', 'PENALTY_DEBIT', 'REFUND_ADJUSTMENT', 'MANUAL_ADJUSTMENT', 'TIP_CREDIT');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('RIDE_UPDATE', 'PAYMENT', 'PROMO', 'SAFETY', 'INCENTIVE', 'DOCUMENT', 'SETTLEMENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('UPI', 'CASH', 'WALLET', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDING', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."pool_status" AS ENUM('FORMING', 'LOCKED', 'DISPATCHED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('REQUESTED', 'MATCHING', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ride_stop_status" AS ENUM('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."ride_type_enum" AS ENUM('CABX_SAVER', 'CABX', 'CABXL', 'COMFORT', 'AUTO', 'TWO_WHEELER');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('PENDING', 'LEDGERED', 'PAID', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('RIDER', 'DRIVER', 'ADMIN');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_versions" (
	"scope" varchar(50) PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"licenseNumber" varchar(50) NOT NULL,
	"vehicleRegistration" varchar(50) NOT NULL,
	"vehicleModel" varchar(100),
	"vehicleColor" varchar(20),
	"vehicleType" varchar(32) NOT NULL,
	"status" "driver_status" DEFAULT 'OFFLINE' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.0' NOT NULL,
	"totalRides" integer DEFAULT 0 NOT NULL,
	"completionRate" numeric(5, 2) DEFAULT '100.0' NOT NULL,
	"acceptanceRate" numeric(5, 2) DEFAULT '100.0' NOT NULL,
	"offersReceivedCount" integer DEFAULT 0 NOT NULL,
	"offersAcceptedCount" integer DEFAULT 0 NOT NULL,
	"languages" varchar(10)[],
	"isNeverCancelBadge" boolean DEFAULT false NOT NULL,
	"isTopDriverBadge" boolean DEFAULT false NOT NULL,
	"badgesCheckedAt" timestamp,
	"walletBalance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"walletBalancePaise" integer DEFAULT 0 NOT NULL,
	"bankAccount" varchar(20),
	"upiId" varchar,
	"isComplianceVerified" boolean DEFAULT false NOT NULL,
	"complianceCheckedAt" timestamp,
	"activeVehicleId" uuid,
	"lastLocationUpdateAt" timestamp,
	"onlineSince" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_licenseNumber_unique" UNIQUE("licenseNumber"),
	CONSTRAINT "drivers_vehicleRegistration_unique" UNIQUE("vehicleRegistration")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fare_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(50) NOT NULL,
	"rideType" varchar(32) NOT NULL,
	"baseFare" numeric(10, 2) DEFAULT '50' NOT NULL,
	"perKmRate" numeric(10, 2) DEFAULT '10' NOT NULL,
	"perMinuteRate" numeric(10, 2) DEFAULT '1' NOT NULL,
	"surgeMultiplier" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"minimumFare" numeric(10, 2) DEFAULT '20' NOT NULL,
	"commissionRate" numeric(3, 2) DEFAULT '0.25' NOT NULL,
	"gstRatePercent" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"perExtraStopFare" numeric(10, 2) DEFAULT '0' NOT NULL,
	"perWaitingMinuteFare" numeric(10, 2) DEFAULT '0' NOT NULL,
	"freeWaitingMinutes" integer DEFAULT 5 NOT NULL,
	"nightSurchargeFare" numeric(10, 2) DEFAULT '0' NOT NULL,
	"nightStartHour" integer DEFAULT 23 NOT NULL,
	"nightEndHour" integer DEFAULT 5 NOT NULL,
	"outstationPerKmRatePaise" integer,
	"outstationDriverAllowancePerDayPaise" integer,
	"airportSurchargePaise" integer,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_catalog" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"scope" varchar(50) DEFAULT 'global' NOT NULL,
	"message" jsonb NOT NULL,
	"description" varchar(256),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(100) NOT NULL,
	"type" varchar(100) NOT NULL,
	"aggregateType" varchar(50) NOT NULL,
	"aggregateId" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"retriedAt" timestamp,
	"retriedBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rideId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"method" "payment_method" DEFAULT 'UPI' NOT NULL,
	"gateway" varchar(50) DEFAULT 'RAZORPAY' NOT NULL,
	"gatewayOrderId" varchar(255),
	"gatewayPaymentId" varchar(255),
	"failureReason" varchar,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"refundedAmountPaise" integer DEFAULT 0 NOT NULL,
	"paidAt" timestamp,
	"refundedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"discountPercent" numeric(5, 2) NOT NULL,
	"maxDiscount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"maxUsesPerUser" integer DEFAULT 1 NOT NULL,
	"validFrom" timestamp,
	"validUntil" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(50) NOT NULL,
	"ride_type" varchar(32) NOT NULL,
	"tier_name" varchar(32) NOT NULL,
	"duration_hours" integer NOT NULL,
	"included_km" integer NOT NULL,
	"package_price_paise" integer NOT NULL,
	"extra_km_rate_paise" integer NOT NULL,
	"extra_hour_rate_paise" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"service_id" uuid NOT NULL,
	"display_name" jsonb NOT NULL,
	"description" jsonb,
	"icon_url" varchar(512),
	"thumbnail_url" varchar(512),
	"capacity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vehicle_class" varchar(32),
	"eta_factor" numeric(4, 2) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ride_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_category_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_category_id" uuid NOT NULL,
	"city" varchar(50) NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"riderId" uuid NOT NULL,
	"driverId" uuid,
	"rideType" varchar(32) NOT NULL,
	"status" "ride_status" DEFAULT 'REQUESTED' NOT NULL,
	"pickupLat" double precision NOT NULL,
	"pickupLon" double precision NOT NULL,
	"pickupAddress" varchar,
	"dropoffLat" double precision NOT NULL,
	"dropoffLon" double precision NOT NULL,
	"dropoffAddress" varchar,
	"city" varchar(50) DEFAULT 'Delhi' NOT NULL,
	"estimatedFare" numeric(10, 2) NOT NULL,
	"totalFare" numeric(10, 2),
	"surgeMultiplier" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"distanceKm" numeric(10, 2) DEFAULT '0' NOT NULL,
	"durationMin" integer DEFAULT 0 NOT NULL,
	"etaMinutes" integer,
	"etaUpdatedAt" timestamp,
	"stopCount" integer DEFAULT 0 NOT NULL,
	"promoCode" varchar,
	"promoDiscount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"paymentMethod" "payment_method" DEFAULT 'UPI' NOT NULL,
	"acceptedAt" timestamp,
	"arrivedAt" timestamp,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"cancellationReason" "cancellation_reason",
	"cancellationFee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"riderRating" integer,
	"driverRating" integer,
	"passengerName" varchar(100),
	"passengerPhone" varchar(15),
	"rentalPackageId" uuid,
	"outstationPlannedDistanceKm" numeric(10, 2),
	"outstationDriverAllowanceDays" integer,
	"bookingChannel" varchar(10) DEFAULT 'HUMAN' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"rideId" uuid,
	"sessionId" varchar(64),
	"trigger" varchar(32) NOT NULL,
	"locationLat" numeric(10, 7),
	"locationLon" numeric(10, 7),
	"source" varchar(32) DEFAULT 'rider_app' NOT NULL,
	"status" varchar(24) DEFAULT 'OPEN' NOT NULL,
	"acknowledgedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"label" varchar(50) NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"address" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_rides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"riderId" uuid NOT NULL,
	"rideId" uuid,
	"pickupLat" double precision NOT NULL,
	"pickupLon" double precision NOT NULL,
	"dropoffLat" double precision NOT NULL,
	"dropoffLon" double precision NOT NULL,
	"rideType" varchar(32) NOT NULL,
	"city" varchar(50) DEFAULT 'Delhi' NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"bookingChannel" varchar(10) DEFAULT 'HUMAN' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"display_name" jsonb NOT NULL,
	"icon_url" varchar(512),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
	"financialYear" varchar(9) NOT NULL,
	"series" varchar(16) NOT NULL,
	"lastNumber" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rideId" uuid NOT NULL,
	"invoiceNumber" varchar(32) NOT NULL,
	"financialYear" varchar(9) NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"taxableValuePaise" integer NOT NULL,
	"cgstPaise" integer DEFAULT 0 NOT NULL,
	"sgstPaise" integer DEFAULT 0 NOT NULL,
	"igstPaise" integer DEFAULT 0 NOT NULL,
	"totalPaise" integer NOT NULL,
	"gstRatePercent" numeric(5, 2) NOT NULL,
	"sacCode" varchar(8) DEFAULT '996422' NOT NULL,
	"sellerGstin" varchar(15),
	"sellerLegalName" varchar(160),
	"buyerGstin" varchar(15),
	"buyerLegalName" varchar(160),
	"placeOfSupply" varchar(64),
	"pdfUrl" varchar(512),
	"issuedAt" timestamp,
	"cancelledAt" timestamp,
	"cancellationReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_rideId_unique" UNIQUE("rideId"),
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_fare_breakdown" (
	"rideId" uuid PRIMARY KEY NOT NULL,
	"basePaise" integer DEFAULT 0 NOT NULL,
	"distancePaise" integer DEFAULT 0 NOT NULL,
	"timePaise" integer DEFAULT 0 NOT NULL,
	"surgePaise" integer DEFAULT 0 NOT NULL,
	"waitingPaise" integer DEFAULT 0 NOT NULL,
	"tollPaise" integer DEFAULT 0 NOT NULL,
	"nightPaise" integer DEFAULT 0 NOT NULL,
	"extraStopPaise" integer DEFAULT 0 NOT NULL,
	"airportSurchargePaise" integer DEFAULT 0 NOT NULL,
	"tipPaise" integer DEFAULT 0 NOT NULL,
	"promoDiscountPaise" integer DEFAULT 0 NOT NULL,
	"cancellationFeePaise" integer DEFAULT 0 NOT NULL,
	"subtotalPaise" integer DEFAULT 0 NOT NULL,
	"taxPaise" integer DEFAULT 0 NOT NULL,
	"totalPaise" integer DEFAULT 0 NOT NULL,
	"driverEarningPaise" integer DEFAULT 0 NOT NULL,
	"commissionPaise" integer DEFAULT 0 NOT NULL,
	"surgeMultiplier" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"fareConfigId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driverId" uuid NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"rideCount" integer DEFAULT 0 NOT NULL,
	"grossPaise" integer DEFAULT 0 NOT NULL,
	"commissionPaise" integer DEFAULT 0 NOT NULL,
	"incentivePaise" integer DEFAULT 0 NOT NULL,
	"penaltyPaise" integer DEFAULT 0 NOT NULL,
	"netPayoutPaise" integer DEFAULT 0 NOT NULL,
	"commissionPercent" numeric(5, 2) NOT NULL,
	"status" "settlement_status" DEFAULT 'PENDING' NOT NULL,
	"payoutReference" varchar(128),
	"payoutMode" varchar(16),
	"failureReason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"ledgeredAt" timestamp,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"driverId" uuid NOT NULL,
	"entryType" "ledger_entry_type" NOT NULL,
	"amountPaise" integer NOT NULL,
	"balanceBeforePaise" integer NOT NULL,
	"balanceAfterPaise" integer NOT NULL,
	"referenceType" varchar(32),
	"referenceId" uuid,
	"idempotencyKey" varchar(160) NOT NULL,
	"reason" text,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_ledger_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driverId" uuid NOT NULL,
	"vehicleId" uuid,
	"documentType" "driver_document_type" NOT NULL,
	"status" "document_status" DEFAULT 'PENDING' NOT NULL,
	"storageKey" varchar(512) NOT NULL,
	"documentNumber" varchar(64),
	"issuedAt" timestamp,
	"expiresAt" timestamp,
	"verifiedBy" uuid,
	"verifiedAt" timestamp,
	"rejectionReason" text,
	"submissionCount" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driverId" uuid NOT NULL,
	"registrationNumber" varchar(32) NOT NULL,
	"vehicleType" "ride_type_enum" NOT NULL,
	"make" varchar(64),
	"model" varchar(64),
	"color" varchar(32),
	"manufactureYear" integer,
	"seatingCapacity" integer,
	"insuranceExpiresAt" timestamp,
	"fitnessExpiresAt" timestamp,
	"permitExpiresAt" timestamp,
	"pucExpiresAt" timestamp,
	"isVerified" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"retiredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "driver_vehicles_registrationNumber_unique" UNIQUE("registrationNumber")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rideId" uuid NOT NULL,
	"fromUserId" uuid NOT NULL,
	"toUserId" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"tags" varchar(32)[],
	"isFlagged" boolean DEFAULT false NOT NULL,
	"moderationNote" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- TODO(partitioning): PARTITION BY RANGE ("recordedAt") daily, per src/db/schema/trips.ts note.
-- Left as a plain table for now; convert once retention/partition-count policy is decided.
CREATE TABLE IF NOT EXISTS "ride_route_points" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"rideId" uuid NOT NULL,
	"driverId" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"speedKmph" numeric(6, 2),
	"headingDegrees" smallint,
	"accuracyMetres" smallint,
	"recordedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rideId" uuid NOT NULL,
	"stopOrder" smallint NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"address" varchar(512),
	"status" "ride_stop_status" DEFAULT 'PENDING' NOT NULL,
	"waitingMinutes" integer DEFAULT 0 NOT NULL,
	"arrivedAt" timestamp,
	"departedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actorUserId" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"targetType" varchar(32) NOT NULL,
	"targetId" varchar(191),
	"reason" text,
	"metadata" jsonb,
	"requestId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cancellation_penalties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"rideId" uuid NOT NULL,
	"role" varchar(8) NOT NULL,
	"reason" "cancellation_reason" NOT NULL,
	"offenceIndex" integer DEFAULT 1 NOT NULL,
	"penaltyPaise" integer DEFAULT 0 NOT NULL,
	"minutesSinceRequest" numeric(8, 2) DEFAULT '0' NOT NULL,
	"isWaived" boolean DEFAULT false NOT NULL,
	"waivedReason" text,
	"waivedByUserId" uuid,
	"waivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" varchar(64),
	"area_type" varchar(20) DEFAULT 'RESTRICTED' NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"radius_m" integer DEFAULT 500 NOT NULL,
	"reason" varchar(256),
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(16) NOT NULL,
	"rideId" uuid,
	"reportedByUserId" uuid NOT NULL,
	"againstUserId" uuid,
	"incidentType" "incident_type" NOT NULL,
	"severity" "incident_severity" DEFAULT 'MEDIUM' NOT NULL,
	"status" "incident_status" DEFAULT 'OPEN' NOT NULL,
	"description" text NOT NULL,
	"attachmentKeys" varchar(512)[],
	"assignedToUserId" uuid,
	"resolution" text,
	"compensationPaise" integer DEFAULT 0 NOT NULL,
	"resolvedByUserId" uuid,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processed_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(32) NOT NULL,
	"eventId" varchar(191) NOT NULL,
	"eventType" varchar(96),
	"referenceType" varchar(32),
	"referenceId" uuid,
	"payloadDigest" varchar(64),
	"metadata" jsonb,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"notificationType" "notification_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"referenceType" varchar(32),
	"referenceId" uuid,
	"readAt" timestamp,
	"pushedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"deviceId" varchar(128) NOT NULL,
	"platform" "device_platform" NOT NULL,
	"pushToken" varchar(512),
	"appVersion" varchar(24),
	"osVersion" varchar(24),
	"deviceModel" varchar(64),
	"locale" varchar(12),
	"isPushEnabled" boolean DEFAULT true NOT NULL,
	"pushFailureCount" integer DEFAULT 0 NOT NULL,
	"lastActiveAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_incentives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driverId" uuid NOT NULL,
	"incentiveType" varchar(32) NOT NULL,
	"title" varchar(160) NOT NULL,
	"targetRides" integer DEFAULT 0 NOT NULL,
	"completedRides" integer DEFAULT 0 NOT NULL,
	"targetEarningsPaise" integer DEFAULT 0 NOT NULL,
	"achievedEarningsPaise" integer DEFAULT 0 NOT NULL,
	"bonusPaise" integer DEFAULT 0 NOT NULL,
	"status" "incentive_status" DEFAULT 'ACTIVE' NOT NULL,
	"city" varchar(50),
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"achievedAt" timestamp,
	"paidAt" timestamp,
	"ledgerEntryId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"ownerUserId" uuid NOT NULL,
	"targetRole" "user_role" DEFAULT 'RIDER' NOT NULL,
	"refereeRewardPaise" integer DEFAULT 0 NOT NULL,
	"referrerRewardPaise" integer DEFAULT 0 NOT NULL,
	"qualifyingRides" integer DEFAULT 1 NOT NULL,
	"maxRedemptions" integer DEFAULT 0 NOT NULL,
	"redemptionCount" integer DEFAULT 0 NOT NULL,
	"validFrom" timestamp,
	"validUntil" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referralCodeId" uuid NOT NULL,
	"referrerUserId" uuid NOT NULL,
	"refereeUserId" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'PENDING' NOT NULL,
	"qualifyingRidesCompleted" integer DEFAULT 0 NOT NULL,
	"qualifyingRideId" uuid,
	"referrerRewardPaise" integer DEFAULT 0 NOT NULL,
	"refereeRewardPaise" integer DEFAULT 0 NOT NULL,
	"rejectionReason" text,
	"qualifiedAt" timestamp,
	"rewardedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_redemptions_refereeUserId_unique" UNIQUE("refereeUserId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(96) NOT NULL,
	"areaType" "area_type" NOT NULL,
	"city" varchar(50) NOT NULL,
	"boundary" geography(Polygon, 4326) NOT NULL,
	"surchargePaise" integer DEFAULT 0 NOT NULL,
	"minSurgeMultiplier" numeric(3, 2),
	"isRestricted" boolean DEFAULT false NOT NULL,
	"restrictionMessage" text,
	"priority" smallint DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- TODO(partitioning): PARTITION BY RANGE ("computedAt") monthly, per src/db/schema/geo.ts note.
-- Left as a plain table for now; convert once retention/partition-count policy is decided.
CREATE TABLE IF NOT EXISTS "surge_zones_history" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(50) NOT NULL,
	"h3Cell" varchar(20) NOT NULL,
	"surgeMultiplier" numeric(3, 2) NOT NULL,
	"demandCount" integer DEFAULT 0 NOT NULL,
	"supplyCount" integer DEFAULT 0 NOT NULL,
	"demandSupplyRatio" numeric(8, 3) DEFAULT '0' NOT NULL,
	"computedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role" "group_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "group_type" DEFAULT 'PUBLIC' NOT NULL,
	"owner_id" varchar(36) NOT NULL,
	"name" varchar(128) NOT NULL,
	"city" varchar(50),
	"is_group_pool_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_category_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_code" varchar(32) NOT NULL,
	"question" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_pool_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"ride_id" uuid,
	"rider_id" varchar(36) NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"share_fare_paise" integer DEFAULT 0 NOT NULL,
	"join_status" "join_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_code" varchar(32) NOT NULL,
	"city" varchar(50) NOT NULL,
	"status" "pool_status" DEFAULT 'FORMING' NOT NULL,
	"max_seats" integer DEFAULT 4 NOT NULL,
	"booked_seats" integer DEFAULT 0 NOT NULL,
	"origin_lat" double precision NOT NULL,
	"origin_lon" double precision NOT NULL,
	"dest_lat" double precision NOT NULL,
	"dest_lon" double precision NOT NULL,
	"corridor_polyline" text,
	"group_id" uuid,
	"window_start" timestamp,
	"window_end" timestamp,
	"total_fare_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_categories" ADD CONSTRAINT "ride_categories_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_category_cities" ADD CONSTRAINT "ride_category_cities_ride_category_id_ride_categories_id_fk" FOREIGN KEY ("ride_category_id") REFERENCES "public"."ride_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_driverId_drivers_userId_fk" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("userId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_rentalPackageId_rental_packages_id_fk" FOREIGN KEY ("rentalPackageId") REFERENCES "public"."rental_packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "safety_events" ADD CONSTRAINT "safety_events_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_rides" ADD CONSTRAINT "scheduled_rides_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_fare_breakdown" ADD CONSTRAINT "ride_fare_breakdown_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driverId_drivers_userId_fk" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("userId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_vehicles" ADD CONSTRAINT "driver_vehicles_driverId_drivers_userId_fk" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("userId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_reviews" ADD CONSTRAINT "ride_reviews_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_stops" ADD CONSTRAINT "ride_stops_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cancellation_penalties" ADD CONSTRAINT "cancellation_penalties_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_rideId_rides_id_fk" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_incentives" ADD CONSTRAINT "driver_incentives_driverId_drivers_userId_fk" FOREIGN KEY ("driverId") REFERENCES "public"."drivers"("userId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_incentives" ADD CONSTRAINT "driver_incentives_ledgerEntryId_wallet_ledger_id_fk" FOREIGN KEY ("ledgerEntryId") REFERENCES "public"."wallet_ledger"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referralCodeId_referral_codes_id_fk" FOREIGN KEY ("referralCodeId") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_qualifyingRideId_rides_id_fk" FOREIGN KEY ("qualifyingRideId") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pool_members" ADD CONSTRAINT "ride_pool_members_pool_id_ride_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."ride_pools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pool_members" ADD CONSTRAINT "ride_pool_members_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pools" ADD CONSTRAINT "ride_pools_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_drivers_status" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_drivers_matchable" ON "drivers" USING btree ("status","vehicleType") WHERE "drivers"."status" = 'ONLINE' AND "drivers"."isComplianceVerified" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_fare_configs_city" ON "fare_configs" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_fare_configs_lookup" ON "fare_configs" USING btree ("city","rideType") WHERE "fare_configs"."isActive" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_dispatch" ON "outbox_events" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregateType","aggregateId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_outbox_dlq" ON "outbox_events" USING btree ("createdAt") WHERE "outbox_events"."status" = 'FAILED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_payments_rideId" ON "payments" USING btree ("rideId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_payments_userId" ON "payments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_payments_gatewayOrderId" ON "payments" USING btree ("gatewayOrderId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_payments_pending" ON "payments" USING btree ("status","createdAt") WHERE "payments"."status" IN ('PENDING','PROCESSING');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rental_packages_city_type_tier" ON "rental_packages" USING btree ("city","ride_type","tier_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rental_packages_lookup" ON "rental_packages" USING btree ("city","ride_type") WHERE "rental_packages"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_categories_service" ON "ride_categories" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_categories_active_sort" ON "ride_categories" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ride_category_city" ON "ride_category_cities" USING btree ("ride_category_id","city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_category_cities_city" ON "ride_category_cities" USING btree ("city","is_available");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_riderId" ON "rides" USING btree ("riderId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_driverId" ON "rides" USING btree ("driverId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_status" ON "rides" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_rideType" ON "rides" USING btree ("rideType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_rider_status_created" ON "rides" USING btree ("riderId","status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_city_status_created" ON "rides" USING btree ("city","status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_driver_active" ON "rides" USING btree ("driverId","status") WHERE "rides"."status" IN ('ACCEPTED','ARRIVED','IN_PROGRESS');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_rides_settlement_sweep" ON "rides" USING btree ("driverId","completedAt") WHERE "rides"."status" = 'COMPLETED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_safety_events_created" ON "safety_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_safety_events_user_created" ON "safety_events" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_safety_events_open" ON "safety_events" USING btree ("status") WHERE "safety_events"."status" <> 'RESOLVED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_saved_locations_userId" ON "saved_locations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_scheduled_rides_due" ON "scheduled_rides" USING btree ("status","scheduledFor") WHERE "scheduled_rides"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_services_active_sort" ON "services" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_invoice_sequences_fy_series" ON "invoice_sequences" USING btree ("financialYear","series");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_invoices_fy_number" ON "invoices" USING btree ("financialYear","invoiceNumber");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_invoices_buyer_gstin" ON "invoices" USING btree ("buyerGstin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_invoices_issued" ON "invoices" USING btree ("issuedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_fare_breakdown_created" ON "ride_fare_breakdown" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_settlements_driver_period" ON "settlements" USING btree ("driverId","periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_settlements_status_created" ON "settlements" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_settlements_driver_created" ON "settlements" USING btree ("driverId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_wallet_ledger_driver_seq" ON "wallet_ledger" USING btree ("driverId","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_wallet_ledger_driver_created" ON "wallet_ledger" USING btree ("driverId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_wallet_ledger_reference" ON "wallet_ledger" USING btree ("referenceType","referenceId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_driver_documents_live_slot" ON "driver_documents" USING btree ("driverId","documentType","vehicleId") WHERE "driver_documents"."status" IN ('PENDING','IN_REVIEW','VERIFIED');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_documents_driver_status" ON "driver_documents" USING btree ("driverId","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_documents_review_queue" ON "driver_documents" USING btree ("createdAt") WHERE "driver_documents"."status" IN ('PENDING','IN_REVIEW');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_documents_expiry" ON "driver_documents" USING btree ("expiresAt") WHERE "driver_documents"."status" = 'VERIFIED' AND "driver_documents"."expiresAt" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_vehicles_driver" ON "driver_vehicles" USING btree ("driverId","isActive");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_vehicles_expiry" ON "driver_vehicles" USING btree ("insuranceExpiresAt") WHERE "driver_vehicles"."isActive" = true;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ride_reviews_ride_from" ON "ride_reviews" USING btree ("rideId","fromUserId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_reviews_to_user" ON "ride_reviews" USING btree ("toUserId","createdAt") WHERE "ride_reviews"."isFlagged" = false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_reviews_flagged" ON "ride_reviews" USING btree ("createdAt") WHERE "ride_reviews"."isFlagged" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_route_points_ride_time" ON "ride_route_points" USING btree ("rideId","recordedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ride_stops_ride_order" ON "ride_stops" USING btree ("rideId","stopOrder");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_stops_ride" ON "ride_stops" USING btree ("rideId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_admin_audit_actor_created" ON "admin_audit_log" USING btree ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_admin_audit_target" ON "admin_audit_log" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_admin_audit_created" ON "admin_audit_log" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cancellation_penalties_ride_user" ON "cancellation_penalties" USING btree ("rideId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_cancellation_penalties_user_window" ON "cancellation_penalties" USING btree ("userId","createdAt") WHERE "cancellation_penalties"."isWaived" = false;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incident_areas_active" ON "incident_areas" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incident_areas_location" ON "incident_areas" USING btree ("lat","lon");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incidents_open_queue" ON "incidents" USING btree ("severity","createdAt") WHERE "incidents"."status" IN ('OPEN','TRIAGED','INVESTIGATING');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incidents_ride" ON "incidents" USING btree ("rideId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incidents_against_user" ON "incidents" USING btree ("againstUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incidents_reporter" ON "incidents" USING btree ("reportedByUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_incidents_assignee" ON "incidents" USING btree ("assignedToUserId","status") WHERE "incidents"."assignedToUserId" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_processed_webhooks_source_event" ON "processed_webhooks" USING btree ("source","eventId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_processed_webhooks_processed" ON "processed_webhooks" USING btree ("processedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created" ON "notifications" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_notifications_unread" ON "notifications" USING btree ("userId") WHERE "notifications"."readAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_devices_user_device" ON "user_devices" USING btree ("userId","deviceId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_user_devices_pushable" ON "user_devices" USING btree ("userId") WHERE "user_devices"."isPushEnabled" = true AND "user_devices"."pushToken" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_user_devices_token" ON "user_devices" USING btree ("pushToken");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_driver_incentives_driver_type_period" ON "driver_incentives" USING btree ("driverId","incentiveType","periodStart");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_incentives_active" ON "driver_incentives" USING btree ("driverId","periodEnd") WHERE "driver_incentives"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_driver_incentives_payout" ON "driver_incentives" USING btree ("achievedAt") WHERE "driver_incentives"."status" = 'ACHIEVED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_referral_codes_owner" ON "referral_codes" USING btree ("ownerUserId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_referral_codes_active" ON "referral_codes" USING btree ("code") WHERE "referral_codes"."isActive" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_referral_redemptions_referrer" ON "referral_redemptions" USING btree ("referrerUserId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_referral_redemptions_payout" ON "referral_redemptions" USING btree ("status","qualifiedAt") WHERE "referral_redemptions"."status" = 'QUALIFIED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_areas_city_type" ON "areas" USING btree ("city","areaType") WHERE "areas"."isActive" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_areas_priority" ON "areas" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_surge_history_cell_time" ON "surge_zones_history" USING btree ("h3Cell","computedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_surge_history_city_time" ON "surge_zones_history" USING btree ("city","computedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_surge_history_cell_tick" ON "surge_zones_history" USING btree ("h3Cell","computedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_group_member" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_groups_owner" ON "groups" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pool_member" ON "ride_pool_members" USING btree ("pool_id","rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_pool_members_ride" ON "ride_pool_members" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_pools_status_city" ON "ride_pools" USING btree ("status","city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_ride_pools_group" ON "ride_pools" USING btree ("group_id");