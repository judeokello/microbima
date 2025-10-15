-- ============================================
-- MICROBIMA CONSOLIDATED INIT MIGRATION
-- ============================================
-- Description: Complete database schema including:
--   - Core tables (partners, customers, policies, etc.)
--   - Partner API keys
--   - Bundled products
--   - Agent registration system (brand ambassadors, registrations, payouts)
--   - All field type optimizations (VARCHAR limits, UUID/SERIAL IDs)
-- Date: 2025-10-15
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: CREATE ALL ENUMS
-- ============================================

-- Core enums
CREATE TYPE "public"."CustomerStatus" AS ENUM ('PENDING_KYC', 'KYC_VERIFIED', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE "public"."OnboardingStep" AS ENUM ('BASIC_INFO', 'KYC_VERIFICATION', 'PLAN_SELECTION', 'PAYMENT_SETUP', 'ACTIVE');
CREATE TYPE "public"."IdType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'ALIEN', 'BIRTH_CERTIFICATE', 'MILITARY');
CREATE TYPE "public"."DependantRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER');
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "public"."KYCStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "public"."KYCVerificationMethod" AS ENUM ('MANUAL', 'AUTOMATED', 'THIRD_PARTY');
CREATE TYPE "public"."PolicyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED');
CREATE TYPE "public"."PaymentFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM');

-- Agent Registration enums
CREATE TYPE "public"."RegistrationEntityKind" AS ENUM ('CUSTOMER', 'SPOUSE', 'CHILD', 'BENEFICIARY');
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "public"."RegistrationMissingStatus" AS ENUM ('PENDING', 'RESOLVED', 'EXPIRED');
CREATE TYPE "public"."BAPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ============================================
-- STEP 2: CREATE CORE TABLES
-- ============================================

-- Partners
CREATE TABLE "public"."partners" (
    "id" SERIAL NOT NULL,
    "partnerName" TEXT NOT NULL,
    "website" TEXT,
    "officeLocation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- Partner API Keys
CREATE TABLE "public"."partner_api_keys" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- Partner Contacts
CREATE TABLE "public"."partner_contacts" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" VARCHAR(20) NOT NULL,
    "contactEmail" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id")
);

-- Partner Customers
CREATE TABLE "public"."partner_customers" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_customers_pkey" PRIMARY KEY ("id")
);

-- Customers
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firstName" VARCHAR(50) NOT NULL,
    "middleName" VARCHAR(50),
    "lastName" VARCHAR(50) NOT NULL,
    "email" TEXT,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "idType" "public"."IdType" NOT NULL,
    "idNumber" VARCHAR(20) NOT NULL,
    "status" "public"."CustomerStatus" NOT NULL DEFAULT 'PENDING_KYC',
    "onboardingStep" "public"."OnboardingStep" NOT NULL DEFAULT 'BASIC_INFO',
    "createdByPartnerId" INTEGER NOT NULL,
    "hasMissingRequirements" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- Addresses
CREATE TABLE "public"."addresses" (
    "id" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- Dependants
CREATE TABLE "public"."dependants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "middleName" VARCHAR(50),
    "lastName" VARCHAR(50) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "idType" "public"."IdType",
    "idNumber" VARCHAR(20),
    "relationship" "public"."DependantRelationship" NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "createdByPartnerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependants_pkey" PRIMARY KEY ("id")
);

-- Beneficiaries
CREATE TABLE "public"."beneficiaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customerId" UUID NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "middleName" VARCHAR(50),
    "lastName" VARCHAR(50) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "email" VARCHAR(100),
    "phoneNumber" VARCHAR(20),
    "idType" "public"."IdType" NOT NULL,
    "idNumber" VARCHAR(20) NOT NULL,
    "relationship" TEXT,
    "relationshipDescription" TEXT,
    "percentage" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "createdByPartnerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- Onboarding Progress
CREATE TABLE "public"."onboarding_progress" (
    "id" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "currentStep" "public"."OnboardingStep" NOT NULL,
    "completedSteps" "public"."OnboardingStep"[],
    "nextStep" "public"."OnboardingStep",
    "estimatedCompletion" TIMESTAMP(3),
    "basicInfoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "kycCompleted" BOOLEAN NOT NULL DEFAULT false,
    "planSelected" BOOLEAN NOT NULL DEFAULT false,
    "paymentSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- KYC Verifications
CREATE TABLE "public"."kyc_verifications" (
    "id" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "public"."KYCStatus" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "public"."KYCVerificationMethod" NOT NULL,
    "documents" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "providerReference" TEXT,
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- Policies
CREATE TABLE "public"."policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policyNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "public"."PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "premium" DECIMAL(10,2) NOT NULL,
    "frequency" "public"."PaymentFrequency" NOT NULL,
    "paymentCadence" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "bundled_product_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- Bundled Products
CREATE TABLE "public"."bundled_products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "bundled_products_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 3: CREATE AGENT REGISTRATION TABLES
-- ============================================

-- Brand Ambassadors
CREATE TABLE "public"."brand_ambassadors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" VARCHAR(20),
    "perRegistrationRateCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "brand_ambassadors_pkey" PRIMARY KEY ("id")
);

-- Agent Registrations
CREATE TABLE "public"."agent_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "baId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "registrationStatus" "public"."RegistrationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_registrations_pkey" PRIMARY KEY ("id")
);

-- Missing Requirements
CREATE TABLE "public"."missing_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "registrationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "entityKind" "public"."RegistrationEntityKind" NOT NULL,
    "entityId" TEXT,
    "fieldPath" TEXT NOT NULL,
    "status" "public"."RegistrationMissingStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_requirements_pkey" PRIMARY KEY ("id")
);

-- BA Payouts
CREATE TABLE "public"."ba_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "baId" UUID NOT NULL,
    "registrationId" UUID,
    "partnerId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "public"."BAPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutDate" TIMESTAMP(3),
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ba_payouts_pkey" PRIMARY KEY ("id")
);

-- Deferred Requirements Default
CREATE TABLE "public"."deferred_requirements_default" (
    "id" SERIAL NOT NULL,
    "entityKind" "public"."RegistrationEntityKind" NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deferred_requirements_default_pkey" PRIMARY KEY ("id")
);

-- Deferred Requirements Partner
CREATE TABLE "public"."deferred_requirements_partner" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "entityKind" "public"."RegistrationEntityKind" NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deferred_requirements_partner_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 4: CREATE INDEXES
-- ============================================

-- Partner API Keys indexes
CREATE INDEX "idx_api_key_lookup" ON "public"."partner_api_keys"("apiKey");
CREATE UNIQUE INDEX "partner_api_keys_partnerId_isActive_key" ON "public"."partner_api_keys"("partnerId", "isActive");

-- Partner Customers indexes
CREATE UNIQUE INDEX "partner_customers_partnerId_partnerCustomerId_key" ON "public"."partner_customers"("partnerId", "partnerCustomerId");

-- Customers indexes
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email");
CREATE UNIQUE INDEX "customers_idType_idNumber_key" ON "public"."customers"("idType", "idNumber");

-- Other unique indexes
CREATE UNIQUE INDEX "addresses_customerId_key" ON "public"."addresses"("customerId");
CREATE UNIQUE INDEX "onboarding_progress_customerId_key" ON "public"."onboarding_progress"("customerId");
CREATE UNIQUE INDEX "kyc_verifications_customerId_key" ON "public"."kyc_verifications"("customerId");
CREATE UNIQUE INDEX "policies_policyNumber_key" ON "public"."policies"("policyNumber");

-- Bundled Products indexes
CREATE INDEX "bundled_products_created_by_idx" ON "public"."bundled_products"("created_by");
CREATE INDEX "bundled_products_name_idx" ON "public"."bundled_products"("name");
CREATE INDEX "policies_bundled_product_id_idx" ON "public"."policies"("bundled_product_id");

-- Brand Ambassadors indexes
CREATE UNIQUE INDEX "brand_ambassadors_userId_key" ON "public"."brand_ambassadors"("userId");

-- Deferred Requirements indexes
CREATE UNIQUE INDEX "deferred_requirements_default_entityKind_fieldPath_key" ON "public"."deferred_requirements_default"("entityKind", "fieldPath");
CREATE UNIQUE INDEX "deferred_requirements_partner_partnerId_entityKind_fieldPat_key" ON "public"."deferred_requirements_partner"("partnerId", "entityKind", "fieldPath");

-- ============================================
-- STEP 5: CREATE FOREIGN KEYS
-- ============================================

-- Partner relationships
ALTER TABLE "public"."partner_api_keys" ADD CONSTRAINT "partner_api_keys_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."partner_contacts" ADD CONSTRAINT "partner_contacts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."partner_customers" ADD CONSTRAINT "partner_customers_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."partner_customers" ADD CONSTRAINT "partner_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer relationships
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."dependants" ADD CONSTRAINT "dependants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."beneficiaries" ADD CONSTRAINT "beneficiaries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."onboarding_progress" ADD CONSTRAINT "onboarding_progress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."kyc_verifications" ADD CONSTRAINT "kyc_verifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bundled Products relationships
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_bundled_product_id_fkey" FOREIGN KEY ("bundled_product_id") REFERENCES "public"."bundled_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Agent Registration relationships
ALTER TABLE "public"."brand_ambassadors" ADD CONSTRAINT "brand_ambassadors_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."agent_registrations" ADD CONSTRAINT "agent_registrations_baId_fkey" FOREIGN KEY ("baId") REFERENCES "public"."brand_ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."agent_registrations" ADD CONSTRAINT "agent_registrations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."agent_registrations" ADD CONSTRAINT "agent_registrations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."missing_requirements" ADD CONSTRAINT "missing_requirements_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."agent_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."missing_requirements" ADD CONSTRAINT "missing_requirements_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."missing_requirements" ADD CONSTRAINT "missing_requirements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."deferred_requirements_partner" ADD CONSTRAINT "deferred_requirements_partner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ba_payouts" ADD CONSTRAINT "ba_payouts_baId_fkey" FOREIGN KEY ("baId") REFERENCES "public"."brand_ambassadors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ba_payouts" ADD CONSTRAINT "ba_payouts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ba_payouts" ADD CONSTRAINT "ba_payouts_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."agent_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Run: npx ts-node prisma/seed-agent-registration.ts
--   2. Create admin user via bootstrap page
--   3. Run: psql $DATABASE_URL -f prisma/seed-bootstrap.sql
-- ============================================
