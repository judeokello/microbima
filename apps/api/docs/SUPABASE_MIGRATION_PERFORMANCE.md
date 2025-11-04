# Supabase Migration Performance Guide

## Problem: Slow Migration Deployment (38+ minutes)

When deploying migrations to Supabase staging/production, migrations can take an extremely long time (30+ minutes) or appear to hang.

## Root Cause

Supabase provides two types of database connections:

1. **Pooled Connection** (`DATABASE_URL`): Goes through PgBouncer connection pooler
   - Fast for queries
   - **SLOW for migrations** (can take 30+ minutes)
   - Uses port `6543` (pooled) or `5432` with `?pgbouncer=true`

2. **Direct Connection** (`DIRECT_URL`): Direct PostgreSQL connection
   - Slightly slower for queries
   - **FAST for migrations** (5-10 minutes for large migrations)
   - Uses port `5432` directly

## Solution

### 1. Ensure DIRECT_URL is Set in Fly.io Secrets

For staging:
```bash
flyctl secrets set DIRECT_URL="postgresql://postgres.xxx:5432/postgres?sslmode=require" \
  --app microbima-staging-internal-api
```

For production:
```bash
flyctl secrets set DIRECT_URL="postgresql://postgres.xxx:5432/postgres?sslmode=require" \
  --app maishapoa-production-internal-api
```

### 2. Verify DIRECT_URL Format

The `DIRECT_URL` should:
- Use port `5432` (NOT `6543`)
- NOT include `?pgbouncer=true`
- Include `?sslmode=require` for SSL

Example:
```
# ✅ CORRECT (Direct connection)
postgresql://postgres.xxx:5432/postgres?sslmode=require

# ❌ WRONG (Pooled connection)
postgresql://postgres.xxx:6543/postgres?pgbouncer=true
```

### 3. Prisma Schema Configuration

Your `schema.prisma` should have both URLs configured:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled connection for queries
  directUrl = env("DIRECT_URL")        // Direct connection for migrations
}
```

Prisma automatically uses `directUrl` for migrations when available.

## How to Check if DIRECT_URL is Configured

### Option 1: Check Fly.io Secrets
```bash
flyctl secrets list --app microbima-staging-internal-api | grep DIRECT_URL
```

### Option 2: Check from Inside Container
```bash
flyctl ssh console -a microbima-staging-internal-api -C "sh -c 'echo \$DIRECT_URL'"
```

## Expected Migration Times

| Migration Size | Pooled Connection | Direct Connection |
|---------------|-------------------|-------------------|
| Small (< 50 lines) | 2-5 minutes | 30 seconds - 1 minute |
| Medium (50-200 lines) | 10-20 minutes | 2-5 minutes |
| Large (200+ lines) | 30+ minutes | 5-10 minutes |
| Init (412 lines) | 38+ minutes | 8-12 minutes |

## Troubleshooting

### Migration Hanging or Taking > 20 Minutes

1. **Check if DIRECT_URL is set:**
   ```bash
   flyctl secrets list --app microbima-staging-internal-api
   ```

2. **Check migration status:**
   ```bash
   flyctl ssh console -a microbima-staging-internal-api -C "sh -c 'cd /app/apps/api && npx prisma migrate status'"
   ```

3. **Check database connection:**
   ```bash
   flyctl ssh console -a microbima-staging-internal-api -C "sh -c 'cd /app/apps/api && npx prisma db execute --stdin' <<< 'SELECT 1;'"
   ```

4. **Check for locks:**
   ```bash
   flyctl ssh console -a microbima-staging-internal-api -C "sh -c 'cd /app/apps/api && npx prisma db execute --stdin' <<< 'SELECT * FROM pg_locks WHERE NOT granted;'"
   ```

### Migration Already Applied

If migrations are already applied but Prisma is checking them again, it can take a long time. Check migration status first:

```bash
flyctl ssh console -a microbima-staging-internal-api -C "sh -c 'cd /app/apps/api && npx prisma migrate status'"
```

If all migrations are already applied, `migrate deploy` will be fast (just verification).

## Best Practices

1. ✅ **Always set DIRECT_URL** for staging and production
2. ✅ **Check migration status** before deploying
3. ✅ **Use `--skip-seed`** flag to avoid running seed scripts during migration
4. ✅ **Monitor migration progress** - if it takes > 20 minutes, investigate
5. ✅ **Use direct connection** for all migration operations

## References

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Direct URLs](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#directurl)
- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)

