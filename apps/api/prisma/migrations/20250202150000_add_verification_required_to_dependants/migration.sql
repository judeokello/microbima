-- Add verificationRequired column to dependants table
-- This column indicates if verification is required for children aged 18-24 years old

-- Check if column exists before adding (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'dependants'
        AND column_name = 'verificationRequired'
    ) THEN
        ALTER TABLE "dependants" ADD COLUMN "verificationRequired" BOOLEAN NOT NULL DEFAULT false;
        
        -- Update existing records to ensure they have false (though DEFAULT should handle this)
        UPDATE "dependants" SET "verificationRequired" = false WHERE "verificationRequired" IS NULL;
    END IF;
END $$;

