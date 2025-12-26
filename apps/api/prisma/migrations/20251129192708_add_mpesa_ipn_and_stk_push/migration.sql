-- Migration: Add M-Pesa IPN and STK Push Integration
-- This migration is idempotent and safe to run multiple times
-- Use `prisma migrate deploy` for staging/production

-- CreateEnum: MpesaPaymentSource
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaPaymentSource') THEN
        CREATE TYPE "MpesaPaymentSource" AS ENUM ('IPN', 'STATEMENT');
    END IF;
END $$;

-- CreateEnum: MpesaStkPushStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaStkPushStatus') THEN
        CREATE TYPE "MpesaStkPushStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');
    END IF;
END $$;

-- AlterTable: mpesa_payment_report_items - Add new columns
DO $$
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'businessShortCode') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "businessShortCode" VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'firstName') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "firstName" VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'lastName') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "lastName" VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'middleName') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "middleName" VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'mpesaStkPushRequestId') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "mpesaStkPushRequestId" UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'msisdn') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "msisdn" VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mpesa_payment_report_items' AND column_name = 'source') THEN
        ALTER TABLE "mpesa_payment_report_items" ADD COLUMN "source" "MpesaPaymentSource" NOT NULL DEFAULT 'IPN';
    END IF;
END $$;

-- Make mpesaPaymentReportUploadId nullable (for IPN records)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mpesa_payment_report_items' 
        AND column_name = 'mpesaPaymentReportUploadId' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "mpesaPaymentReportUploadId" DROP NOT NULL;
    END IF;
END $$;

-- CreateTable: mpesa_stk_push_requests
CREATE TABLE IF NOT EXISTS "mpesa_stk_push_requests" (
    "id" UUID NOT NULL,
    "checkoutRequestId" VARCHAR(100),
    "phoneNumber" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "accountReference" VARCHAR(100) NOT NULL,
    "transactionDesc" VARCHAR(500),
    "status" "MpesaStkPushStatus" NOT NULL DEFAULT 'PENDING',
    "resultCode" VARCHAR(10),
    "resultDesc" VARCHAR(500),
    "linkedTransactionId" VARCHAR(100),
    "initiatedBy" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mpesa_stk_push_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on checkoutRequestId (for callback lookup)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_requests_checkoutRequestId_key'
    ) THEN
        CREATE UNIQUE INDEX "mpesa_stk_push_requests_checkoutRequestId_key" 
            ON "mpesa_stk_push_requests"("checkoutRequestId") 
            WHERE "checkoutRequestId" IS NOT NULL;
    END IF;
END $$;

-- CreateIndex: accountReference
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_requests_accountReference_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_requests_accountReference_idx" 
            ON "mpesa_stk_push_requests"("accountReference");
    END IF;
END $$;

-- CreateIndex: status and createdAt
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_requests_status_createdAt_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_requests_status_createdAt_idx" 
            ON "mpesa_stk_push_requests"("status", "createdAt");
    END IF;
END $$;

-- CreateIndex: phoneNumber
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_requests_phoneNumber_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_requests_phoneNumber_idx" 
            ON "mpesa_stk_push_requests"("phoneNumber");
    END IF;
END $$;

-- CreateIndex: Unique constraint on mpesaStkPushRequestId (one-to-one relation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_payment_report_items_mpesaStkPushRequestId_key'
    ) THEN
        CREATE UNIQUE INDEX "mpesa_payment_report_items_mpesaStkPushRequestId_key" 
            ON "mpesa_payment_report_items"("mpesaStkPushRequestId") 
            WHERE "mpesaStkPushRequestId" IS NOT NULL;
    END IF;
END $$;

-- CreateIndex: Composite index for deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_transaction_reference_source'
    ) THEN
        CREATE INDEX "idx_transaction_reference_source" 
            ON "mpesa_payment_report_items"("transactionReference", "source");
    END IF;
END $$;

-- CreateIndex: source
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_source'
    ) THEN
        CREATE INDEX "idx_source" 
            ON "mpesa_payment_report_items"("source");
    END IF;
END $$;

-- CreateIndex: accountNumber
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_account_number'
    ) THEN
        CREATE INDEX "idx_account_number" 
            ON "mpesa_payment_report_items"("accountNumber");
    END IF;
END $$;

-- AddForeignKey: Link mpesa_payment_report_items to mpesa_stk_push_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mpesa_payment_report_items_mpesaStkPushRequestId_fkey'
    ) THEN
        ALTER TABLE "mpesa_payment_report_items" 
            ADD CONSTRAINT "mpesa_payment_report_items_mpesaStkPushRequestId_fkey" 
            FOREIGN KEY ("mpesaStkPushRequestId") 
            REFERENCES "mpesa_stk_push_requests"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;


