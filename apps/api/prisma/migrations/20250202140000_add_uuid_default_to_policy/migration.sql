-- AlterTable: Add UUID default to Policy.id
ALTER TABLE "policies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

