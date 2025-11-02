# Package Plans and Policy Payments Schema Implementation

## Overview

Add package plans functionality, restructure policies to use packages instead of bundled_products, implement policy member tracking (principals and dependants), create policy payments system, and remove all bundled_products references.

## 1. Create Payment Frequency Constants

**File**: `apps/api/src/constants/payment-cadence.constants.ts` (new)

Create TypeScript constants mapping payment frequencies to days:

```typescript
export const PAYMENT_CADENCE = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  ANNUALLY: 365,
} as const;
```

## 2. Database Schema Changes (Prisma Migration)

**File**: `apps/api/prisma/schema.prisma`

### Add PaymentType enum

```typescript
enum PaymentType {
  MPESA
  SASAPAY
}
```

### Update PolicyStatus enum

Add `PENDING_ACTIVATION` as new value and set as default

### Create package_plans table

```prisma
model PackagePlan {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(200)
  description String?  @db.VarChar(200)
  packageId   Int
  package     Package  @relation(fields: [packageId], references: [id])
  isActive    Boolean  @default(true)
  
  // Relations
  policies    Policy[]
  
  // Audit fields
  createdAt   DateTime @default(now())
  createdBy   String   @db.Uuid
  updatedAt   DateTime @updatedAt
  updatedBy   String   @db.Uuid
  
  @@unique([packageId, name])
  @@map("package_plans")
}
```

### Update Package model

Add two new fields:

- `policyNumberFormat` String? (template: `MP/MFG/{auto-increasing-policy-number}`)
- `memberNumberFormat` String? (template: `MFG{auto-increasing-policy-number}-{auto-increasing-member-number}`)
- Add relation: `packagePlans PackagePlan[]`

### Update Policy model

Changes:

- **Add**: `packageId` Int (FK to packages)
- **Add**: `packagePlanId` Int? (FK to package_plans, nullable)
- **Remove**: `planName` field
- **Remove**: `bundledProductId` and `bundledProduct` relation
- **Update**: `status` default to `PENDING_ACTIVATION`
- **Reorder fields**: Move `status`, `customerId`, `packageId` to top after id/policyNumber

### Create policy_member_principals table

```prisma
model PolicyMemberPrincipal {
  id           Int      @id @default(autoincrement())
  customerId   String   @db.Uuid
  customer     Customer @relation(fields: [customerId], references: [id])
  memberNumber String   @db.VarChar(20)
  createdAt    DateTime @default(now())
  updatedAt    DateTime?
  
  @@map("policy_member_principals")
}
```

### Create policy_member_dependants table

```prisma
model PolicyMemberDependant {
  id           Int       @id @default(autoincrement())
  dependantId  String    @db.Uuid
  dependant    Dependant @relation(fields: [dependantId], references: [id])
  memberNumber String    @db.VarChar(20)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime?
  
  @@map("policy_member_dependants")
}
```

### Create policy_payments table

```prisma
model PolicyPayment {
  id                    Int          @id @default(autoincrement())
  policyId              String       @db.Uuid
  policy                Policy       @relation(fields: [policyId], references: [id])
  paymentType           PaymentType
  transactionReference  String       @db.VarChar(50)
  amount                Decimal      @db.Decimal(10, 2)
  accountNumber         String?      @db.VarChar(50)
  details               String?      @db.VarChar(500)
  expectedPaymentDate   DateTime
  actualPaymentDate     DateTime?
  paymentMessageBlob    String?      @db.VarChar(500)
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  
  @@map("policy_payments")
}
```

### Remove BundledProduct model

Delete entire model and enum references

### Update relations

- Add `PolicyMemberPrincipal[]` to Customer
- Add `PolicyMemberDependant[]` to Dependant
- Add `PolicyPayment[]` to Policy

## 3. Create Migration

Run: `npx prisma migrate dev --name add_package_plans_and_policy_payments`

This will:

- Create package_plans table
- Update packages table with format fields
- Update policies table (add packageId, packagePlanId, remove planName, bundledProductId)
- Add PENDING_ACTIVATION to PolicyStatus
- Create policy_member_principals table
- Create policy_member_dependants table
- Create policy_payments table with PaymentType enum
- Drop bundled_products table

## 4. Update Seed Data

### Update seed-product-management.sql

Add at end of file (after package_schemes insert):

```sql
-- Update all 3 packages with number formats (idempotent - works on already-seeded DBs)
UPDATE "packages" SET 
  "policyNumberFormat" = 'MP/MFG/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MFG{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 1;

UPDATE "packages" SET 
  "policyNumberFormat" = 'MP/MFS/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MFS{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 2;

UPDATE "packages" SET 
  "policyNumberFormat" = 'MP/MZD/{auto-increasing-policy-number}',
  "memberNumberFormat" = 'MZD{auto-increasing-policy-number}-{auto-increasing-member-number}',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 3;

-- Seed 6 package_plans: Silver and Gold for each of 3 packages (idempotent)
-- MfanisiGo Plans (packageId=1)
INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 1, 'Silver', 'the silver plan', 1, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 1);

INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 2, 'Gold', 'the Gold plan', 1, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 2);

-- Mfanisi Plans (packageId=2)
INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 3, 'Silver', 'the silver plan', 2, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 3);

INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 4, 'Gold', 'the Gold plan', 2, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 4);

-- Mzalendo Plans (packageId=3)
INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 5, 'Silver', 'the silver plan', 3, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 5);

INSERT INTO "package_plans" ("id", "name", "description", "packageId", "isActive", "createdBy", "updatedBy", "updatedAt") 
SELECT 6, 'Gold', 'the Gold plan', 3, true,
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "package_plans" WHERE id = 6);
```

**Idempotency Note**: UPDATE statements will populate the new format fields even on staging DB where seed already ran. Safe to run multiple times.

### Remove bundled_products from seed-bootstrap.sql

Delete lines 28-36 (MfanisiGo bundled product insert) and update verification block

### Remove bundled_products from bootstrap.controller.ts

Remove bundled_products insert SQL (around line 129-131)

## 5. Code Updates (if any references exist)

Search for and update any TypeScript code referencing:

- `bundledProduct` or `bundled_product`
- Update any DTOs, entities, services using old schema

## Files to Modify

- `apps/api/src/constants/payment-cadence.constants.ts` (create)
- `apps/api/prisma/schema.prisma` (major updates)
- `apps/api/prisma/seed-product-management.sql` (add package_plans seed)
- `apps/api/prisma/seed-bootstrap.sql` (remove bundled_products)
- `apps/api/src/controllers/internal/bootstrap.controller.ts` (remove bundled_products)

## Verification Steps

1. Run migration successfully
2. Run seed scripts without errors
3. Verify package_plans table has 2 records (Silver, Gold)
4. Verify packages.policyNumberFormat and memberNumberFormat populated
5. Verify bundled_products table no longer exists
6. Generate Prisma client: `npx prisma generate`