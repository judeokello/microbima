-- AlterTable: Make policyNumber nullable for postpaid policies
-- This allows postpaid policies to have null policy numbers until activation

-- First, update any existing empty strings to NULL
UPDATE "policies" 
SET "policyNumber" = NULL 
WHERE "policyNumber" = '' OR "policyNumber" = 'EMPTY';

-- Drop the existing unique constraint (idempotent)
ALTER TABLE "policies" DROP CONSTRAINT IF EXISTS "policies_policyNumber_key";

-- Drop the index if it exists (in case it was created as an index instead of constraint)
DROP INDEX IF EXISTS "policies_policyNumber_key";

-- Make the column nullable (idempotent - only if column exists and is NOT NULL)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'policies' 
        AND column_name = 'policyNumber'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "policies" ALTER COLUMN "policyNumber" DROP NOT NULL;
    END IF;
END $$;

-- Recreate the unique constraint (PostgreSQL allows multiple NULLs in a unique column)
-- Only create if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'policies' 
        AND indexname = 'policies_policyNumber_key'
    ) THEN
        CREATE UNIQUE INDEX "policies_policyNumber_key" ON "policies"("policyNumber") WHERE "policyNumber" IS NOT NULL;
    END IF;
END $$;

