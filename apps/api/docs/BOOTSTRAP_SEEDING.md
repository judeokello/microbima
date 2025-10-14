# Bootstrap Seeding Guide

## Overview

This guide explains how to seed essential data that requires a `createdBy` user reference after creating the bootstrap user.

## The Problem

- **Migrations run first** → No users exist yet
- **Bootstrap creates first user** → Happens after migrations
- **Some data requires `createdBy`** → Can't seed during migration

## The Solution

Seed essential data (Partners, Bundled Products) **after** creating the bootstrap user.

---

## Implementation

### Option 1: Use TypeScript Function (Recommended)

In your bootstrap code (wherever you create the first admin user):

```typescript
import { seedBootstrapData } from './utils/seed-bootstrap-data';

// After creating the bootstrap user
const bootstrapUser = await supabase.auth.admin.createUser({
  email: 'admin@maishapoa.co.ke',
  password: 'SecurePassword123!',
  email_confirm: true,
  user_metadata: {
    roles: ['admin'],
    partnerId: 1,
  },
});

// Seed essential data
await seedBootstrapData(bootstrapUser.data.user.id);
```

### Option 2: Use SQL Script Manually

If you prefer to run SQL manually after bootstrap:

```bash
# SSH into your Fly.io app
fly ssh console -a your-app-name

# Run the seed script
psql $DATABASE_URL -f /app/prisma/seed-bootstrap.sql
```

### Option 3: Use Prisma Raw SQL in Bootstrap Endpoint

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function bootstrapWithSeeding(userId: string) {
  // Seed Maisha Poa partner
  await prisma.$executeRaw`
    INSERT INTO "partners" ("id", "partnerName", "website", "officeLocation", "isActive", "createdAt", "updatedAt", "createdBy")
    VALUES (1, 'Maisha Poa', 'www.maishapoa.co.ke', 'Lotus Plaza, Parklands, Nairobi', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${userId}::uuid)
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed MfanisiGo product
  await prisma.$executeRaw`
    INSERT INTO "bundled_products" ("name", "description", "created_by")
    VALUES ('MfanisiGo', 'Owned by the OOD drivers', ${userId}::uuid)
    ON CONFLICT DO NOTHING
  `;
}
```

---

## Files Created

1. **`src/utils/seed-bootstrap-data.ts`** - TypeScript utility function
2. **`prisma/seed-bootstrap.sql`** - SQL seed script
3. **`docs/BOOTSTRAP_SEEDING.md`** - This documentation

---

## What Gets Seeded

### Partners Table
- **ID:** 1
- **Partner Name:** Maisha Poa
- **Website:** www.maishapoa.co.ke
- **Office Location:** Lotus Plaza, Parklands, Nairobi
- **Is Active:** true
- **Created By:** Bootstrap user ID

### Bundled Products Table
- **Name:** MfanisiGo
- **Description:** Owned by the OOD drivers
- **Created By:** Bootstrap user ID

---

## Migration Timeline

1. ✅ **Deploy API** → Runs `npx prisma migrate deploy`
2. ✅ **Migrations run** → Creates tables (partners, bundled_products, etc.)
3. ✅ **Create bootstrap user** → Via bootstrap endpoint/script
4. ✅ **Seed essential data** → Call `seedBootstrapData(userId)`

---

## Deployment Checklist

- [ ] Deploy API to Fly.io
- [ ] SSH into Fly.io app
- [ ] Run `npx prisma migrate deploy`
- [ ] Create bootstrap user (via endpoint or script)
- [ ] Call `seedBootstrapData(userId)` or run `seed-bootstrap.sql`
- [ ] Verify data: `SELECT * FROM partners WHERE id = 1;`
- [ ] Verify data: `SELECT * FROM bundled_products WHERE name = 'MfanisiGo';`

---

## Notes

- The seed scripts use `ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS` to prevent duplicates
- Both the TypeScript function and SQL script are idempotent (safe to run multiple times)
- The `createdBy` field will reference the first user created in `auth.users`

