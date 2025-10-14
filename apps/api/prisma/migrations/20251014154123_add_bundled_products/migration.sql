-- CreateTable
CREATE TABLE "bundled_products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,

    CONSTRAINT "bundled_products_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "bundled_product_id" INTEGER;

-- CreateIndex
CREATE INDEX "bundled_products_created_by_idx" ON "bundled_products"("created_by");

-- CreateIndex
CREATE INDEX "bundled_products_name_idx" ON "bundled_products"("name");

-- CreateIndex
CREATE INDEX "policies_bundled_product_id_idx" ON "policies"("bundled_product_id");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_bundled_product_id_fkey" FOREIGN KEY ("bundled_product_id") REFERENCES "bundled_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

