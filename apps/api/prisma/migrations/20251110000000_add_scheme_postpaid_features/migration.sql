-- AddSchemePostpaidFeatures
-- Add postpaid scheme features: isPostpaid, frequency, paymentCadence, paymentAcNumber
-- Add scheme_contacts table
-- Add payment_account_number_sequences table
-- Add paymentAcNumber to policies table

-- Add postpaid fields to schemes table
ALTER TABLE "schemes" 
ADD COLUMN IF NOT EXISTS "isPostpaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "frequency" "PaymentFrequency",
ADD COLUMN IF NOT EXISTS "paymentCadence" INTEGER,
ADD COLUMN IF NOT EXISTS "paymentAcNumber" VARCHAR(50);

-- Add unique constraint on paymentAcNumber (nullable unique)
CREATE UNIQUE INDEX IF NOT EXISTS "schemes_paymentAcNumber_key" ON "schemes"("paymentAcNumber") WHERE "paymentAcNumber" IS NOT NULL;

-- Add check constraint for postpaid schemes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_postpaid_frequency'
  ) THEN
    ALTER TABLE "schemes"
    ADD CONSTRAINT "check_postpaid_frequency" 
    CHECK (
      ("isPostpaid" = false) OR 
      ("isPostpaid" = true AND "frequency" IS NOT NULL)
    );
  END IF;
END $$;

-- Create scheme_contacts table
CREATE TABLE IF NOT EXISTS "scheme_contacts" (
    "id" SERIAL PRIMARY KEY,
    "schemeId" INTEGER NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "otherName" VARCHAR(50),
    "phoneNumber" VARCHAR(15),
    "phoneNumber2" VARCHAR(15),
    "email" VARCHAR(100),
    "designation" VARCHAR(100),
    "notes" VARCHAR(500),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    CONSTRAINT "scheme_contacts_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index on scheme_contacts.schemeId
CREATE INDEX IF NOT EXISTS "idx_scheme_contacts_schemeId" ON "scheme_contacts"("schemeId");

-- Create payment_account_number_sequences table
CREATE TABLE IF NOT EXISTS "payment_account_number_sequences" (
    "id" INTEGER PRIMARY KEY DEFAULT 1,
    "currentValue" INTEGER NOT NULL DEFAULT 221,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "single_row_check" CHECK ("id" = 1)
);

-- Seed initial value for payment_account_number_sequences
INSERT INTO "payment_account_number_sequences" ("id", "currentValue") 
VALUES (1, 221) 
ON CONFLICT ("id") DO NOTHING;

-- Add paymentAcNumber to policies table
ALTER TABLE "policies" 
ADD COLUMN IF NOT EXISTS "paymentAcNumber" VARCHAR(50);

-- Add unique constraint on policies.paymentAcNumber (nullable unique)
CREATE UNIQUE INDEX IF NOT EXISTS "policies_paymentAcNumber_key" ON "policies"("paymentAcNumber") WHERE "paymentAcNumber" IS NOT NULL;

-- Make startDate nullable for postpaid policies (if not already nullable)
-- Note: This may fail if there are existing NOT NULL constraints, but that's expected
DO $$ 
BEGIN
  -- Check if column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'policies' 
    AND column_name = 'startDate' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "policies" ALTER COLUMN "startDate" DROP NOT NULL;
  END IF;
END $$;

