# Fixing Failed Migration in Staging

The migration `20251030180217_add_package_plans_and_policy_payments` failed because it tried to use the `PENDING_ACTIVATION` enum value before it was added to the database.

## Solution

### Step 1: Mark the failed migration as rolled back

SSH into staging and mark the failed migration as rolled back:

```bash
flyctl ssh console -a microbima-staging-internal-api
cd /app/apps/api
npx prisma migrate resolve --rolled-back 20251030180217_add_package_plans_and_policy_payments
```

### Step 2: Manually add the enum value (if needed)

If the enum value doesn't exist yet, add it manually:

```bash
# Connect to the database and add the enum value
psql $DATABASE_URL -c "ALTER TYPE \"public\".\"PolicyStatus\" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';"
```

Or using Prisma:

```bash
npx prisma db execute --stdin <<< "ALTER TYPE \"public\".\"PolicyStatus\" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';"
```

### Step 3: Mark the enum migration as applied

```bash
npx prisma migrate resolve --applied 20251030180216_add_pending_activation_enum
```

### Step 4: Retry the main migration

```bash
npx prisma migrate deploy
```

### Step 5: Verify migration status

```bash
npx prisma migrate status
```

You should see all migrations as applied.

## Alternative: One-Step Fix

If you want to fix it all at once:

```bash
flyctl ssh console -a microbima-staging-internal-api
cd /app/apps/api

# Add enum value manually
npx prisma db execute --stdin <<< "ALTER TYPE \"public\".\"PolicyStatus\" ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';"

# Mark enum migration as applied (if migration file exists)
npx prisma migrate resolve --applied 20251030180216_add_pending_activation_enum 2>/dev/null || true

# Mark failed migration as rolled back
npx prisma migrate resolve --rolled-back 20251030180217_add_package_plans_and_policy_payments

# Retry migration
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

