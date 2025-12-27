-- Migration: Add STK Push Callback Responses Table
-- This migration adds a table to store all callback responses from M-Pesa for STK Push requests
-- This enables audit trail and retry logic for failed/timeout/cancelled payments

-- CreateTable: mpesa_stk_push_callback_responses
CREATE TABLE IF NOT EXISTS "mpesa_stk_push_callback_responses" (
    "id" UUID NOT NULL,
    "mpesaStkPushRequestId" UUID NOT NULL,
    "resultCode" INTEGER NOT NULL,
    "resultDesc" VARCHAR(500) NOT NULL,
    "callbackMetadata" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mpesa_stk_push_callback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Index on mpesaStkPushRequestId (for querying all responses for a request)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_callback_responses_mpesaStkPushRequestId_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_callback_responses_mpesaStkPushRequestId_idx" 
            ON "mpesa_stk_push_callback_responses"("mpesaStkPushRequestId");
    END IF;
END $$;

-- CreateIndex: Index on resultCode (for filtering by result code)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_callback_responses_resultCode_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_callback_responses_resultCode_idx" 
            ON "mpesa_stk_push_callback_responses"("resultCode");
    END IF;
END $$;

-- CreateIndex: Index on receivedAt (for querying by time)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'mpesa_stk_push_callback_responses_receivedAt_idx'
    ) THEN
        CREATE INDEX "mpesa_stk_push_callback_responses_receivedAt_idx" 
            ON "mpesa_stk_push_callback_responses"("receivedAt");
    END IF;
END $$;

-- AddForeignKey: Foreign key to mpesa_stk_push_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'mpesa_stk_push_callback_responses_mpesaStkPushRequestId_fkey'
    ) THEN
        ALTER TABLE "mpesa_stk_push_callback_responses" 
        ADD CONSTRAINT "mpesa_stk_push_callback_responses_mpesaStkPushRequestId_fkey" 
        FOREIGN KEY ("mpesaStkPushRequestId") 
        REFERENCES "mpesa_stk_push_requests"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

