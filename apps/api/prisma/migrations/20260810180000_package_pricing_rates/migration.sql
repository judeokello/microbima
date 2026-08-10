-- Package pricing categories + plan rates (lookup-only source of truth).
-- New public tables inherit RLS via ensure_rls_on_public_tables event trigger.

CREATE TYPE "PackagePricingCategoryKind" AS ENUM ('MEMBER_ONLY', 'UP_TO_N', 'ADDITIONAL_SPOUSE');

CREATE TABLE "package_pricing_categories" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "kind" "PackagePricingCategoryKind" NOT NULL,
    "maxMembers" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "package_pricing_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "package_plan_rates" (
    "id" SERIAL NOT NULL,
    "packagePlanId" INTEGER NOT NULL,
    "packagePricingCategoryId" INTEGER NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "package_plan_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_pricing_categories_packageId_key_key" ON "package_pricing_categories"("packageId", "key");

CREATE UNIQUE INDEX "package_plan_rates_packagePlanId_packagePricingCategoryId_f_key" ON "package_plan_rates"("packagePlanId", "packagePricingCategoryId", "frequency");

ALTER TABLE "package_pricing_categories" ADD CONSTRAINT "package_pricing_categories_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_plan_rates" ADD CONSTRAINT "package_plan_rates_packagePlanId_fkey" FOREIGN KEY ("packagePlanId") REFERENCES "package_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_plan_rates" ADD CONSTRAINT "package_plan_rates_packagePricingCategoryId_fkey" FOREIGN KEY ("packagePricingCategoryId") REFERENCES "package_pricing_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_pricing_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "package_plan_rates" ENABLE ROW LEVEL SECURITY;
