-- Healthcare provider panels: counties, sub-counties, sources, master list, package panels

CREATE TABLE "counties" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "counties_code_key" ON "counties"("code");

CREATE TABLE "sub_counties" (
    "id" SERIAL NOT NULL,
    "countyId" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_counties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sub_counties_code_key" ON "sub_counties"("code");
CREATE INDEX "sub_counties_countyId_idx" ON "sub_counties"("countyId");
CREATE UNIQUE INDEX "sub_counties_countyId_name_key" ON "sub_counties"("countyId", "name");

CREATE TABLE "provider_sources" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "provider_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_sources_code_key" ON "provider_sources"("code");

CREATE TABLE "healthcare_providers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "countyId" INTEGER NOT NULL,
    "subCountyId" INTEGER,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "sourceId" INTEGER NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(200),
    "address" VARCHAR(500),
    "notes" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "healthcare_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "healthcare_providers_name_countyId_sourceId_key" ON "healthcare_providers"("name", "countyId", "sourceId");
CREATE INDEX "healthcare_providers_name_idx" ON "healthcare_providers"("name");
CREATE INDEX "healthcare_providers_countyId_idx" ON "healthcare_providers"("countyId");
CREATE INDEX "healthcare_providers_sourceId_idx" ON "healthcare_providers"("sourceId");
CREATE INDEX "healthcare_providers_isActive_idx" ON "healthcare_providers"("isActive");

CREATE TABLE "package_providers" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "healthcareProviderId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "package_providers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_providers_packageId_idx" ON "package_providers"("packageId");
CREATE INDEX "package_providers_healthcareProviderId_idx" ON "package_providers"("healthcareProviderId");
CREATE UNIQUE INDEX "package_providers_packageId_healthcareProviderId_key" ON "package_providers"("packageId", "healthcareProviderId");

ALTER TABLE "sub_counties" ADD CONSTRAINT "sub_counties_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "healthcare_providers" ADD CONSTRAINT "healthcare_providers_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "healthcare_providers" ADD CONSTRAINT "healthcare_providers_subCountyId_fkey" FOREIGN KEY ("subCountyId") REFERENCES "sub_counties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "healthcare_providers" ADD CONSTRAINT "healthcare_providers_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "provider_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "package_providers" ADD CONSTRAINT "package_providers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_providers" ADD CONSTRAINT "package_providers_healthcareProviderId_fkey" FOREIGN KEY ("healthcareProviderId") REFERENCES "healthcare_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
