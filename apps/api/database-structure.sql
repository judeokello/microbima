-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CustomerStatus" AS ENUM ('PENDING_KYC', 'KYC_VERIFIED', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "public"."OnboardingStep" AS ENUM ('BASIC_INFO', 'KYC_VERIFICATION', 'PLAN_SELECTION', 'PAYMENT_SETUP', 'ACTIVE');

-- CreateEnum
CREATE TYPE "public"."IdType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'ALIEN', 'BIRTH_CERTIFICATE', 'MILITARY');

-- CreateEnum
CREATE TYPE "public"."DependantRelationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "public"."KYCStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."KYCVerificationMethod" AS ENUM ('MANUAL', 'AUTOMATED', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "public"."PolicyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM');

-- CreateTable
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

-- CreateTable
CREATE TABLE "public"."partner_api_keys" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "public"."partner_customers" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "partnerCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" UUID NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "public"."dependants" (
    "id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "public"."beneficiaries" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "middleName" VARCHAR(50),
    "lastName" VARCHAR(50) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "idType" "public"."IdType" NOT NULL,
    "idNumber" VARCHAR(20) NOT NULL,
    "relationship" TEXT,
    "percentage" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "createdByPartnerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "public"."policies" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "public"."PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "premium" DECIMAL(10,2) NOT NULL,
    "frequency" "public"."PaymentFrequency" NOT NULL,
    "paymentCadence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_api_key_lookup" ON "public"."partner_api_keys"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "partner_api_keys_partnerId_isActive_key" ON "public"."partner_api_keys"("partnerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "partner_customers_partnerId_partnerCustomerId_key" ON "public"."partner_customers"("partnerId", "partnerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "public"."customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_idType_idNumber_key" ON "public"."customers"("idType", "idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_customerId_key" ON "public"."addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_customerId_key" ON "public"."onboarding_progress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_customerId_key" ON "public"."kyc_verifications"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_policyNumber_key" ON "public"."policies"("policyNumber");

-- AddForeignKey
ALTER TABLE "public"."partner_api_keys" ADD CONSTRAINT "partner_api_keys_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partner_contacts" ADD CONSTRAINT "partner_contacts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partner_customers" ADD CONSTRAINT "partner_customers_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partner_customers" ADD CONSTRAINT "partner_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dependants" ADD CONSTRAINT "dependants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."beneficiaries" ADD CONSTRAINT "beneficiaries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."onboarding_progress" ADD CONSTRAINT "onboarding_progress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kyc_verifications" ADD CONSTRAINT "kyc_verifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

