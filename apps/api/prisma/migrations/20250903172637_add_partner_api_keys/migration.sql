-- CreateTable
CREATE TABLE "public"."partner_api_keys" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_api_key_lookup" ON "public"."partner_api_keys"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "partner_api_keys_partnerId_isActive_key" ON "public"."partner_api_keys"("partnerId", "isActive");

-- AddForeignKey
ALTER TABLE "public"."partner_api_keys" ADD CONSTRAINT "partner_api_keys_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
