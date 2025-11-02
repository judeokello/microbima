-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('MPESA', 'SASAPAY');

-- AlterEnum (already applied separately)
-- ALTER TYPE "public"."PolicyStatus" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';

-- DropForeignKey
ALTER TABLE "public"."policies" DROP CONSTRAINT "policies_bundled_product_id_fkey";

-- AlterTable
ALTER TABLE "public"."packages" ADD COLUMN     "memberNumberFormat" VARCHAR(200),
ADD COLUMN     "policyNumberFormat" VARCHAR(200);

-- AlterTable
ALTER TABLE "public"."policies" DROP COLUMN "bundled_product_id",
DROP COLUMN "planName",
ADD COLUMN     "packageId" INTEGER NOT NULL,
ADD COLUMN     "packagePlanId" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PENDING_ACTIVATION';

-- DropTable
DROP TABLE "public"."bundled_products";

-- CreateTable
CREATE TABLE "public"."package_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(200),
    "packageId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "package_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_member_principals" (
    "id" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "memberNumber" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "policy_member_principals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_member_dependants" (
    "id" SERIAL NOT NULL,
    "dependantId" UUID NOT NULL,
    "memberNumber" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "policy_member_dependants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_payments" (
    "id" SERIAL NOT NULL,
    "policyId" UUID NOT NULL,
    "paymentType" "public"."PaymentType" NOT NULL,
    "transactionReference" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "accountNumber" VARCHAR(50),
    "details" VARCHAR(500),
    "expectedPaymentDate" TIMESTAMP(3) NOT NULL,
    "actualPaymentDate" TIMESTAMP(3),
    "paymentMessageBlob" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_plans_packageId_name_key" ON "public"."package_plans"("packageId", "name");

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "public"."package_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."package_plans" ADD CONSTRAINT "package_plans_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_member_principals" ADD CONSTRAINT "policy_member_principals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_member_dependants" ADD CONSTRAINT "policy_member_dependants_dependantId_fkey" FOREIGN KEY ("dependantId") REFERENCES "public"."dependants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_payments" ADD CONSTRAINT "policy_payments_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

