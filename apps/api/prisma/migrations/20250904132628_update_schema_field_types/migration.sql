/*
  Warnings:

  - The primary key for the `addresses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `addresses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `beneficiaries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `firstName` on the `beneficiaries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `middleName` on the `beneficiaries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `lastName` on the `beneficiaries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `idNumber` on the `beneficiaries` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `customers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `firstName` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `middleName` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `lastName` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `phoneNumber` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `idNumber` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `dependants` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `isBeneficiary` on the `dependants` table. All the data in the column will be lost.
  - You are about to alter the column `firstName` on the `dependants` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `middleName` on the `dependants` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `lastName` on the `dependants` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `idNumber` on the `dependants` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `kyc_verifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `kyc_verifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `onboarding_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `onboarding_progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `partner_api_keys` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `partner_api_keys` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `partner_contacts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `partner_contacts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `contactPhone` on the `partner_contacts` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The primary key for the `partner_customers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `partner_customers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `partners` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `partners` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `policies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `customerId` on the `addresses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `beneficiaries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `beneficiaries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdByPartnerId` on the `beneficiaries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `customers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdByPartnerId` on the `customers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `dependants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `dependants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdByPartnerId` on the `dependants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `kyc_verifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `onboarding_progress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `partnerId` on the `partner_api_keys` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `partnerId` on the `partner_contacts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `partnerId` on the `partner_customers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `partner_customers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `policies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `customerId` on the `policies` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."beneficiaries" DROP CONSTRAINT "beneficiaries_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."dependants" DROP CONSTRAINT "dependants_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."kyc_verifications" DROP CONSTRAINT "kyc_verifications_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."onboarding_progress" DROP CONSTRAINT "onboarding_progress_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."partner_api_keys" DROP CONSTRAINT "partner_api_keys_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."partner_contacts" DROP CONSTRAINT "partner_contacts_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."partner_customers" DROP CONSTRAINT "partner_customers_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."partner_customers" DROP CONSTRAINT "partner_customers_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."policies" DROP CONSTRAINT "policies_customerId_fkey";

-- AlterTable
ALTER TABLE "public"."addresses" DROP CONSTRAINT "addresses_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."beneficiaries" DROP CONSTRAINT "beneficiaries_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "middleName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "dateOfBirth" SET DATA TYPE DATE,
ALTER COLUMN "idNumber" SET DATA TYPE VARCHAR(20),
DROP COLUMN "createdByPartnerId",
ADD COLUMN     "createdByPartnerId" INTEGER NOT NULL,
ADD CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "middleName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "phoneNumber" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "dateOfBirth" SET DATA TYPE DATE,
ALTER COLUMN "idNumber" SET DATA TYPE VARCHAR(20),
DROP COLUMN "createdByPartnerId",
ADD COLUMN     "createdByPartnerId" INTEGER NOT NULL,
ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."dependants" DROP CONSTRAINT "dependants_pkey",
DROP COLUMN "isBeneficiary",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "middleName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "dateOfBirth" SET DATA TYPE DATE,
DROP COLUMN "createdByPartnerId",
ADD COLUMN     "createdByPartnerId" INTEGER NOT NULL,
ALTER COLUMN "idNumber" SET DATA TYPE VARCHAR(20),
ADD CONSTRAINT "dependants_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."kyc_verifications" DROP CONSTRAINT "kyc_verifications_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ADD CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."onboarding_progress" DROP CONSTRAINT "onboarding_progress_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ADD CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."partner_api_keys" DROP CONSTRAINT "partner_api_keys_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "partnerId",
ADD COLUMN     "partnerId" INTEGER NOT NULL,
ADD CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."partner_contacts" DROP CONSTRAINT "partner_contacts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "partnerId",
ADD COLUMN     "partnerId" INTEGER NOT NULL,
ALTER COLUMN "contactPhone" SET DATA TYPE VARCHAR(20),
ADD CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."partner_customers" DROP CONSTRAINT "partner_customers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "partnerId",
ADD COLUMN     "partnerId" INTEGER NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ADD CONSTRAINT "partner_customers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."partners" DROP CONSTRAINT "partners_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."policies" DROP CONSTRAINT "policies_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "customerId",
ADD COLUMN     "customerId" UUID NOT NULL,
ADD CONSTRAINT "policies_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "addresses_customerId_key" ON "public"."addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_customerId_key" ON "public"."kyc_verifications"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_customerId_key" ON "public"."onboarding_progress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_api_keys_partnerId_isActive_key" ON "public"."partner_api_keys"("partnerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "partner_customers_partnerId_partnerCustomerId_key" ON "public"."partner_customers"("partnerId", "partnerCustomerId");

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
