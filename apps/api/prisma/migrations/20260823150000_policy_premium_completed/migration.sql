-- Flag: prepaid policy money target fully paid (skip suspend/inactive accrual pressure)
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "premiumCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "premiumCompletedAt" TIMESTAMP(3);
