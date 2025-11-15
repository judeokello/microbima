-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if schemes table exists)
DO $$
BEGIN
    -- Check if schemes table exists before creating scheme_tags
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schemes') THEN
        CREATE TABLE IF NOT EXISTS "scheme_tags" (
            "id" SERIAL NOT NULL,
            "schemeId" INTEGER NOT NULL,
            "tagId" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "scheme_tags_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "policy_tags" (
    "id" SERIAL NOT NULL,
    "policyId" UUID NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_key" ON "tags"("name");

-- CreateIndex (idempotent - only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheme_tags') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "scheme_tags_schemeId_tagId_key" ON "scheme_tags"("schemeId", "tagId");
    END IF;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "policy_tags_policyId_tagId_key" ON "policy_tags"("policyId", "tagId");

-- AddForeignKey (idempotent - only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheme_tags') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schemes')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'scheme_tags_schemeId_fkey'
       ) THEN
        ALTER TABLE "scheme_tags" ADD CONSTRAINT "scheme_tags_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheme_tags')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'scheme_tags_tagId_fkey'
       ) THEN
        ALTER TABLE "scheme_tags" ADD CONSTRAINT "scheme_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'policy_tags')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'policies')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'policy_tags_policyId_fkey'
       ) THEN
        ALTER TABLE "policy_tags" ADD CONSTRAINT "policy_tags_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'policy_tags')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'policy_tags_tagId_fkey'
       ) THEN
        ALTER TABLE "policy_tags" ADD CONSTRAINT "policy_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

