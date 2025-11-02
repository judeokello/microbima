-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_tags" (
    "id" SERIAL NOT NULL,
    "schemeId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_tags" (
    "id" SERIAL NOT NULL,
    "policyId" UUID NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_tags_schemeId_tagId_key" ON "scheme_tags"("schemeId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_tags_policyId_tagId_key" ON "policy_tags"("policyId", "tagId");

-- AddForeignKey
ALTER TABLE "scheme_tags" ADD CONSTRAINT "scheme_tags_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_tags" ADD CONSTRAINT "scheme_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_tags" ADD CONSTRAINT "policy_tags_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_tags" ADD CONSTRAINT "policy_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

