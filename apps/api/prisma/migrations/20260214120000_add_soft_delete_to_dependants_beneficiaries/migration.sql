-- AlterTable
ALTER TABLE "dependants" ADD COLUMN "deletedAt" TIMESTAMPTZ,
ADD COLUMN "deletedBy" UUID;

-- AlterTable
ALTER TABLE "beneficiaries" ADD COLUMN "deletedAt" TIMESTAMPTZ,
ADD COLUMN "deletedBy" UUID;
