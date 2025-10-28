-- AddProductManagementTables
-- Add all product management related tables

-- Create underwriters table
CREATE TABLE "underwriters" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "shortName" VARCHAR(50) NOT NULL,
    "website" VARCHAR(100) NOT NULL,
    "officeLocation" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create packages table
CREATE TABLE "packages" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "underwriterId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "packages_underwriterId_fkey" FOREIGN KEY ("underwriterId") REFERENCES "underwriters"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create product_types table
CREATE TABLE "product_types" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE "products" (
    "id" SERIAL PRIMARY KEY,
    "productTypeId" INTEGER NOT NULL,
    "productName" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "product_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create package_products table (junction table)
CREATE TABLE "package_products" (
    "id" SERIAL PRIMARY KEY,
    "packageId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_products_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "package_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "package_products_packageId_productId_key" UNIQUE ("packageId", "productId")
);

-- Create schemes table
CREATE TABLE "schemes" (
    "id" SERIAL PRIMARY KEY,
    "schemeName" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create package_schemes table (junction table)
CREATE TABLE "package_schemes" (
    "id" SERIAL PRIMARY KEY,
    "packageId" INTEGER NOT NULL,
    "schemeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_schemes_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "package_schemes_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "package_schemes_packageId_schemeId_key" UNIQUE ("packageId", "schemeId")
);

-- Create package_scheme_customers table
CREATE TABLE "package_scheme_customers" (
    "id" SERIAL PRIMARY KEY,
    "packageSchemeId" INTEGER NOT NULL,
    "partnerId" INTEGER,
    "customerId" UUID NOT NULL,
    "partnerCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_scheme_customers_packageSchemeId_fkey" FOREIGN KEY ("packageSchemeId") REFERENCES "package_schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "package_scheme_customers_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "package_scheme_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for better performance
CREATE INDEX "packages_underwriterId_idx" ON "packages"("underwriterId");
CREATE INDEX "products_productTypeId_idx" ON "products"("productTypeId");
CREATE INDEX "package_products_packageId_idx" ON "package_products"("packageId");
CREATE INDEX "package_products_productId_idx" ON "package_products"("productId");
CREATE INDEX "package_schemes_packageId_idx" ON "package_schemes"("packageId");
CREATE INDEX "package_schemes_schemeId_idx" ON "package_schemes"("schemeId");
CREATE INDEX "package_scheme_customers_packageSchemeId_idx" ON "package_scheme_customers"("packageSchemeId");
CREATE INDEX "package_scheme_customers_partnerId_idx" ON "package_scheme_customers"("partnerId");
CREATE INDEX "package_scheme_customers_customerId_idx" ON "package_scheme_customers"("customerId");

