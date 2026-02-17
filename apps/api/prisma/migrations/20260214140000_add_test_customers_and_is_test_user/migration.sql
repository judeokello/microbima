-- AlterTable
ALTER TABLE "customers" ADD COLUMN "isTestUser" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "test_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "test_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_customers_phoneNumber_key" ON "test_customers"("phoneNumber");
