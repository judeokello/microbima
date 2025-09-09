# Fly.io Deployment Guide for MicroBima

## Overview

This guide documents the lessons learned from deploying the MicroBima internal API to Fly.io, including common pitfalls and their solutions. Use this guide when deploying other apps (web-admin, public-api) to avoid the same issues.

## Key Lessons Learned

### 1. Monorepo Structure & Build Context

**Problem**: When running `flyctl deploy` from subdirectories, the build context is wrong, causing "file not found" errors.

**Solution**: Always run deployments from the repository root with the correct config path:

```bash
# ✅ CORRECT - Run from repo root
cd /path/to/microbima
flyctl deploy -a app-name -c infra/fly/app-name/fly.toml

# ❌ WRONG - Don't run from subdirectory
cd infra/fly/app-name
flyctl deploy -a app-name
```

### 2. pnpm Workspace Symlinks in Docker

**Problem**: pnpm creates symlinks in `node_modules` that don't work properly in Docker containers, causing "Cannot find module" errors.

**Solution**: Use `--shamefully-hoist` flag to flatten the dependency structure:

```dockerfile
# Fix pnpm symlinks for production
# pnpm creates symlinks that don't work well in Docker, so we need to resolve them
WORKDIR /app
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist
```

### 3. NODE_ENV Conflicts

**Problem**: Dockerfiles hardcode `NODE_ENV=production` which conflicts with Fly.io environment variables.

**Solution**: Remove hardcoded NODE_ENV from Dockerfiles, let Fly.io environment variables take precedence:

```dockerfile
# ❌ WRONG - Don't hardcode NODE_ENV
ENV NODE_ENV=production

# ✅ CORRECT - Let Fly.io environment variables take precedence
# NODE_ENV will be set by Fly.io environment variables
```

### 4. Build Output Path Issues

**Problem**: Build output location doesn't match the CMD path in Dockerfile.

**Solution**: Ensure CMD path matches actual build output location:

```dockerfile
# If build happens in /app/apps/api and output is in dist/src/main.js
# Then CMD should be:
CMD ["node", "--enable-source-maps", "apps/api/dist/src/main"]
```

### 5. Multiple Dockerfile Confusion

**Problem**: Having multiple Dockerfiles causes confusion about which one is being used.

**Solution**: 
- Keep only one Dockerfile per app in `apps/app-name/Dockerfile`
- Remove unused Dockerfiles from `infra/fly/` directories
- Clearly document which Dockerfile is used in `fly.toml`

## Deployment Checklist

### Before Deployment

- [ ] Verify `fly.toml` points to correct Dockerfile path
- [ ] Check that NODE_ENV is set correctly in `fly.toml` (not hardcoded in Dockerfile)
- [ ] Ensure build context is correct (run from repo root)
- [ ] Verify all required environment variables are set in Fly.io

### During Deployment

- [ ] Run from repository root: `flyctl deploy -a app-name -c infra/fly/app-name/fly.toml`
- [ ] Monitor build logs for dependency resolution issues
- [ ] Check that pnpm symlinks are resolved correctly

### After Deployment

- [ ] Verify app starts without module resolution errors
- [ ] Check that Sentry initializes correctly
- [ ] Test database connection
- [ ] Verify API endpoints are accessible
- [ ] Check health checks are passing

## App-Specific Configurations

### Internal API (`microbima-staging-internal-api`)

- **Dockerfile**: `apps/api/Dockerfile`
- **API Prefix**: `internal` (set in fly.toml)
- **Endpoints**: `/api/internal/*`
- **Health Check**: `/api/internal/health`

### Web Admin (`microbima-staging-web-admin`)

- **Dockerfile**: `infra/fly/web-admin/Dockerfile` (Next.js)
- **API Prefix**: Not applicable (Next.js app)
- **Endpoints**: Root paths `/`
- **Health Check**: `/` (Next.js default)

### Public API (`microbima-staging-public-api`)

- **Dockerfile**: `infra/fly/public-api/Dockerfile` (Kong)
- **API Prefix**: Not applicable (Kong proxy)
- **Endpoints**: Kong proxy routes
- **Health Check**: Kong health endpoint

## Common Error Patterns & Solutions

### Error: "Cannot find module '@sentry/nestjs'"
**Cause**: pnpm symlinks not resolved in Docker
**Solution**: Add `--shamefully-hoist` to pnpm install command

### Error: "Cannot find module 'dotenv'"
**Cause**: pnpm symlinks not resolved in Docker
**Solution**: Add `--shamefully-hoist` to pnpm install command

### Error: "Cannot find module '/app/dist/src/main'"
**Cause**: Build output path doesn't match CMD path
**Solution**: Update CMD to match actual build output location

### Error: "file not found" during Docker build
**Cause**: Wrong build context (running from subdirectory)
**Solution**: Run `flyctl deploy` from repository root

### Error: "PrismaClientInitializationError"
**Cause**: Prisma binary targets don't match Alpine Linux
**Solution**: Add `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to schema.prisma

## Environment Variables

### Required for All Apps
- `NODE_ENV`: Set in fly.toml (staging/production)
- `PORT`: Set in fly.toml (usually 3000)

### Required for API Apps
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: JWT signing secret
- `SENTRY_DSN`: Sentry error tracking (optional)
- `SENTRY_ENVIRONMENT`: Sentry environment (optional)

### Required for Kong (Public API)
- `KONG_PROXY_ACCESS_LOG`: Logging configuration
- `KONG_ADMIN_ACCESS_LOG`: Admin logging
- `KONG_PROXY_ERROR_LOG`: Error logging
- `KONG_ADMIN_ERROR_LOG`: Admin error logging
- `KONG_ADMIN_LISTEN`: Admin interface binding
- `KONG_PROXY_LISTEN`: Proxy interface binding
- `KONG_DATABASE`: Database mode (off for declarative)
- `KONG_DECLARATIVE_CONFIG`: Config file path

## Troubleshooting Commands

```bash
# Check app status
flyctl status -a app-name

# View logs
flyctl logs -a app-name

# SSH into container
flyctl ssh console -a app-name

# Check environment variables
flyctl secrets list -a app-name

# Restart app
flyctl restart -a app-name
```

## Best Practices

1. **Always test locally first**: Ensure the app builds and runs locally before deploying
2. **Use staging environment**: Test on staging before production
3. **Monitor logs**: Check logs immediately after deployment
4. **Health checks**: Implement proper health check endpoints
5. **Environment parity**: Keep staging and production environments as similar as possible
6. **Documentation**: Update this guide when new issues are discovered

## File Structure

```
microbima/
├── apps/
│   ├── api/
│   │   └── Dockerfile          # ✅ Use this for API
│   ├── web-admin/
│   └── mobile/
├── infra/
│   └── fly/
│       ├── internal-api/
│       │   └── fly.toml        # Points to apps/api/Dockerfile
│       ├── web-admin/
│       │   ├── Dockerfile      # ✅ Use this for Next.js
│       │   └── fly.toml
│       └── public-api/
│           ├── Dockerfile      # ✅ Use this for Kong
│           └── fly.toml
└── docs/
    └── deployment/
        └── fly-deployment-guide.md  # This file
```

## Quick Reference

### Deploy Internal API
```bash
# Staging
cd /path/to/microbima
flyctl deploy -a microbima-staging-internal-api -c infra/fly/internal-api/staging/fly.toml

# Production
flyctl deploy -a microbima-production-internal-api -c infra/fly/internal-api/production/fly.toml
```

### Deploy Web Admin
```bash
# Staging
cd /path/to/microbima
flyctl deploy -a microbima-staging-web-admin -c infra/fly/web-admin/staging/fly.toml

# Production
flyctl deploy -a microbima-production-web-admin -c infra/fly/web-admin/production/fly.toml
```

### Deploy Public API
```bash
# Staging
cd /path/to/microbima
flyctl deploy -a microbima-staging-public-api -c infra/fly/public-api/staging/fly.toml

# Production
cd /path/to/microbima
flyctl deploy -a microbima-production-public-api -c infra/fly/public-api/production/fly.toml
```

## 🎯 Environment Strategy

For detailed information about managing multiple environments and CI/CD pipelines, see:
- [Environment Strategy Guide](environment-strategy.md) - Complete strategy for staging/production
- [CI/CD Pipeline Setup](.github/workflows/deploy.yml) - Automated deployment configuration

---

**Last Updated**: September 9, 2025
**Author**: AI Assistant
**Status**: ✅ Tested and Working
