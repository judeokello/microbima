# Staging Database Reset Guide

## Overview
This guide will help you drop and recreate the staging database from scratch after the deployment to Fly.

## Prerequisites
- Deployment to staging/production is complete
- You have access to Supabase dashboard for your staging database
- You have the database connection string

---

## Option 1: Using Supabase Dashboard (Recommended)

### Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your staging project
3. Navigate to **SQL Editor**

### Step 2: Drop All Tables
Run this SQL script to drop all existing tables:

```sql
-- Drop all tables in the correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS "ba_payouts" CASCADE;
DROP TABLE IF EXISTS "missing_requirements" CASCADE;
DROP TABLE IF EXISTS "agent_registrations" CASCADE;
DROP TABLE IF EXISTS "brand_ambassadors" CASCADE;
DROP TABLE IF EXISTS "deferred_requirement_partners" CASCADE;
DROP TABLE IF EXISTS "deferred_requirements" CASCADE;
DROP TABLE IF EXISTS "beneficiaries" CASCADE;
DROP TABLE IF EXISTS "dependants" CASCADE;
DROP TABLE IF EXISTS "policy_claims" CASCADE;
DROP TABLE IF EXISTS "policies" CASCADE;
DROP TABLE IF EXISTS "partner_customers" CASCADE;
DROP TABLE IF EXISTS "customers" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "partner_api_keys" CASCADE;
DROP TABLE IF EXISTS "partner_contacts" CASCADE;
DROP TABLE IF EXISTS "partners" CASCADE;

-- Drop any remaining tables (if any)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### Step 3: Run Prisma Migrations
From your local machine (connected to staging):

```bash
# Navigate to the API directory
cd /home/judeokello/Projects/microbima/apps/api

# Set the staging database URL
export DATABASE_URL="your_staging_database_url"
export DIRECT_URL="your_staging_direct_url"

# Push the schema to create all tables
npx prisma db push

# Verify the schema
npx prisma db pull
```

### Step 4: Verify Tables Created
In Supabase SQL Editor, run:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see all your tables listed.

---

## Option 2: Using Fly SSH (If deployed on Fly)

### Step 1: SSH into your Fly instance
```bash
fly ssh console -a your-staging-app-name
```

### Step 2: Run Prisma commands inside the container
```bash
# Navigate to the app directory
cd /app/apps/api

# Reset the database (this will drop all tables and recreate)
npx prisma migrate reset --force --skip-seed

# Or just push the schema
npx prisma db push --accept-data-loss
```

---

## Option 3: Using Environment Variables from Fly

### Step 1: Get your staging database URL
```bash
# List all secrets
fly secrets list -a your-staging-app-name

# If you need to set them
fly secrets set DATABASE_URL="postgresql://..." -a your-staging-app-name
fly secrets set DIRECT_URL="postgresql://..." -a your-staging-app-name
```

### Step 2: Run migrations locally pointing to staging
```bash
cd /home/judeokello/Projects/microbima/apps/api

# Set environment variables
export DATABASE_URL="your_staging_url_from_fly"
export DIRECT_URL="your_staging_direct_url_from_fly"

# Drop and recreate
npx prisma migrate reset --force --skip-seed

# Or just push
npx prisma db push
```

---

## Post-Reset Steps

### 1. Create Initial Partner Records
Use your bootstrap page or run:

```bash
# From apps/api directory with staging DB URL set
npx prisma db seed
```

### 2. Verify the Bootstrap Page Works
Navigate to: `https://your-staging-url.fly.dev/bootstrap`

Create your initial users/partners through the UI.

### 3. Test the Payment Page
1. Go through the registration flow
2. Verify the new fields appear:
   - ✅ Payment Type dropdown (MPESA/SasaPay)
   - ✅ Payment Phone Number (required)
   - ✅ Transaction Reference (required)
   - ✅ Payment end date (276 days from now)
3. Verify the Payment Instructions section is commented out

---

## Quick Commands Reference

### Check current tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Check Prisma migrations status
```bash
npx prisma migrate status
```

### Generate Prisma Client
```bash
npx prisma generate
```

### Push schema without migrations
```bash
npx prisma db push
```

### Reset database (drops all, recreates)
```bash
npx prisma migrate reset --force
```

---

## Environment Variables Needed

Make sure these are set in Fly:
```bash
DATABASE_URL="postgresql://postgres:[password]@[host]/postgres"
DIRECT_URL="postgresql://postgres:[password]@[host]/postgres"
```

---

## Troubleshooting

### "Relation already exists" error
```bash
# Drop everything and start fresh using Option 1, Step 2
```

### "Cannot connect to database"
```bash
# Check your DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

### Migration files out of sync
```bash
# Delete local migration files
rm -rf prisma/migrations

# Push schema directly
npx prisma db push
```

---

## Schema Changes Included in This Deployment

The latest schema includes:
- Agent Registration tables
- Brand Ambassador tables
- Missing Requirements tracking
- BA Payout system
- All updated customer and beneficiary fields

All tables will be created fresh with the correct structure.

---

## Next Steps After DB Reset

1. ✅ Create partner records via bootstrap
2. ✅ Create brand ambassador users
3. ✅ Test registration flow
4. ✅ Test payment form with new fields
5. ✅ Verify data is being saved correctly

---

## Quick Reset Script

Save this as `reset-staging-db.sh`:

```bash
#!/bin/bash

# Configuration
DB_URL="your_staging_url_here"
DIRECT_URL="your_staging_direct_url_here"

# Export environment variables
export DATABASE_URL="$DB_URL"
export DIRECT_URL="$DIRECT_URL"

# Navigate to API directory
cd "$(dirname "$0")/apps/api"

# Reset database
echo "Resetting database..."
npx prisma db push --accept-data-loss --force-reset

# Verify
echo "Verifying tables..."
npx prisma db pull

echo "✅ Database reset complete!"
echo "👉 Next: Visit your bootstrap page to create initial users"
```

Make it executable:
```bash
chmod +x reset-staging-db.sh
```

Run it:
```bash
./reset-staging-db.sh
```


