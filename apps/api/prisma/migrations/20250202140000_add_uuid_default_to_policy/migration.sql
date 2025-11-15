-- AlterTable: Add UUID default to Policy.id (idempotent - only if policies table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'policies') THEN
        ALTER TABLE "policies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    END IF;
END $$;

