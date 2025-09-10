# Production Deployment Safety Guide

## Overview

This guide outlines the safe deployment process for MicroBima production environment, focusing on database migrations and data safety. The approach prioritizes manual control during initial phases and gradually introduces automation as confidence grows.

## Deployment Philosophy

**Phase 1: Manual Control** (Current)
- Full manual control over all deployment steps
- Maximum visibility and safety
- Learn the process thoroughly

**Phase 2: Semi-Automated** (Future)
- Automated code deployment
- Manual database migrations with safety checks
- Gradual automation introduction

**Phase 3: Fully Automated** (Mature)
- Complete automation with extensive monitoring
- Automated rollback capabilities
- Advanced safety mechanisms

## Current Production Deployment Process

### Step 1: Pre-Deployment Checklist

- [ ] **Staging verification complete** - All features tested on staging
- [ ] **Database backup created** - Full backup of production database
- [ ] **Migration plan reviewed** - Understand what changes will be applied
- [ ] **Rollback plan prepared** - Know how to revert if needed
- [ ] **Team notified** - Inform team of production deployment

### Step 2: Code Deployment

```bash
# 1. Merge staging into master
git checkout master
git pull origin master
git merge staging
git push origin master

# 2. Monitor GitHub Actions deployment
# - Check Actions tab for deployment progress
# - Verify all steps complete successfully
# - Note any warnings or errors
```

### Step 3: Database Migration (Manual)

```bash
# 1. SSH into production container
flyctl ssh console -a microbima-production-internal-api

# 2. Check current migration status
pnpm prisma migrate status

# 3. Review pending migrations
# - Understand what each migration does
# - Verify no destructive changes
# - Check for data type changes

# 4. Run migrations
pnpm prisma migrate deploy

# 5. Verify migration success
pnpm prisma migrate status
```

### Step 4: Database Seeding (If Needed)

```bash
# 1. Check if seeding is needed
# - Only seed if database is empty or needs test data
# - Never seed production with test data

# 2. Run seeding (if required)
pnpm db:seed

# 3. Verify data integrity
# - Check key tables have expected data
# - Verify relationships are correct
```

### Step 5: Post-Deployment Verification

```bash
# 1. Health check
curl -f https://microbima-production-internal-api.fly.dev/api/health

# 2. Test critical endpoints
curl -f https://microbima-production-internal-api.fly.dev/api/internal/customers

# 3. Check application logs
flyctl logs -a microbima-production-internal-api

# 4. Monitor for errors
# - Watch logs for 10-15 minutes
# - Check for any error patterns
# - Verify performance is normal
```

## Database Safety Mechanisms

### 1. Migration Preview

```bash
# See what migrations will be applied
pnpm prisma migrate status

# Generate migration without applying (for testing)
pnpm prisma migrate dev --create-only --name your_migration_name

# Review generated SQL file
cat prisma/migrations/YYYYMMDD_your_migration_name/migration.sql
```

### 2. Database Backups

```bash
# Create backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -la backup_*.sql

# Restore if needed (EMERGENCY ONLY)
psql $DATABASE_URL < backup_file.sql
```

### 3. Migration Types and Safety

#### ✅ Safe Operations
- **Adding columns** with default values
- **Adding indexes** (non-unique)
- **Adding tables**
- **Adding foreign key constraints** (if data allows)

#### ⚠️ Potentially Destructive Operations
- **Removing columns** (data loss)
- **Changing column types** (data conversion issues)
- **Adding unique constraints** (duplicate data conflicts)
- **Removing tables** (data loss)

#### 🚨 Dangerous Operations
- **Dropping columns** (permanent data loss)
- **Dropping tables** (permanent data loss)
- **Changing primary keys** (relationship issues)

### 4. Rollback Procedures

#### If Migration Fails
```bash
# 1. Check migration status
pnpm prisma migrate status

# 2. Review error logs
flyctl logs -a microbima-production-internal-api

# 3. Fix the issue
# - Correct the migration file
# - Or resolve data conflicts

# 4. Retry migration
pnpm prisma migrate deploy
```

#### If Application Issues Occur
```bash
# 1. Immediate rollback to previous code
git checkout master
git revert HEAD
git push origin master

# 2. This triggers automatic rollback deployment
# 3. Monitor rollback success
# 4. Investigate issue in staging
```

## Monitoring and Alerts

### Key Metrics to Watch
- **API response times** - Should remain consistent
- **Error rates** - Should not increase significantly
- **Database connection pool** - Should not be exhausted
- **Memory usage** - Should remain stable

### Log Monitoring
```bash
# Real-time logs
flyctl logs -a microbima-production-internal-api -f

# Recent logs
flyctl logs -a microbima-production-internal-api --since 1h

# Error logs only
flyctl logs -a microbima-production-internal-api | grep -i error
```

## Emergency Procedures

### Database Issues
1. **Stop application** - Prevent further data corruption
2. **Restore from backup** - If data corruption occurred
3. **Fix migration** - Correct the problematic migration
4. **Re-run migration** - Apply corrected migration
5. **Restart application** - Resume normal operations

### Application Issues
1. **Rollback code** - Revert to previous working version
2. **Monitor logs** - Identify the root cause
3. **Fix in staging** - Test the fix thoroughly
4. **Re-deploy** - Apply fix to production

## Future Automation Roadmap

### Phase 2: Semi-Automated (When Ready)
```yaml
# Add to GitHub Actions workflow
- name: Production Migration (Manual Approval)
  if: github.ref == 'refs/heads/master'
  run: |
    echo "⚠️  PRODUCTION MIGRATION REQUIRED"
    echo "Review pending migrations:"
    flyctl ssh console -a microbima-production-internal-api -C "pnpm prisma migrate status"
    echo "Press any key to continue..."
    read -n 1
    flyctl ssh console -a microbima-production-internal-api -C "pnpm prisma migrate deploy"
```

### Phase 3: Fully Automated (Mature System)
```yaml
# Automated with extensive safety checks
- name: Automated Production Migration
  if: github.ref == 'refs/heads/master'
  run: |
    # Pre-migration checks
    flyctl ssh console -a microbima-production-internal-api -C "pnpm prisma migrate status"
    
    # Create backup
    flyctl ssh console -a microbima-production-internal-api -C "pg_dump \$DATABASE_URL > backup_\$(date +%Y%m%d_%H%M%S).sql"
    
    # Run migration
    flyctl ssh console -a microbima-production-internal-api -C "pnpm prisma migrate deploy"
    
    # Post-migration verification
    flyctl ssh console -a microbima-production-internal-api -C "pnpm prisma migrate status"
```

## Best Practices

### Always Do
- ✅ Test migrations on staging first
- ✅ Create database backups before migrations
- ✅ Review migration SQL before applying
- ✅ Monitor application after deployment
- ✅ Have rollback plan ready

### Never Do
- ❌ Skip staging testing
- ❌ Run migrations without backup
- ❌ Deploy on Fridays (if possible)
- ❌ Ignore error logs
- ❌ Skip post-deployment verification

## Troubleshooting Common Issues

### Migration Fails
- **Check database connectivity**
- **Verify migration SQL syntax**
- **Check for data conflicts**
- **Review foreign key constraints**

### Application Won't Start
- **Check environment variables**
- **Verify database schema matches code**
- **Review application logs**
- **Check resource limits**

### Performance Issues
- **Monitor database queries**
- **Check for missing indexes**
- **Review connection pool settings**
- **Monitor memory usage**

## Contact Information

- **Primary Developer**: [Your Name]
- **Database Admin**: [Database Admin]
- **DevOps Lead**: [DevOps Lead]
- **Emergency Contact**: [Emergency Contact]

---

**Last Updated**: September 10, 2025
**Version**: 1.0
**Status**: ✅ Active

## Appendix: Quick Reference Commands

```bash
# Production deployment
git checkout master && git merge staging && git push origin master

# Database migration
flyctl ssh console -a microbima-production-internal-api
pnpm prisma migrate status
pnpm prisma migrate deploy

# Health check
curl -f https://microbima-production-internal-api.fly.dev/api/health

# View logs
flyctl logs -a microbima-production-internal-api -f
```
