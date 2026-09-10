CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('RIDER', 'DRIVER', 'ADMIN');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"deviceInfo" varchar,
	"revokedAt" timestamp,
	"rotatedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phoneNumber" varchar(15) NOT NULL,
	"email" varchar,
	"firstName" varchar,
	"lastName" varchar,
	"profileImageUrl" varchar,
	"role" "user_role" DEFAULT 'RIDER' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.0' NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"accountStatus" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"suspendedUntil" timestamp,
	"moderationReason" text,
	"ratingCount" integer DEFAULT 0 NOT NULL,
	"referralCode" varchar(16),
	"gender" varchar(20),
	"emergencyContactName" varchar(100),
	"emergencyContactPhone" varchar(15),
	"registeredVia" varchar(20) DEFAULT 'CONSUMER_APP' NOT NULL,
	"preferredLanguage" varchar(12),
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phoneNumber_unique" UNIQUE("phoneNumber"),
	CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"serviceCode" varchar(32) NOT NULL,
	"membershipRole" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_memberships" ADD CONSTRAINT "service_memberships_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_userId" ON "refresh_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_users_account_status" ON "users" USING btree ("accountStatus") WHERE "users"."accountStatus" <> 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_service_memberships_user_service_role" ON "service_memberships" USING btree ("userId","serviceCode","membershipRole");