-- AddUnderwriterManagementFields
-- Add fields to underwriters, packages, and schemes tables for admin management

-- Get first user ID for seeding (store in variable for reuse)
DO $$
DECLARE
    first_user_id TEXT;
BEGIN
    -- Get first user ID from auth.users
    SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    -- If no user exists, use a placeholder (shouldn't happen in production)
    IF first_user_id IS NULL THEN
        first_user_id := '00000000-0000-0000-0000-000000000000';
        RAISE WARNING 'No users found in auth.users, using placeholder UUID';
    END IF;

    -- Add fields to underwriters table (add nullable first, then update, then make NOT NULL)
    ALTER TABLE "underwriters" 
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "logoPath" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

    -- Update existing underwriters
    UPDATE "underwriters" 
    SET "isActive" = COALESCE("isActive", true),
        "createdBy" = COALESCE("createdBy", first_user_id)
    WHERE "createdBy" IS NULL;

    -- Make createdBy NOT NULL
    ALTER TABLE "underwriters" 
    ALTER COLUMN "isActive" SET NOT NULL,
    ALTER COLUMN "isActive" SET DEFAULT true,
    ALTER COLUMN "createdBy" SET NOT NULL;

    -- Add fields to packages table
    ALTER TABLE "packages" 
    ADD COLUMN IF NOT EXISTS "logoPath" VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

    -- Update existing packages
    UPDATE "packages" 
    SET "createdBy" = COALESCE("createdBy", first_user_id)
    WHERE "createdBy" IS NULL;

    -- Make createdBy NOT NULL
    ALTER TABLE "packages" 
    ALTER COLUMN "createdBy" SET NOT NULL;

    -- Add field to schemes table
    ALTER TABLE "schemes" 
    ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

    -- Update existing schemes
    UPDATE "schemes" 
    SET "createdBy" = COALESCE("createdBy", first_user_id)
    WHERE "createdBy" IS NULL;

    -- Make createdBy NOT NULL
    ALTER TABLE "schemes" 
    ALTER COLUMN "createdBy" SET NOT NULL;

END $$;

