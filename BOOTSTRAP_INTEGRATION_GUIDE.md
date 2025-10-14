# Bootstrap Data Seeding - Integration Guide

## 📋 Summary

The **BundledProducts** migration has been updated to **NOT** include seed data. Instead, you must seed the following data **AFTER** creating the bootstrap user:

1. **Maisha Poa partner** (partnerId = 1)
2. **MfanisiGo bundled product**

## 🎯 Why This Change?

**Problem:** Migrations run before any users exist in `auth.users`, but our seed data requires a `createdBy` field.

**Solution:** Seed this data after creating the bootstrap user.

---

## 🚀 Integration Options

### **Option 1: Add to Brand Ambassador Creation (Quick Fix)**

Since you're already creating Brand Ambassadors via the frontend, you could add the seeding logic there:

**File:** `apps/api/src/services/partner-management.service.ts`

```typescript
import { seedBootstrapData } from '../utils/seed-bootstrap-data';

async createBrandAmbassador(...) {
  // ... existing code ...
  
  const userId = userResult.data.id;
  
  // ** ADD THIS: Seed bootstrap data on first BA creation **
  try {
    await seedBootstrapData(userId);
  } catch (error) {
    this.logger.warn('Bootstrap data already seeded or error seeding', error);
    // Don't fail BA creation if seeding fails (data might already exist)
  }
  
  // ... rest of existing code ...
}
```

### **Option 2: Create a Bootstrap Endpoint (Recommended)**

Create a dedicated endpoint for bootstrapping the system:

**File:** `apps/api/src/controllers/internal/bootstrap.controller.ts` (NEW FILE)

```typescript
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from '../../services/supabase.service';
import { seedBootstrapData } from '../../utils/seed-bootstrap-data';

@ApiTags('Bootstrap')
@Controller('api/internal/bootstrap')
export class BootstrapController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('initialize')
  @ApiOperation({ summary: 'Initialize system with bootstrap user and seed data' })
  @ApiResponse({ status: 201, description: 'System bootstrapped successfully' })
  async initialize(@Body() data: {
    email: string;
    password: string;
    displayName: string;
  }) {
    // 1. Create bootstrap user
    const userResult = await this.supabaseService.createUser({
      email: data.email,
      password: data.password,
      userMetadata: {
        roles: ['admin', 'super_admin'],
        partnerId: 1,
        displayName: data.displayName,
      },
    });

    if (!userResult.success) {
      throw new Error(`Failed to create bootstrap user: ${userResult.error}`);
    }

    const userId = userResult.data.id;

    // 2. Seed essential data
    await seedBootstrapData(userId);

    return {
      success: true,
      message: 'System bootstrapped successfully',
      userId: userId,
      data: {
        partnerCreated: 'Maisha Poa',
        productCreated: 'MfanisiGo',
      },
    };
  }
}
```

**Don't forget to add to AppModule:**

```typescript
// apps/api/src/app.module.ts
import { BootstrapController } from './controllers/internal/bootstrap.controller';

@Module({
  controllers: [
    // ... existing controllers
    BootstrapController,
  ],
  // ...
})
```

### **Option 3: Run SQL Manually After Bootstrap**

If you prefer manual control:

```bash
# After deploying and creating the first user
fly ssh console -a your-app-name

# Run the seed script
psql $DATABASE_URL -f /app/prisma/seed-bootstrap.sql
```

---

## 📦 Files Created

1. **`apps/api/src/utils/seed-bootstrap-data.ts`**
   - TypeScript function to seed data
   - Can be called from anywhere in your code

2. **`apps/api/prisma/seed-bootstrap.sql`**
   - SQL script for manual seeding
   - Idempotent (safe to run multiple times)

3. **`apps/api/docs/BOOTSTRAP_SEEDING.md`**
   - Detailed documentation

4. **`apps/api/prisma/migrations/20251014154123_add_bundled_products/migration.sql`**
   - Updated to NOT include seed data
   - Schema only (tables, indexes, foreign keys)

---

## 🎯 Recommended Approach

**I recommend Option 2** (Bootstrap Endpoint) because:

✅ Clean separation of concerns
✅ One-time operation that's explicit
✅ Can be called from a script or manually
✅ Easy to test and verify

---

## 📝 Deployment Steps

### For Staging/Production

1. **Deploy API** (migrations run automatically)
   ```bash
   git push origin staging  # or master for prod
   ```

2. **SSH into Fly.io**
   ```bash
   fly ssh console -a microbima-internal-api-staging
   ```

3. **Create Bootstrap User & Seed Data**
   
   **Option A: Use the bootstrap endpoint** (if you created it)
   ```bash
   curl -X POST http://localhost:8080/api/internal/bootstrap/initialize \
     -H "Content-Type: application/json" \
     -H "x-correlation-id: bootstrap-$(date +%s)" \
     -d '{
       "email": "admin@maishapoa.co.ke",
       "password": "SecurePassword123!",
       "displayName": "System Administrator"
     }'
   ```

   **Option B: Run SQL manually**
   ```bash
   psql $DATABASE_URL -f /app/prisma/seed-bootstrap.sql
   ```

4. **Verify**
   ```bash
   psql $DATABASE_URL -c "SELECT id, \"partnerName\" FROM partners WHERE id = 1;"
   psql $DATABASE_URL -c "SELECT name FROM bundled_products WHERE name = 'MfanisiGo';"
   ```

---

## ✅ Checklist

- [ ] Choose integration option (1, 2, or 3)
- [ ] Implement the chosen option
- [ ] Test on local environment
- [ ] Deploy to staging
- [ ] Run bootstrap/seeding
- [ ] Verify data exists
- [ ] Document the process for your team
- [ ] Deploy to production
- [ ] Run bootstrap/seeding in production

---

## 🆘 Troubleshooting

**Issue:** "No user found in auth.users"
- **Solution:** Make sure you create the bootstrap user first before running the seed

**Issue:** "Partner already exists"
- **Solution:** This is normal - the seed scripts are idempotent and won't create duplicates

**Issue:** "Foreign key violation on createdBy"
- **Solution:** The user ID doesn't exist in auth.users - check your user creation

---

## 📞 Need Help?

Refer to `/home/judeokello/Projects/microbima/apps/api/docs/BOOTSTRAP_SEEDING.md` for more detailed documentation.

