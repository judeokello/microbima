-- Postpaid scheme coverage / payment-horizon dates (nullable until historical backfill)
ALTER TABLE "schemes" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "schemes" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "schemes" ADD COLUMN IF NOT EXISTS "nominalPaymentPeriodEndDate" TIMESTAMP(3);
