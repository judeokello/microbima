# Production Deployment Configuration - Changes Summary

**Date**: October 16, 2025
**Purpose**: Prepare MaishaPoa services for production deployment

---

## Overview

Updated all production deployment configurations to:
1. Use correct "maishapoa" naming (removed "microbima")
2. Enable production deployments with safety controls
3. Add comprehensive deployment documentation

---

## Files Changed

### 1. Fly.io Configuration Files

#### All Production fly.toml Files
- **Changed Region**: `primary_region = "nrt"` (Tokyo) → `primary_region = "fra"` (Frankfurt, Germany)
- **Impact**: All new deployments will use Frankfurt region
- **Files Updated**:
  - `infra/fly/internal-api/production/fly.toml`
  - `infra/fly/public-api/production/fly.toml`
  - `infra/fly/agent-registration/production/fly.toml`
  - `infra/fly/web-admin/production/fly.toml`

#### All Staging fly.toml Files
- **Changed Region**: `primary_region = "nrt"` → `primary_region = "fra"`
- **Files Updated**:
  - `infra/fly/internal-api/staging/fly.toml`
  - `infra/fly/public-api/staging/fly.toml`
  - `infra/fly/agent-registration/staging/fly.toml`
  - `infra/fly/web-admin/staging/fly.toml`

#### `infra/fly/internal-api/production/fly.toml`
- **Changed**: App name from `microbima-production-internal-api` → `maishapoa-production-internal-api`
- **Changed**: Region from Tokyo (`nrt`) → Frankfurt (`fra`)
- **Impact**: Must recreate Fly.io app with new name and region

#### `infra/fly/public-api/production/fly.toml`
- **Changed**: App name from `microbima-production-public-api` → `maishapoa-production-public-api`
- **Changed**: Region from Tokyo (`nrt`) → Frankfurt (`fra`)
- **Impact**: Must recreate Fly.io app with new name and region

#### `infra/fly/agent-registration/production/fly.toml`
- **Changed**: Region from Tokyo (`nrt`) → Frankfurt (`fra`)
- **Changed**: 
  - Build arg `NEXT_PUBLIC_API_BASE_URL`: microbima → maishapoa
  - Build arg `NEXT_PUBLIC_INTERNAL_API_BASE_URL`: microbima → maishapoa
  - Env var `NEXT_PUBLIC_API_URL`: microbima → maishapoa
- **Note**: App name was already correct (`maishapoa-production-agent-registration`)

### 2. GitHub Actions Workflow

#### `.github/workflows/deploy.yml`

**Enabled production deployment job**:
```yaml
deploy-production:
  if: github.ref == 'refs/heads/production'
  runs-on: ubuntu-latest
  environment: 
    name: production
    url: https://maishapoa-production-internal-api.fly.dev
```

**Added deployment steps**:
- Deploy Internal API to Production
- Deploy Agent Registration to Production
- Deploy Public API to Production

**Updated health checks**:
- Changed `needs: [deploy-staging]` → `needs: [deploy-staging, deploy-production]`
- Updated production URLs: microbima → maishapoa
- Added better logging and status messages
- Added health check for Public API

**Key features**:
- ✅ Requires manual approval (via GitHub Environment)
- ✅ Only triggers on `production` branch
- ✅ Runs tests before deployment
- ✅ Comprehensive health checks after deployment

### 3. Documentation (New Files)

#### `docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md`
Comprehensive 400+ line guide covering:
- Production applications overview
- Deployment architecture diagram
- Prerequisites and initial setup
- Step-by-step deployment process
- Rollback procedures
- Monitoring and verification steps
- Troubleshooting guide
- Safety checklist
- Best practices

#### `docs/deployment/PRODUCTION-DEPLOYMENT-CHECKLIST.md`
Quick reference checklist for deployment day:
- Pre-deployment tasks (1-2 days before)
- Day-of deployment steps
- Post-deployment verification
- Ongoing monitoring tasks
- Emergency rollback commands
- Success criteria

---

## Migration Steps Required

### Step 1: Delete Old Fly.io Apps (If They Exist)

```bash
# Only if you have the old "microbima" named apps
flyctl apps destroy microbima-production-internal-api
flyctl apps destroy microbima-production-public-api
```

### Step 2: Create New Fly.io Apps

**Important**: Apps will be provisioned in Frankfurt, Germany (`fra`) on first deployment.

```bash
# View available regions
flyctl platform regions

# Create apps with correct "maishapoa" naming
flyctl apps create maishapoa-production-internal-api --org maisha-poa-org
flyctl apps create maishapoa-production-public-api --org maisha-poa-org
flyctl apps create maishapoa-production-agent-registration --org maisha-poa-org
```

**Note**: The region is specified in each app's fly.toml file as `primary_region = "fra"`. When you first deploy, Fly.io will automatically provision the app in Frankfurt. The `--region` flag is not used during app creation.

### Step 3: Configure Secrets

```bash
# Internal API
flyctl secrets set DATABASE_URL="..." JWT_SECRET="..." \
  -a maishapoa-production-internal-api

# Agent Registration
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="..." \
  -a maishapoa-production-agent-registration

# Public API
flyctl secrets set KONG_SECRET="..." \
  -a maishapoa-production-public-api
```

### Step 4: Setup GitHub Environment Protection

1. Go to GitHub Repository → Settings → Environments
2. Create environment named "production"
3. Add required reviewers (yourself and team)
4. Set deployment branch to "production" only
5. Optional: Add 5-minute wait timer

### Step 5: Test Deployment

```bash
# Merge staging to production
git checkout production
git merge staging
git push origin production

# GitHub Actions will trigger
# You'll need to manually approve in GitHub UI
```

---

## Deployment Safety Features

### 1. Branch Protection
- Only `production` branch triggers production deployment
- No direct deployment from `development`

### 2. GitHub Environment Protection
- Requires manual approval before deployment
- Creates audit trail
- Designated approvers only

### 3. Automated Testing
- Tests must pass before deployment
- Prevents broken code from reaching production

### 4. Health Checks
- Automated health checks after deployment
- Verifies all services are running
- Catches deployment failures early

### 5. Clear Rollback Path
- Git revert for code rollback
- Fly.io version rollback
- Emergency scale-down option

---

## Production Applications

| Application | App Name | URL |
|------------|----------|-----|
| Internal API | `maishapoa-production-internal-api` | https://maishapoa-production-internal-api.fly.dev |
| Public API | `maishapoa-production-public-api` | https://maishapoa-production-public-api.fly.dev |
| Agent Registration | `maishapoa-production-agent-registration` | https://maishapoa-production-agent-registration.fly.dev |

---

## Deployment Workflow

```
┌─────────────┐
│ development │ (feature branches)
└──────┬──────┘
       │ merge
       ▼
┌─────────────┐
│   staging   │ → Auto-deploys to staging environment
└──────┬──────┘
       │ merge (after testing)
       ▼
┌─────────────┐
│ production  │ → Triggers workflow → Manual approval → Deploy
└─────────────┘
```

**Key Points**:
- Staging auto-deploys (fast iteration)
- Production requires approval (safety)
- Can't skip staging (quality gate)
- Clear rollback procedures

---

## Next Steps

1. **Review the changes** in this commit
2. **Set up GitHub Environment** protection
3. **Create Fly.io apps** with new names
4. **Configure secrets** in Fly.io
5. **Test deployment** to staging first
6. **Read deployment guide** before first production deploy
7. **Do first production deploy** with team on standby

---

## Questions Answered

### Q: What does `needs: [deploy-staging, deploy-production]` mean?

**A**: It means the health-check job waits for both jobs to complete. However:
- GitHub skips jobs that don't meet their `if` conditions
- Skipped jobs are considered "completed" for dependency purposes
- With `if: always()`, health checks always run
- But the check steps inside use `if: github.ref == 'refs/heads/staging'` or `production`
- **Result**: Pushing to staging only runs staging health checks, not production

### Q: Can I deploy to production from development branch?

**A**: No, the workflow has multiple safety mechanisms:
1. `if: github.ref == 'refs/heads/production'` - only `production` branch triggers the job
2. GitHub Environment protection - you can restrict to only allow `production` branch
3. Best practice: Always go development → staging → production

### Q: How do I safely deploy to production?

**A**: Follow this process:
1. Test thoroughly on staging (1-2 days)
2. Merge staging → production
3. GitHub Actions triggers but **waits for your approval**
4. You review changes in GitHub UI
5. Click "Approve and deploy"
6. Monitor deployment
7. Verify health checks
8. Keep team on standby for 1-2 hours

---

## Safety Philosophy

**Manual Approval**: You explicitly approve every production deployment

**Testing Gate**: Staging must be stable before production

**Audit Trail**: GitHub tracks who approved what deployment

**Rollback Ready**: Multiple rollback options available

**Gradual Adoption**: Start conservative, automate later when comfortable

---

## Future Enhancements

Consider adding:
- [ ] Slack notifications for deployments
- [ ] Automated smoke tests post-deployment
- [ ] Canary deployments (gradual rollout)
- [ ] Feature flags for risky changes
- [ ] Automated rollback on health check failure
- [ ] Database backup before each deploy

---

## Support

- **Documentation**: `docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md`
- **Checklist**: `docs/deployment/PRODUCTION-DEPLOYMENT-CHECKLIST.md`
- **Workflow**: `.github/workflows/deploy.yml`
- **Fly.io Configs**: `infra/fly/*/production/fly.toml`


