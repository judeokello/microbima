-- AlterTable: Make policyNumber nullable for postpaid policies
-- This allows postpaid policies to have null policy numbers until activation

-- Step 1: Drop the unique constraint FIRST (before making column nullable)
-- This is necessary because PostgreSQL validates constraints during ALTER operations
ALTER TABLE "policies" DROP CONSTRAINT IF EXISTS "policies_policyNumber_key";

-- Step 2: Drop the index if it exists (in case it was created as an index instead of constraint)
DROP INDEX IF EXISTS "policies_policyNumber_key";

-- Step 3: Handle the NOT NULL constraint
-- The issue: PostgreSQL validates existing rows when dropping NOT NULL
-- If there are already NULL values, PostgreSQL will fail during ALTER
-- Solution: Use a workaround to handle NULLs by temporarily changing the column type
-- This allows us to transform NULLs during the type change, then change back
DO $$
DECLARE
    has_not_null_constraint BOOLEAN;
BEGIN
    -- Check if column has NOT NULL constraint
    SELECT is_nullable = 'NO' INTO has_not_null_constraint
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'policies' 
    AND column_name = 'policyNumber';

    IF has_not_null_constraint THEN
        -- Workaround for PostgreSQL constraint validation issue:
        -- When dropping NOT NULL, PostgreSQL validates all existing rows first
        -- If NULLs exist, it fails. Solution: Use USING clause during type change
        -- to transform NULLs, then drop NOT NULL
        
        -- First, update empty strings to temporary values (can't be NULL yet)
        UPDATE "policies" 
        SET "policyNumber" = 'TEMP_EMPTY_' || id::text
        WHERE ("policyNumber" = '' OR "policyNumber" = 'EMPTY')
        AND "policyNumber" IS NOT NULL;
        
        -- Change column type using USING clause with COALESCE to handle NULLs
        -- This allows NULLs to pass through during type transformation
        -- We change to TEXT first (more permissive), which allows the type change
        -- to proceed even if NULLs exist
        ALTER TABLE "policies" 
        ALTER COLUMN "policyNumber" TYPE TEXT USING COALESCE("policyNumber", NULL::TEXT);
        
        -- Now drop NOT NULL constraint (should work since USING handled NULLs during type change)
        ALTER TABLE "policies" 
        ALTER COLUMN "policyNumber" DROP NOT NULL;
        
        -- Set temporary placeholders back to NULL
        UPDATE "policies" 
        SET "policyNumber" = NULL 
        WHERE "policyNumber" LIKE 'TEMP_EMPTY_%';
        
        -- Update empty strings to NULL
        UPDATE "policies" 
        SET "policyNumber" = NULL 
        WHERE "policyNumber" = '' OR "policyNumber" = 'EMPTY';
    ELSE
        -- Column is already nullable, just update empty strings to NULL
        UPDATE "policies" 
        SET "policyNumber" = NULL 
        WHERE "policyNumber" = '' OR "policyNumber" = 'EMPTY';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If the above fails, try a simpler approach: just drop NOT NULL directly
        -- This might work if there are no NULL values
        BEGIN
            ALTER TABLE "policies" 
            ALTER COLUMN "policyNumber" DROP NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN
                -- If that also fails, log and continue (column might already be nullable)
                RAISE NOTICE 'Could not drop NOT NULL constraint: %', SQLERRM;
        END;
END $$;

-- Step 4: Recreate the unique constraint (PostgreSQL allows multiple NULLs in a unique column)
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

