# MicroBima Database & Deployment Strategy

## Overview
This document outlines the database strategy, migration strategy, and deployment processes for MicroBima's staging and production environments on Fly.io.

---

## 1. Database Strategy: Staging vs Production

### 1.1 Separate Databases (Recommended Approach)
```
Staging Environment:
├── microbima-staging-internal-api → microbima-staging-db
├── microbima-staging-public-api → routes to staging
└── microbima-staging-web-admin → staging configs

Production Environment:
├── microbima-production-internal-api → microbima-prod-db
├── microbima-production-public-api → routes to production
└── microbima-production-web-admin → production configs
```

### 1.2 Benefits of Separate Databases
- ✅ **Complete isolation** between environments
- ✅ **Safe testing** without affecting production data
- ✅ **Independent scaling** for each environment
- ✅ **Easier debugging** and troubleshooting
- ✅ **No risk** of staging operations affecting production

### 1.3 Database Naming Convention
```
Staging: microbima-staging-db
Production: microbima-prod-db
```

---

## 2. Database Migration Strategy

### 2.1 Migration Workflow: Staging → Production
```
1. Local Development → 2. Staging Testing → 3. Production Deployment
     ↓                        ↓                        ↓
  Create migration        Test migration          Apply migration
  Test locally           Validate in staging      Deploy to production
```

### 2.2 Step-by-Step Migration Process

#### **Step 1: Create Migration Locally**
```bash
# In apps/api directory
cd apps/api

# Create a new migration
npx prisma migrate dev --name add_customer_beneficiaries

# This creates:
# - Migration file in prisma/migrations/
# - Applies migration to local database
# - Updates Prisma client
```

#### **Step 2: Test Migration on Staging**
```bash
# Deploy to staging first
cd ../../infra/fly/internal-api-staging
fly deploy

# SSH into staging app and run migration
fly ssh console -a microbima-staging-internal-api

# Inside staging console
cd /app
npx prisma migrate deploy
# This applies pending migrations

# Test the new functionality
# Run your test suite or manual testing
```

#### **Step 3: Apply Migration to Production**
```bash
# Only after successful staging testing
cd ../../infra/fly/internal-api-prod
fly deploy

# SSH into production app and run migration
fly ssh console -a microbima-production-internal-api

# Inside production console
cd /app
npx prisma migrate deploy
# This applies the same migration to production
```

### 2.3 Migration Safety Checks
- ✅ **Always test on staging first**
- ✅ **Verify data integrity** after migration
- ✅ **Run test suite** on staging
- ✅ **Check application functionality** on staging
- ✅ **Have rollback plan** ready

---

## 3. Environment-Specific Database URLs on Fly.io

### 3.1 Setting Up Database URLs

#### **Staging Database:**
```bash
# Set staging database URL
fly secrets set DATABASE_URL="postgresql://username:password@staging-host:5432/microbima_staging" \
  --app microbima-staging-internal-api

# Verify staging secrets
fly secrets list --app microbima-staging-internal-api
```

#### **Production Database:**
```bash
# Set production database URL
fly secrets set DATABASE_URL="postgresql://username:password@production-host:5432/microbima_prod" \
  --app microbima-production-internal-api

# Verify production secrets
fly secrets list --app microbima-production-internal-api
```

### 3.2 Database Connection Configuration
```typescript
// apps/api/src/config/database.config.ts
export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
  timeout: number;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'staging':
      return {
        url: process.env.DATABASE_URL!,
        poolSize: 10,
        ssl: true,
        timeout: 30000
      };
    case 'production':
      return {
        url: process.env.DATABASE_URL!,
        poolSize: 20,
        ssl: true,
        timeout: 60000
      };
    default: // development
      return {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/microbima_dev',
        poolSize: 5,
        ssl: false,
        timeout: 10000
      };
  }
};
```

---

## 4. CI/CD Deployment Strategy

### 4.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Fly.io

on:
  push:
    branches: [staging, main]
  workflow_dispatch: # Manual trigger

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Build application
        run: pnpm build
        
      - name: Deploy to Staging
        run: |
          cd infra/fly/internal-api-staging
          fly deploy --remote-only
          
      - name: Run database migration on staging
        run: |
          fly ssh console -a microbima-staging-internal-api -C "cd /app && npx prisma migrate deploy"

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: deploy-staging
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Build application
        run: pnpm build
        
      - name: Deploy to Production
        run: |
          cd infra/fly/internal-api-prod
          fly deploy --remote-only
          
      - name: Run database migration on production
        run: |
          fly ssh console -a microbima-production-internal-api -C "cd /app && npx prisma migrate deploy"
```

### 4.2 CI/CD Workflow
```
Feature Branch → Staging Branch → Main Branch
     ↓              ↓              ↓
  Local Dev    Auto-deploy    Auto-deploy
  & Testing    to Staging     to Production
               & Migration    & Migration
```

---

## 5. Manual Deployment Process (Alternative to CI/CD)

### 5.1 Manual Deployment to Staging
```bash
# 1. Switch to staging branch
git checkout staging
git pull origin staging

# 2. Deploy internal API to staging
cd infra/fly/internal-api-staging
fly deploy

# 3. Deploy public API (Kong) to staging
cd ../public-api-staging
fly deploy

# 4. Deploy web admin to staging
cd ../web-admin-staging
fly deploy

# 5. Run database migration on staging
fly ssh console -a microbima-staging-internal-api
cd /app
npx prisma migrate deploy
exit

# 6. Test staging environment
# Run your test suite or manual testing
```

### 5.2 Manual Deployment to Production
```bash
# 1. Switch to main branch
git checkout main
git pull origin main

# 2. Deploy internal API to production
cd infra/fly/internal-api-prod
fly deploy

# 3. Deploy public API (Kong) to production
cd ../public-api-prod
fly deploy

# 4. Deploy web admin to production
cd ../web-admin-prod
fly deploy

# 5. Run database migration on production
fly ssh console -a microbima-production-internal-api
cd /app
npx prisma migrate deploy
exit

# 6. Verify production deployment
# Check application health and functionality
```

### 5.3 Manual Deployment Checklist
- [ ] **Code reviewed** and tested locally
- [ ] **Staging deployment** successful
- [ ] **Staging testing** completed
- [ ] **Database migration** tested on staging
- [ ] **Production deployment** successful
- [ ] **Production migration** applied
- [ ] **Production verification** completed

---

## 6. Infrastructure Setup Commands

### 6.1 Create Staging Apps
```bash
# Create staging internal API app
cd infra/fly/internal-api-staging
fly apps create microbima-staging-internal-api

# Create staging public API app
cd ../public-api-staging
fly apps create microbima-staging-public-api

# Create staging web admin app
cd ../web-admin-staging
fly apps create microbima-staging-web-admin
```

### 6.2 Create Production Apps
```bash
# Create production internal API app
cd infra/fly/internal-api-prod
fly apps create microbima-production-internal-api

# Create production public API app
cd ../public-api-prod
fly apps create microbima-production-public-api

# Create production web admin app
cd ../web-admin-prod
fly apps create microbima-production-web-admin
```

### 6.3 Set Environment Variables
```bash
# Staging environment
fly secrets set NODE_ENV=staging --app microbima-staging-internal-api
fly secrets set NODE_ENV=staging --app microbima-staging-public-api
fly secrets set NODE_ENV=staging --app microbima-staging-web-admin

# Production environment
fly secrets set NODE_ENV=production --app microbima-production-internal-api
fly secrets set NODE_ENV=production --app microbima-production-public-api
fly secrets set NODE_ENV=production --app microbima-production-web-admin
```

---

## 7. Monitoring and Verification

### 7.1 Health Checks
```bash
# Check staging health
fly status --app microbima-staging-internal-api
fly status --app microbima-staging-public-api

# Check production health
fly status --app microbima-production-internal-api
fly status --app microbima-production-public-api
```

### 7.2 Log Monitoring
```bash
# Monitor staging logs
fly logs --app microbima-staging-internal-api

# Monitor production logs
fly logs --app microbima-production-internal-api
```

### 7.3 Database Verification
```bash
# Verify staging database
fly ssh console -a microbima-staging-internal-api
cd /app
npx prisma studio

# Verify production database
fly ssh console -a microbima-production-internal-api
cd /app
npx prisma studio
```

---

## 8. Rollback Strategy

### 8.1 Code Rollback
```bash
# Rollback to previous version
fly deploy --image-label v1.0.0 --app microbima-production-internal-api
```

### 8.2 Database Rollback
```bash
# Rollback last migration
fly ssh console -a microbima-production-internal-api
cd /app
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## 9. Best Practices Summary

### 9.1 Always:
- ✅ **Test migrations on staging first**
- ✅ **Verify functionality before production deployment**
- ✅ **Use separate databases for staging and production**
- ✅ **Monitor deployments and migrations**
- ✅ **Have rollback plans ready**

### 9.2 Never:
- ❌ **Skip staging testing**
- ❌ **Deploy untested migrations to production**
- ❌ **Use production database for development**
- ❌ **Skip health checks after deployment**

---

## 10. Next Steps

1. **Set up staging and production Fly apps**
2. **Configure environment-specific database URLs**
3. **Implement CI/CD pipeline**
4. **Test deployment workflow**
5. **Document any environment-specific configurations**

This strategy ensures safe, reliable deployments with proper testing and rollback capabilities.

