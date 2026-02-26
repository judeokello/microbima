-- Add transactionDate to postpaid_scheme_payments (date on payment method; fallback for CSV paid date)
ALTER TABLE "postpaid_scheme_payments" ADD COLUMN "transactionDate" TIMESTAMP(3);

-- Backfill existing rows with createdAt
UPDATE "postpaid_scheme_payments" SET "transactionDate" = "createdAt" WHERE "transactionDate" IS NULL;

-- Make column NOT NULL
ALTER TABLE "postpaid_scheme_payments" ALTER COLUMN "transactionDate" SET NOT NULL;
