-- Migration: IPN messageBlob, nullable report item columns, msisdn 64, STK request/response payloads
-- Enables blob-first IPN insert; stores hashed MSISDN; stores Daraja request/response for troubleshooting

-- Add messageBlob to mpesa_payment_report_items
ALTER TABLE "mpesa_payment_report_items" ADD COLUMN IF NOT EXISTS "messageBlob" TEXT;

-- Make columns nullable (for blob-first IPN insert)
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "transactionReference" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "completionTime" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "initiationTime" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "paidIn" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "withdrawn" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "accountBalance" DROP NOT NULL;
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "reasonType" DROP NOT NULL;

-- Widen msisdn to 64 chars (for SHA-256 hashed MSISDN from M-Pesa)
ALTER TABLE "mpesa_payment_report_items" ALTER COLUMN "msisdn" TYPE VARCHAR(64);

-- Add requestPayload and responsePayload to mpesa_stk_push_requests
ALTER TABLE "mpesa_stk_push_requests" ADD COLUMN IF NOT EXISTS "requestPayload" TEXT;
ALTER TABLE "mpesa_stk_push_requests" ADD COLUMN IF NOT EXISTS "responsePayload" TEXT;
