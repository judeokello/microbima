# Production Deployment Guide

## Overview

This guide provides comprehensive instructions for safely deploying MaishaPoa services to production on Fly.io.

## Table of Contents

1. [Production Applications](#production-applications)
2. [Deployment Architecture](#deployment-architecture)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [Deployment Process](#deployment-process)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Safety Checklist](#safety-checklist)

---

## Production Applications

The following applications are deployed to production:

| Application | Fly.io App Name | URL | Purpose |
|------------|-----------------|-----|---------|
| Internal API | `maishapoa-production-internal-api` | https://maishapoa-production-internal-api.fly.dev | Internal business APIs |
| Public API | `maishapoa-production-public-api` | https://maishapoa-production-public-api.fly.dev | Public-facing Kong Gateway |
| Agent Registration | `maishapoa-production-agent-registration` | https://maishapoa-production-agent-registration.fly.dev | Agent registration web app |

### Planned Applications (Not Yet Deployed)

- **Web Admin**: `maishapoa-production-web-admin` (coming soon)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
└───────────────┬─────────────────────────────────┬───────────┘
                │                                 │
                ▼                                 ▼
         ┌──────────────┐                ┌──────────────┐
         │   staging    │                │  production  │
         │    branch    │                │    branch    │
         └──────┬───────┘                └──────┬───────┘
                │                               │
                │ Auto-deploy                   │ Requires Manual Approval
                ▼                               ▼
         ┌──────────────┐                ┌──────────────┐
         │   Staging    │                │  Production  │
         │ Environment  │                │ Environment  │
         └──────────────┘                └──────────────┘
```

### Branch Strategy

1. **development** → Feature development and testing
2. **staging** → Pre-production testing (auto-deploys to staging environment)
3. **production** → Production releases (requires manual approval before deployment)

**Important**: 
- Only the `staging` branch can be merged into `production`
- Production deployments require manual approval in GitHub Actions
- Never deploy directly from `development` to `production`

---

## Prerequisites

### 1. GitHub Environment Setup

You must configure the GitHub "production" environment with protection rules:

1. Go to: **GitHub Repository** → **Settings** → **Environments** → **New environment**
2. Name: `production`
3. Configure protection rules:
   - ✅ **Required reviewers**: Add yourself and team members
   - ✅ **Wait timer**: 5 minutes (optional, gives time to review)
   - ✅ **Deployment branches**: Only `production` branch

This ensures:
- All production deployments require explicit approval
- An audit trail of who approved what deployment
- Protection against accidental deployments

### 2. Fly.io Applications

Ensure all production apps are created in the correct region.

**Region**: Frankfurt, Germany (`fra`)

```bash
# Check existing apps
flyctl apps list

# View available regions
flyctl platform regions

# Create apps if needed (ONLY IF MIGRATING FROM OLD NAMES)
# If you have old "microbima-production-*" apps, delete them first:
flyctl apps destroy microbima-production-internal-api
flyctl apps destroy microbima-production-public-api

# Create new apps (region will be set on first deployment via fly.toml)
flyctl apps create maishapoa-production-internal-api --org maisha-poa-org
flyctl apps create maishapoa-production-public-api --org maisha-poa-org
flyctl apps create maishapoa-production-agent-registration --org maisha-poa-org
```

**Note**: The region (Frankfurt, `fra`) is specified in each app's `fly.toml` file via `primary_region = "fra"`. When you first deploy, Fly.io will automatically provision the app in Frankfurt.

#### Migrating Apps from Tokyo to Frankfurt

If you have existing apps in Tokyo (`nrt`) and want to move them to Frankfurt (`fra`):

**Option 1: Recreate Apps (Recommended for production setup)**

```bash
# 1. Export secrets from old app
flyctl secrets list -a microbima-production-internal-api > old-secrets.txt

# 2. Destroy old app (ensure you have backups!)
flyctl apps destroy microbima-production-internal-api

# 3. Create new app (region will be set from fly.toml on first deploy)
flyctl apps create maishapoa-production-internal-api --org maisha-poa-org

# 4. Re-import secrets
flyctl secrets set DATABASE_URL="..." JWT_SECRET="..." \
  -a maishapoa-production-internal-api

# 5. Deploy (this is when the app gets provisioned in Frankfurt)
flyctl deploy -a maishapoa-production-internal-api \
  -c infra/fly/internal-api/production/fly.toml

# The fly.toml has primary_region = "fra", so the app will be created in Frankfurt
```

**Option 2: Redeploy Existing App to New Region**

If you want to keep the same app name and just move regions:

```bash
# Simply deploy with the updated fly.toml (which now has primary_region = "fra")
flyctl deploy -a microbima-production-internal-api \
  -c infra/fly/internal-api/production/fly.toml

# Fly.io will migrate the app to Frankfurt based on the fly.toml
# Note: You may need to scale down old instances in Tokyo manually
```

**Why Frankfurt?**
- Lower latency for European and African users
- High capacity (2831 available as of last check)
- Better timezone alignment for support
- Cost-effective for the target market

### 3. Fly.io Secrets

Set required secrets for each production app:

```bash
# Internal API secrets
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="..." \
  SENTRY_DSN="..." \
  -a maishapoa-production-internal-api

# Agent Registration secrets
flyctl secrets set \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  -a maishapoa-production-agent-registration

# Public API secrets (if any)
flyctl secrets set \
  KONG_SECRET="..." \
  -a maishapoa-production-public-api
```

---

## Initial Setup

### Step 1: Verify Staging is Stable

Before deploying to production, ensure staging is working perfectly:

1. Test all critical user flows on staging
2. Verify health checks pass
3. Check logs for any errors
4. Run smoke tests

```bash
# Check staging health
curl https://maishapoa-staging-internal-api.fly.dev/api/health
curl https://maishapoa-staging-agent-registration.fly.dev/
```

### Step 2: Review Changes

Check what will be deployed:

```bash
# See commits that will go to production
git checkout production
git log production..staging --oneline

# Review the diff
git diff production..staging
```

### Step 3: Update Production Branch

```bash
# Ensure you're on staging and it's up to date
git checkout staging
git pull origin staging

# Create a pull request or merge directly (if you have permissions)
git checkout production
git merge staging --no-ff -m "Release: Deploy staging to production"
git push origin production
```

---

## Deployment Process

### Automated Workflow (Recommended)

1. **Trigger**: Push to `production` branch triggers the workflow
   ```bash
   git push origin production
   ```

2. **Wait for Approval**:
   - Go to: **GitHub** → **Actions** → Select the running workflow
   - You'll see: "Review deployments" button
   - Click **"Review deployments"**
   - Review the changes
   - Click **"Approve and deploy"** or **"Reject"**

3. **Monitor Deployment**:
   - Watch GitHub Actions logs
   - Monitor each deployment step:
     - ✅ Tests pass
     - ✅ Internal API deploys
     - ✅ Agent Registration deploys
     - ✅ Public API deploys
     - ✅ Health checks pass

4. **Verify Production**:
   ```bash
   # Check all production apps
   curl https://maishapoa-production-internal-api.fly.dev/api/health
   curl https://maishapoa-production-agent-registration.fly.dev/
   curl https://maishapoa-production-public-api.fly.dev/
   ```

### Manual Deployment (Emergency Only)

If GitHub Actions is unavailable:

```bash
# Ensure you're on production branch
git checkout production
git pull origin production

# Install Fly CLI if needed
curl -L https://fly.io/install.sh | sh

# Deploy each service
flyctl deploy -a maishapoa-production-internal-api \
  -c infra/fly/internal-api/production/fly.toml

flyctl deploy -a maishapoa-production-agent-registration \
  -c infra/fly/agent-registration/production/fly.toml

flyctl deploy -a maishapoa-production-public-api \
  -c infra/fly/public-api/production/fly.toml
```

---

## Rollback Procedures

### Option 1: Quick Rollback (Revert to Previous Version)

```bash
# Find the last successful deployment commit
git log production --oneline -n 10

# Rollback to previous commit
git checkout production
git revert HEAD --no-edit
git push origin production

# This triggers a new deployment with the reverted code
```

### Option 2: Fly.io Version Rollback

```bash
# List recent releases
flyctl releases -a maishapoa-production-internal-api

# Rollback to a specific version
flyctl releases rollback v42 -a maishapoa-production-internal-api
flyctl releases rollback v42 -a maishapoa-production-agent-registration
flyctl releases rollback v42 -a maishapoa-production-public-api
```

### Option 3: Emergency Rollback (Fast)

```bash
# Immediately scale down problematic app
flyctl scale count 0 -a maishapoa-production-internal-api

# Fix the issue

# Scale back up
flyctl scale count 2 -a maishapoa-production-internal-api
```

---

## Monitoring & Verification

### Post-Deployment Checks

After every deployment, verify:

1. **Health Endpoints**:
   ```bash
   curl -f https://maishapoa-production-internal-api.fly.dev/api/health
   ```

2. **Application Logs**:
   ```bash
   flyctl logs -a maishapoa-production-internal-api
   ```

3. **Metrics Dashboard**:
   - Visit Fly.io dashboard
   - Check CPU, memory, response times

4. **Error Tracking**:
   - Check Sentry for new errors
   - Monitor error rates

5. **User Impact**:
   - Test critical user flows
   - Check agent registration process
   - Verify API responses

### Monitoring Tools

- **Fly.io Metrics**: https://fly.io/dashboard/[app-name]/metrics
- **Logs**: `flyctl logs -a [app-name]`
- **Sentry**: [Your Sentry URL]
- **Health Endpoints**: See above

---

## Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs**:
   - Go to Actions tab
   - Click on failed workflow
   - Review step logs

2. **Common issues**:
   - Tests failing → Fix tests on staging first
   - Build errors → Check Dockerfile and dependencies
   - Health check fails → Verify app is starting correctly

3. **Fix and retry**:
   ```bash
   # Fix the issue in staging first
   git checkout staging
   # ... make fixes ...
   git push origin staging
   
   # Once verified, merge to production
   git checkout production
   git merge staging
   git push origin production
   ```

### App Not Starting

```bash
# Check logs for errors
flyctl logs -a maishapoa-production-internal-api

# Check app status
flyctl status -a maishapoa-production-internal-api

# Check secrets are set
flyctl secrets list -a maishapoa-production-internal-api

# SSH into app for debugging
flyctl ssh console -a maishapoa-production-internal-api
```

### Database Issues

```bash
# Check database connectivity
flyctl ssh console -a maishapoa-production-internal-api
> node -e "require('./dist/main')"

# Check database credentials
flyctl secrets list -a maishapoa-production-internal-api
```

### Health Checks Failing

1. Verify health endpoint works:
   ```bash
   curl -v https://maishapoa-production-internal-api.fly.dev/api/health
   ```

2. Check app logs:
   ```bash
   flyctl logs -a maishapoa-production-internal-api
   ```

3. Verify environment variables:
   ```bash
   flyctl config show -a maishapoa-production-internal-api
   ```

---

## Safety Checklist

Before deploying to production, ensure:

### Pre-Deployment
- [ ] All tests pass on staging
- [ ] Manual testing completed on staging
- [ ] No known critical bugs
- [ ] Database migrations tested (if any)
- [ ] Secrets configured in Fly.io
- [ ] Reviewed all changes since last production deploy
- [ ] Team notified of upcoming deployment
- [ ] Rollback plan ready

### During Deployment
- [ ] Monitor GitHub Actions workflow
- [ ] Watch deployment logs
- [ ] Keep communication channel open

### Post-Deployment
- [ ] All health checks pass
- [ ] Test critical user flows
- [ ] Check error rates in Sentry
- [ ] Monitor response times
- [ ] Verify logs show no errors
- [ ] Database connectivity confirmed
- [ ] External integrations working

### Rollback Ready
- [ ] Know the last good commit hash
- [ ] Have Fly.io CLI installed locally
- [ ] Can access Fly.io dashboard
- [ ] Team on standby for 1 hour post-deploy

---

## Deployment Schedule Recommendations

### Best Times to Deploy

- **Weekdays**: Tuesday - Thursday, 10 AM - 2 PM local time
- **Avoid**: Fridays, weekends, holidays, end of month

### Why?

- Team available for support
- Users active (can detect issues quickly)
- Time to fix issues same day if needed

### High-Risk Deployments

For major changes:
1. Deploy to staging 24-48 hours before production
2. Extensive testing on staging
3. Deploy to production during lowest traffic hours
4. Have full team available
5. Consider feature flags for gradual rollout

---

## Emergency Contacts

### Team
- **DevOps Lead**: [Your Name/Contact]
- **Backend Lead**: [Contact]
- **On-Call Engineer**: [Contact]

### Services
- **Fly.io Support**: https://fly.io/docs/about/support/
- **Database Provider**: [Contact if separate]
- **Monitoring**: Sentry dashboard

---

## Appendix

### Useful Commands

```bash
# Check all production apps
flyctl apps list | grep production

# View app info
flyctl info -a maishapoa-production-internal-api

# Scale app
flyctl scale count 2 -a maishapoa-production-internal-api
flyctl scale vm shared-cpu-2x -a maishapoa-production-internal-api

# Restart app
flyctl apps restart maishapoa-production-internal-api

# View secrets (names only)
flyctl secrets list -a maishapoa-production-internal-api

# View recent deployments
flyctl releases -a maishapoa-production-internal-api
```

### Configuration Files

- **Workflow**: `.github/workflows/deploy.yml`
- **Internal API Config**: `infra/fly/internal-api/production/fly.toml`
- **Agent Registration Config**: `infra/fly/agent-registration/production/fly.toml`
- **Public API Config**: `infra/fly/public-api/production/fly.toml`

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-16 | 1.0 | Initial production deployment guide |


