-- ParentRelationship enum
DO $$ BEGIN
  CREATE TYPE "ParentRelationship" AS ENUM ('MOTHER', 'FATHER', 'MOTHER_IN_LAW', 'FATHER_IN_LAW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Package: parentsSupported + maximumFamilySize (seed 8)
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "parentsSupported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "maximumFamilySize" INTEGER NOT NULL DEFAULT 8;
UPDATE "packages" SET "maximumFamilySize" = 8 WHERE "maximumFamilySize" IS NULL OR "maximumFamilySize" < 2;

-- Scheme: parentsSupported
ALTER TABLE "schemes" ADD COLUMN IF NOT EXISTS "parentsSupported" BOOLEAN NOT NULL DEFAULT false;

-- Customer parents table
CREATE TABLE IF NOT EXISTS "customer_parents" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "firstName" VARCHAR(50) NOT NULL,
  "middleName" VARCHAR(50),
  "lastName" VARCHAR(50) NOT NULL,
  "dateOfBirth" DATE,
  "gender" "Gender",
  "idType" "IdType",
  "idNumber" VARCHAR(20),
  "relationship" "ParentRelationship" NOT NULL,
  "createdByPartnerId" INTEGER NOT NULL,
  "deletedAt" TIMESTAMPTZ,
  "deletedBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_parents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_parents_customerId_idx" ON "customer_parents"("customerId");

DO $$ BEGIN
  ALTER TABLE "customer_parents"
    ADD CONSTRAINT "customer_parents_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- RLS auto-enable trigger covers new public tables; ensure RLS on for advisors
ALTER TABLE "customer_parents" ENABLE ROW LEVEL SECURITY;
