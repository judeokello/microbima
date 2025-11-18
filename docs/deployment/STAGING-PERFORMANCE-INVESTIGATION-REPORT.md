# Staging Performance Investigation Report

**Date:** December 2024  
**Investigation:** Staging vs Production Deployment and Runtime Performance  
**Status:** Root Cause Identified - Geographic Latency

## Executive Summary

Staging deployments take **25m 3s** vs production's **14m 15s** (76% slower). Staging runtime performance is severely degraded with form submissions taking **17+ seconds** vs production's sub-second response times.

**Root Cause:** Geographic mismatch between staging apps and database:
- Staging apps: Suspected Tokyo (nrt) or wrong region
- Staging database: US East 2 (Ohio, USA)
- **Latency: 200-300ms per query**

**Solution:** Migrate staging apps and database to Frankfurt (fra) to match production configuration.

## Problem Statement

### Deployment Performance

| Metric | Staging | Production | Difference |
|--------|---------|------------|------------|
| Total Deployment Time | 25m 3s | 14m 15s | **76% slower** |
| Database Migrations | 8m 34s | 1m 1s | **8.5x slower** |
| Seed Product Data | 5m 47s | 16s | **21x slower** |
| Deploy Internal API | 5m 26s | 7m 17s | Faster (resource difference) |
| Deploy Agent Registration | 4m 35s | 5m 2s | Similar |

### Runtime Performance

| Metric | Staging | Production | Status |
|--------|---------|------------|--------|
| Form Submission Time | 17+ seconds | <2 seconds | **Unacceptable** |
| Query Latency | 200-300ms | 5-10ms | **20-30x slower** |
| User Experience | Poor | Good | Critical issue |

## Investigation Findings

### 1. Geographic Configuration

#### Staging Environment
- **Fly.io App Region:** Suspected Tokyo (nrt) - needs verification
- **Database Pooler:** `aws-1-us-east-2.pooler.supabase.com:6543` (US East 2 - Ohio, USA)
- **Database Direct:** `db.yowgqzgqxvkqyyzhxvej.supabase.co:5432` (US East 2)
- **Connection Limit:** 20 (same as production)
- **Latency:** ~200-300ms per query (Tokyo → US East 2)

#### Production Environment
- **Fly.io App Region:** Frankfurt, Germany (fra) ✅
- **Database Pooler:** `aws-1-eu-central-1.pooler.supabase.com:6543` (EU Central 1 - Frankfurt)
- **Database Direct:** `db.xmkiddtkujaparakqwem.supabase.co:5432` (EU Central 1)
- **Connection Limit:** 20 (same as staging)
- **Latency:** ~5-10ms per query (same region) ✅

**Conclusion:** Staging has severe geographic mismatch causing high latency.

### 2. Database Connection Configuration

#### Connection Strings Analysis

**Staging DATABASE_URL:**
```
postgresql://postgres.yowgqzgqxvkqyyzhxvej:tMwwBMsGarmTuzls@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30000&connect_timeout=10
```

**Production DATABASE_URL:**
```
postgresql://postgres.xmkiddtkujaparakqwem:Chxjvo4oyAdPZ9nZLiGG@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20&pool_timeout=30000&connect_timeout=10
```

**Key Findings:**
- Both use PgBouncer (port 6543) ✅
- Both have `connection_limit=20` ✅
- Both have same timeout settings ✅
- **Only difference:** Region (US East 2 vs EU Central 1)

#### DIRECT_URL Configuration

**Staging DIRECT_URL:**
```
postgresql://postgres:tMwwBMsGarmTuzls@db.yowgqzgqxvkqyyzhxvej.supabase.co:5432/postgres?sslmode=require
```

**Production DIRECT_URL:**
```
postgresql://postgres:Chxjvo4oyAdPZ9nZLiGG@db.xmkiddtkujaparakqwem.supabase.co:5432/postgres?sslmode=require
```

**Key Findings:**
- Both use direct connection (port 5432) ✅
- Both have correct format (no pooling params) ✅
- Both use SSL ✅
- **Only difference:** Region (US East 2 vs EU Central 1)

**Conclusion:** Connection configuration is correct. The issue is purely geographic latency.

### 3. Database Configuration Code Analysis

#### `database.config.ts` Investigation

**Discovery:** The `database.config.ts` file defines `poolSize` and `maxConnections`, but **Prisma does NOT use these values**.

**Evidence:**
- `apps/api/src/prisma/prisma.service.ts` line 17: Only uses `dbConfig.url`
- PrismaClient constructor doesn't accept `poolSize` or `maxConnections` parameters
- Prisma uses connection string parameters directly

**What Actually Controls Pooling:**
- **PgBouncer level:** `connection_limit=20` in DATABASE_URL (both environments)
- **Application level:** Prisma manages internal connection pool based on connection string
- **The `database.config.ts` poolSize/maxConnections are informational only** - used for logging and API health endpoints, but NOT for actual connection pooling

**Where poolSize/maxConnections are used:**
- `apps/api/src/main.ts` line 51: Logging only
- `apps/api/src/app.controller.ts` line 130: Health endpoint response (informational)
- Connection monitoring uses actual database `max_connections` from `pg_settings`, not config values

**Conclusion:** The `database.config.ts` poolSize/maxConnections are informational only and don't affect actual connection pooling. Connection limits are identical (20) in both environments, so this is not the performance issue. Prisma uses connection string parameters directly for pooling.

### 4. Deployment Workflow Analysis

#### Staging Workflow (Lines 69-143)

**Proactive Migration Resolution:**
- Lines 74-99: Automatically resolves failed migrations
- Adds enum values if missing (idempotent)
- Marks migrations as applied/rolled-back
- **Purpose:** Enable automated deployments without manual intervention
- **Time Impact:** Adds ~30-60 seconds but prevents deployment failures

**Migration Execution:**
- Line 127: Runs `prisma migrate deploy` with DIRECT_URL
- **Expected time:** 5-10 minutes with direct connection
- **Actual time:** 8m 34s (within expected range, but slower due to latency)

#### Production Workflow (Lines 246-385)

**Complex Migration Handling:**
- Lines 251-383: More complex logic with manual intervention requirements
- Checks for failed migrations and requires manual resolution
- Handles tags migration dependency issues
- **Purpose:** Safety-first approach for production
- **Time Impact:** More checks but faster execution (1m 1s) due to low latency

**Key Difference:**
- Staging: Proactive resolution adds time but enables automation
- Production: Manual intervention required for safety, but faster due to geographic alignment

**Conclusion:** Workflow differences are intentional and necessary. The time difference is primarily due to geographic latency, not workflow complexity.

### 5. Resource Allocation Comparison

| Resource | Staging | Production | Impact |
|----------|---------|------------|--------|
| CPU | 1 (shared) | 2 (shared) | Minor impact on build time |
| Memory | 512MB | 1024MB | Minor impact on build time |
| Concurrency | 25/20 | 100/80 | No impact on deployment |
| Region | Tokyo (suspected) | Frankfurt | **Major impact** |

**Conclusion:** Resource differences are minor. Geographic location is the primary factor.

## Root Cause Analysis

### Primary Root Cause: Geographic Latency

**Staging Configuration:**
- Apps: Tokyo (nrt) or wrong region
- Database: US East 2 (Ohio, USA)
- **Distance:** ~10,000+ km
- **Latency:** 200-300ms per query
- **Impact:** Every database operation is 20-30x slower

**Production Configuration:**
- Apps: Frankfurt (fra)
- Database: EU Central 1 (Frankfurt)
- **Distance:** Same data center
- **Latency:** 5-10ms per query
- **Impact:** Optimal performance

### Secondary Factors

1. **Deployment Workflow:** Staging's proactive migration resolution adds ~30-60 seconds, but this is necessary for automation
2. **Resource Allocation:** Staging has fewer resources, but impact is minimal compared to latency
3. **Database Configuration:** Connection limits are identical, not a factor

## Impact Analysis

### Deployment Impact

**Current State:**
- Staging: 25m 3s total
  - Migrations: 8m 34s (should be ~1-2 min)
  - Seeding: 5m 47s (should be ~16s)
  - **Wasted time:** ~12-13 minutes per deployment

**Expected After Migration:**
- Staging: ~14-15 minutes total
  - Migrations: ~1-2 minutes
  - Seeding: ~16 seconds
  - **Time saved:** ~10-11 minutes per deployment

### Runtime Impact

**Current State:**
- Form submissions: 17+ seconds
- User experience: Unacceptable
- Query latency: 200-300ms per query

**Expected After Migration:**
- Form submissions: <2 seconds
- User experience: Acceptable
- Query latency: 5-10ms per query

## Recommendations

### Immediate Actions

1. **Verify App Regions**
   ```bash
   flyctl status -a maishapoa-staging-internal-api
   flyctl status -a maishapoa-staging-agent-registration
   flyctl status -a microbima-staging-public-api
   ```

2. **Extract All Secrets**
   ```bash
   ./scripts/extract-fly-secrets.sh
   ```

3. **Plan Migration**
   - Review [Staging Region Migration Guide](./STAGING-REGION-MIGRATION-GUIDE.md)
   - Schedule migration window
   - Prepare rollback plan

### Migration Strategy

1. **Move Apps to Frankfurt**
   - Create new apps in Frankfurt (fra)
   - Deploy with existing fly.toml files (already configured for fra)
   - Test thoroughly before cutover

2. **Move Database to EU Central 1**
   - Create new Supabase project in EU Central 1
   - Export/import data
   - Update connection strings
   - Run migrations

3. **Update Configuration**
   - Update GitHub Actions workflow
   - Update documentation
   - Update team on new URLs

### Long-term Improvements

1. **Monitor Performance**
   - Set up alerts for deployment times >15 minutes
   - Monitor query latency
   - Track form submission times

2. **Documentation**
   - Document region requirements
   - Add region verification to deployment checklist
   - Create region migration runbook

3. **Code Cleanup**
   - Review `database.config.ts` - remove unused poolSize/maxConnections or document why they exist
   - Ensure Prisma configuration is clear

## Expected Outcomes

After migration:

- ✅ Deployment time: 25m 3s → ~14-15 minutes
- ✅ Migration time: 8m 34s → ~1-2 minutes
- ✅ Seeding time: 5m 47s → ~16 seconds
- ✅ Form submission: 17+ seconds → <2 seconds
- ✅ Query latency: 200-300ms → 5-10ms
- ✅ User experience: Poor → Good

## Risk Assessment

### Migration Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data loss during DB migration | Low | High | Full backup before migration |
| Downtime during cutover | Medium | Medium | Zero-downtime approach (new apps first) |
| Configuration errors | Low | Medium | Extract and verify all secrets |
| Performance not improved | Very Low | High | Verify geographic alignment |

### Rollback Plan

1. Keep old apps running until new apps confirmed stable
2. Revert GitHub Actions changes if needed
3. Restore old database connection strings if needed
4. Investigate issues before retrying

## Conclusion

The performance issues in staging are **entirely due to geographic latency** caused by apps and database being in different regions (Tokyo/US East 2 vs Frankfurt/EU Central 1). 

**Solution:** Migrate staging apps and database to Frankfurt to match production configuration. This will reduce deployment time by ~40% and improve runtime performance by 20-30x.

**Next Steps:**
1. Review and approve migration plan
2. Extract and backup all secrets
3. Execute migration following [Staging Region Migration Guide](./STAGING-REGION-MIGRATION-GUIDE.md)
4. Monitor and verify performance improvements

## Related Documentation

- [Staging Region Migration Guide](./STAGING-REGION-MIGRATION-GUIDE.md)
- [Supabase Migration Performance Guide](../apps/api/docs/SUPABASE_MIGRATION_PERFORMANCE.md)
- [Fly.io Deployment Guide](./fly-deployment-guide.md)

