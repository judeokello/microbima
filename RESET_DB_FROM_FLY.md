# Reset Staging Database from Fly.io App

## Overview
This guide walks you through resetting the database directly from within your Fly.io app container.
**Benefit**: No need to worry about connection strings - they're already configured in the app!

---

## Step-by-Step Instructions

### 1. List Your Fly Apps
First, let's see what apps you have:

```bash
fly apps list
```

Look for your staging API app (probably something like `microbima-api-staging` or similar).

### 2. SSH into Your Fly App
```bash
fly ssh console -a YOUR_APP_NAME
```

Example:
```bash
fly ssh console -a microbima-api-staging
```

### 3. Navigate to the API Directory
Once inside the container:

```bash
cd /app/apps/api
```

Or if the structure is different:
```bash
cd /app
find . -name "schema.prisma"
# This will show you where your Prisma schema is
```

### 4. Check Current Database Connection
Verify the DATABASE_URL is set:

```bash
echo $DATABASE_URL
```

You should see a PostgreSQL connection string (the password will be hidden).

### 5. Drop and Recreate the Schema

**Option A: Using Prisma DB Push (Recommended)**
This will sync your schema to the database, dropping conflicting tables:

```bash
npx prisma db push --accept-data-loss
```

**Option B: Using Prisma Migrate Reset**
This drops everything and recreates from scratch:

```bash
npx prisma migrate reset --force --skip-seed
```

### 6. Verify Tables Were Created

```bash
npx prisma db pull
```

If this completes without errors, your tables are created!

### 7. (Optional) Run Seeds
If you have a seed file:

```bash
npx prisma db seed
```

Or skip this and use your bootstrap page instead.

### 8. Exit the SSH Session
```bash
exit
```

---

## Quick Command Summary

```bash
# 1. SSH into your Fly app
fly ssh console -a YOUR_APP_NAME

# 2. Navigate to Prisma directory
cd /app/apps/api

# 3. Reset database
npx prisma db push --accept-data-loss

# 4. Exit
exit
```

---

## If Prisma Commands Don't Work

### Issue: "npx: command not found"
The container might not have Node.js tools in PATH. Try:

```bash
# Find Node
which node

# Use full path
/usr/local/bin/node /app/node_modules/.bin/prisma db push --accept-data-loss
```

### Issue: "Cannot find Prisma schema"
Make sure you're in the right directory:

```bash
pwd
ls -la
# Look for prisma/ directory or schema.prisma file
```

### Issue: "Permission denied"
You might need to run as root:

```bash
# Exit and SSH as root
exit
fly ssh console -a YOUR_APP_NAME --pty -C "sh"
```

---

## Alternative: Execute Command Directly

You can also run commands without an interactive SSH session:

```bash
fly ssh console -a YOUR_APP_NAME -C "cd /app/apps/api && npx prisma db push --accept-data-loss"
```

---

## After Reset Checklist

1. ✅ Tables created successfully
2. ✅ Visit bootstrap page: `https://your-app.fly.dev/bootstrap`
3. ✅ Create partner and BA users
4. ✅ Test registration flow with new payment fields

---

## Troubleshooting

### "Can't reach database"
```bash
# Check if DATABASE_URL is set
env | grep DATABASE_URL

# Test connection
npx prisma db execute --stdin <<< "SELECT 1;"
```

### "Migration history mismatch"
```bash
# Ignore migration history and force push schema
npx prisma db push --accept-data-loss --force-reset
```

### "Too many connections"
```bash
# Your Supabase might have connection limits
# Wait a minute and try again, or scale down other services temporarily
```

---

## What This Does

The `npx prisma db push --accept-data-loss` command will:
1. 🗑️ Drop tables that conflict with your schema
2. 📊 Create all tables defined in schema.prisma
3. 🔗 Set up all foreign key relationships
4. ✅ Make your database match your code exactly

---

## Safety Notes

- ⚠️ This will **delete all data** in the staging database
- ✅ Perfect for staging/testing environments
- ❌ **NEVER** run this on production [[memory:8653737]]
- 💾 Always backup production data before schema changes

---

## Expected Output

Success looks like:
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public"

🚀  Your database is now in sync with your Prisma schema. Done in XXXms

✔ Generated Prisma Client
```

Failure looks like:
```
Error: P1001: Can't reach database server...
```

If you see an error, check your DATABASE_URL configuration in Fly secrets.


