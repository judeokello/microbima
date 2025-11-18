# MicroBima Fly.io Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the MicroBima internal API to Fly.io using a staged deployment process. The deployment follows a two-stage approach: staging first, then production.

## Prerequisites

- [x] GitHub Actions workflow configured (`.github/workflows/deploy.yml`)
- [x] Fly.io apps created and configured
- [x] `FLY_API_TOKEN` secret added to GitHub repository
- [x] Fly.io CLI installed locally (optional, for manual deployments)

## Deployment Architecture

```
Development Branch → Staging Branch → Master Branch
       ↓                   ↓              ↓
   Local Testing    Fly.io Staging   Fly.io Production
```

## Stage 1: Deploy to Staging

### Step 1: Prepare Development Branch

1. **Create a new feature branch** (if not already done):
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/test-deployment
   ```

2. **Make your changes** and commit them:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. **Push feature branch**:
   ```bash
   git push origin feature/test-deployment
   ```

4. **Create Pull Request** to development branch on GitHub

### Step 2: Merge to Development

**Option A: Merge via GitHub Pull Request (Recommended)**
1. **Create Pull Request** on GitHub from `feature/test-deployment` to `development`
2. **Review the changes** in the PR
3. **Merge the Pull Request** on GitHub
4. **Pull latest development** locally:
   ```bash
   git checkout development
   git pull origin development
   ```

**Option B: Merge directly via Git (Alternative)**
1. **Switch to development branch**:
   ```bash
   git checkout development
   git pull origin development
   ```

2. **Merge feature branch**:
   ```bash
   git merge feature/test-deployment
   git push origin development
   ```

3. **Clean up feature branch** (optional):
   ```bash
   git branch -d feature/test-deployment
   git push origin --delete feature/test-deployment
   ```

4. **Verify changes** are in development:
   ```bash
   git log --oneline -5
   ```

### Step 3: Deploy to Staging

1. **Merge development into staging**:
   ```bash
   git checkout staging
   git pull origin staging
   git merge development
   git push origin staging
   ```

2. **GitHub Actions will automatically trigger**:
   - Runs tests (`pnpm test`)
   - Deploys to Fly.io staging environment
   - Deploys internal API: `maishapoa-staging-internal-api`
   - Deploys web admin: `microbima-staging-web-admin`
   - Deploys public API: `microbima-staging-public-api`

3. **Monitor deployment**:
   - Check GitHub Actions tab in your repository
   - Monitor deployment logs for any errors
   - Verify staging URLs are accessible

### Step 4: Verify Staging Deployment

1. **Check staging health endpoints**:
   ```bash
   # Internal API Health Check
   curl -f https://maishapoa-staging-internal-api.fly.dev/api/internal/health
   
   # Web Admin
   curl -f https://microbima-staging-web-admin.fly.dev/
   
   # Public API
   curl -f https://microbima-staging-public-api.fly.dev/
   ```

2. **Test your changes** in the staging environment
3. **Verify all functionality** works as expected

## Stage 2: Deploy to Production

### Step 5: Merge to Master (ONLY after staging verification)

1. **Switch to master branch**:
   ```bash
   git checkout master
   git pull origin master
   ```

2. **Merge staging into master**:
   ```bash
   git merge staging
   git push origin master
   ```

3. **GitHub Actions will automatically trigger**:
   - Runs tests (`pnpm test`)
   - Deploys to Fly.io production environment
   - Deploys internal API: `microbima-production-internal-api`
   - Deploys web admin: `microbima-production-web-admin`
   - Deploys public API: `microbima-production-public-api`

### Step 6: Verify Production Deployment

1. **Check production health endpoints**:
   ```bash
   # Internal API Health Check
   curl -f https://microbima-production-internal-api.fly.dev/api/internal/health
   
   # Web Admin
   curl -f https://microbima-production-web-admin.fly.dev/
   
   # Public API
   curl -f https://microbima-production-public-api.fly.dev/
   ```

2. **Monitor production metrics** and performance
3. **Verify all functionality** works in production

## Fly.io App Configuration

### Staging Environment
- **App Name**: `maishapoa-staging-internal-api`
- **Region**: `nrt` (Tokyo)
- **Resources**: 1 CPU, 512MB RAM
- **Environment**: `NODE_ENV=staging`
- **Log Level**: `debug`

### Production Environment
- **App Name**: `microbima-production-internal-api`
- **Region**: `nrt` (Tokyo)
- **Resources**: 2 CPU, 1024MB RAM
- **Environment**: `NODE_ENV=production`
- **Log Level**: `info`

## Troubleshooting

### Common Issues

1. **Deployment fails during build**:
   - Check Dockerfile syntax
   - Verify all dependencies are installed
   - Check for missing environment variables

2. **Health checks fail**:
   - Verify the health endpoint exists (`/api/internal/health`)
   - Check if the service is binding to the correct port (3000)
   - Review application logs: `flyctl logs -a maishapoa-staging-internal-api`

3. **Tests fail in CI/CD**:
   - Run tests locally: `pnpm test`
   - Check for environment-specific test issues
   - Verify test database configuration

### Manual Deployment (Emergency)

If GitHub Actions fails, you can deploy manually:

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
flyctl auth login

# Deploy to staging
flyctl deploy -a maishapoa-staging-internal-api -c infra/fly/internal-api/staging/fly.toml

# Deploy to production
flyctl deploy -a microbima-production-internal-api -c infra/fly/internal-api/production/fly.toml
```

### Monitoring and Logs

```bash
# View logs
flyctl logs -a maishapoa-staging-internal-api
flyctl logs -a microbima-production-internal-api

# Check app status
flyctl status -a maishapoa-staging-internal-api
flyctl status -a microbima-production-internal-api

# Scale app (if needed)
flyctl scale count 2 -a microbima-production-internal-api
```

## Security Considerations

1. **Environment Variables**: All sensitive data should be stored in Fly.io secrets
2. **API Keys**: Use GitHub Secrets for `FLY_API_TOKEN`
3. **Database Access**: Ensure proper network security for database connections
4. **HTTPS**: All endpoints use HTTPS with automatic TLS termination

## Rollback Procedure

If issues are discovered in production:

1. **Immediate rollback**:
   ```bash
   git checkout master
   git revert HEAD
   git push origin master
   ```

2. **This will trigger** a new deployment with the previous working version

3. **Investigate** the issue in staging before attempting another production deployment

## Next Steps: Public API Implementation

After successful internal API deployment:

1. Review public API requirements
2. Configure public API endpoints
3. Set up API gateway (Kong) configuration
4. Implement authentication and rate limiting
5. Deploy public API following the same staged process

## Support

- **Fly.io Documentation**: https://fly.io/docs/
- **GitHub Actions Logs**: Check the Actions tab in your repository
- **Application Logs**: Use `flyctl logs` command
- **Health Monitoring**: Use the provided health check endpoints

---

**Important**: Always test thoroughly in staging before deploying to production. The staged deployment process is designed to catch issues early and minimize production downtime.
