-- ============================================
-- MANUAL STAGING MIGRATION
-- Date: 2025-10-10
-- Description: Add agent registration, brand ambassadors, 
--              and enhanced tracking features
-- ============================================
-- IMPORTANT: Review this script before running on staging!
-- This migration is designed to be run on Supabase
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: CREATE NEW ENUMS
-- ============================================

-- Registration Status Enum
DO $$ BEGIN
    CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Registration Missing Status Enum
DO $$ BEGIN
    CREATE TYPE "RegistrationMissingStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Registration Entity Kind Enum
DO $$ BEGIN
    CREATE TYPE "RegistrationEntityKind" AS ENUM ('CUSTOMER', 'SPOUSE', 'CHILD', 'BENEFICIARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BA Payout Status Enum
DO $$ BEGIN
    CREATE TYPE "BAPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- STEP 2: CREATE NEW TABLES
-- ============================================

-- Brand Ambassadors Table
CREATE TABLE IF NOT EXISTS "brand_ambassadors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "phoneNumber" VARCHAR(20),
    "perRegistrationRateCents" INTEGER NOT NULL DEFAULT 500,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_ambassadors_pkey" PRIMARY KEY ("id")
);

-- Create unique index on userId if not exists
DO $$ BEGIN
    CREATE UNIQUE INDEX "brand_ambassadors_userId_key" ON "brand_ambassadors"("userId");
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Agent Registrations Table
CREATE TABLE IF NOT EXISTS "agent_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "baId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_registrations_pkey" PRIMARY KEY ("id")
);

-- Missing Requirements Table
CREATE TABLE IF NOT EXISTS "missing_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "registrationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "entityKind" "RegistrationEntityKind" NOT NULL,
    "entityId" UUID,
    "fieldPath" TEXT NOT NULL,
    "status" "RegistrationMissingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missing_requirements_pkey" PRIMARY KEY ("id")
);

-- Deferred Requirements Default Table
CREATE TABLE IF NOT EXISTS "deferred_requirements_default" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityKind" "RegistrationEntityKind" NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deferred_requirements_default_pkey" PRIMARY KEY ("id")
);

-- Create unique index if not exists
DO $$ BEGIN
    CREATE UNIQUE INDEX "deferred_requirements_default_entityKind_fieldPath_key" 
    ON "deferred_requirements_default"("entityKind", "fieldPath");
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Deferred Requirements Partner Table
CREATE TABLE IF NOT EXISTS "deferred_requirements_partner" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partnerId" INTEGER NOT NULL,
    "entityKind" "RegistrationEntityKind" NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deferred_requirements_partner_pkey" PRIMARY KEY ("id")
);

-- Create unique index if not exists
DO $$ BEGIN
    CREATE UNIQUE INDEX "deferred_requirements_partner_partnerId_entityKind_fieldPath_key" 
    ON "deferred_requirements_partner"("partnerId", "entityKind", "fieldPath");
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- BA Payouts Table
CREATE TABLE IF NOT EXISTS "ba_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "baId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "registrationId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "BAPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutDate" TIMESTAMP(3),
    "transactionReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ba_payouts_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 3: ALTER EXISTING TABLES
-- ============================================

-- Add new columns to customers table
ALTER TABLE "customers" 
    ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "hasMissingRequirements" BOOLEAN NOT NULL DEFAULT false;

-- Make email nullable in customers table (if not already)
ALTER TABLE "customers" 
    ALTER COLUMN "email" DROP NOT NULL;

-- Add new columns to beneficiaries table
ALTER TABLE "beneficiaries"
    ADD COLUMN IF NOT EXISTS "email" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "relationshipDescription" TEXT;

-- Add new columns to dependants table
ALTER TABLE "dependants"
    ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;

-- ============================================
-- STEP 4: CREATE INDEXES
-- ============================================

-- Customers unique index on idType and idNumber
DO $$ BEGIN
    CREATE UNIQUE INDEX "customers_idType_idNumber_key" ON "customers"("idType", "idNumber");
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- ============================================
-- STEP 5: ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Brand Ambassadors foreign key to partners
DO $$ BEGIN
    ALTER TABLE "brand_ambassadors" 
    ADD CONSTRAINT "brand_ambassadors_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent Registrations foreign keys
DO $$ BEGIN
    ALTER TABLE "agent_registrations" 
    ADD CONSTRAINT "agent_registrations_baId_fkey" 
    FOREIGN KEY ("baId") REFERENCES "brand_ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "agent_registrations" 
    ADD CONSTRAINT "agent_registrations_customerId_fkey" 
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "agent_registrations" 
    ADD CONSTRAINT "agent_registrations_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Missing Requirements foreign keys
DO $$ BEGIN
    ALTER TABLE "missing_requirements" 
    ADD CONSTRAINT "missing_requirements_registrationId_fkey" 
    FOREIGN KEY ("registrationId") REFERENCES "agent_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "missing_requirements" 
    ADD CONSTRAINT "missing_requirements_customerId_fkey" 
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "missing_requirements" 
    ADD CONSTRAINT "missing_requirements_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Deferred Requirements Partner foreign key
DO $$ BEGIN
    ALTER TABLE "deferred_requirements_partner" 
    ADD CONSTRAINT "deferred_requirements_partner_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BA Payouts foreign keys
DO $$ BEGIN
    ALTER TABLE "ba_payouts" 
    ADD CONSTRAINT "ba_payouts_baId_fkey" 
    FOREIGN KEY ("baId") REFERENCES "brand_ambassadors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ba_payouts" 
    ADD CONSTRAINT "ba_payouts_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ba_payouts" 
    ADD CONSTRAINT "ba_payouts_registrationId_fkey" 
    FOREIGN KEY ("registrationId") REFERENCES "agent_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- STEP 6: INSERT DEFAULT DATA (OPTIONAL)
-- ============================================

-- Insert default deferred requirements
INSERT INTO "deferred_requirements_default" ("id", "entityKind", "fieldPath", "createdAt", "updatedAt")
VALUES 
    (gen_random_uuid(), 'SPOUSE', 'dateOfBirth', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPOUSE', 'idNumber', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CHILD', 'dateOfBirth', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CHILD', 'idNumber', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'BENEFICIARY', 'dateOfBirth', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'BENEFICIARY', 'idNumber', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("entityKind", "fieldPath") DO NOTHING;

-- ============================================
-- STEP 7: CREATE MIGRATION RECORD
-- ============================================

-- Create prisma migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Record this migration
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES (
    gen_random_uuid()::text,
    'manual_staging_migration_20251010',
    CURRENT_TIMESTAMP,
    'manual_staging_migration_20251010',
    'Manual migration for agent registration and brand ambassador features',
    NULL,
    CURRENT_TIMESTAMP,
    1
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify success:
--
-- -- Check new tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('brand_ambassadors', 'agent_registrations', 'ba_payouts', 'missing_requirements');
--
-- -- Check new columns in customers
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'customers'
-- AND column_name IN ('createdBy', 'updatedBy', 'hasMissingRequirements');
--
-- -- Check new columns in beneficiaries
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'beneficiaries'
-- AND column_name IN ('email', 'phoneNumber', 'isVerified', 'verifiedAt', 'verifiedBy');
--
-- -- Check enums
-- SELECT typname FROM pg_type WHERE typtype = 'e' AND typname LIKE '%Registration%';
-- ============================================

