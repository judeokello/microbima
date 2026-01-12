# Fly.io Deployment Quick Reference

## 🚨 Common Issues & Quick Fixes

| Issue | Error Message | Quick Fix |
|-------|---------------|-----------|
| **pnpm symlinks** | `Cannot find module '@sentry/nestjs'` | Add `--shamefully-hoist` to pnpm install |
| **Build context** | `file not found` during build | Run from repo root, not subdirectory |
| **Build path** | `Cannot find module '/app/dist/src/main'` | Update CMD path to match build output |
| **NODE_ENV conflict** | Wrong environment | Remove hardcoded NODE_ENV from Dockerfile |
| **Prisma binary** | `PrismaClientInitializationError` | Add `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` |

## 📋 Pre-Deployment Checklist

- [ ] Run from repository root: `cd /path/to/microbima`
- [ ] Check `fly.toml` points to correct Dockerfile
- [ ] Verify NODE_ENV in `fly.toml` (not Dockerfile)
- [ ] Ensure all required env vars are set

## 🚀 Deployment Commands

```bash
# Internal API
flyctl deploy -a maishapoa-staging-internal-api -c infra/fly/internal-api/fly.toml

# Web Admin  
flyctl deploy -a microbima-staging-web-admin -c infra/fly/web-admin/fly.toml

# Public API
flyctl deploy -a microbima-staging-public-api -c infra/fly/public-api/fly.toml
```

## 🔍 Troubleshooting

```bash
# Check status
flyctl status -a app-name

# View logs
flyctl logs -a app-name

# SSH into container
flyctl ssh console -a app-name
```

## ✅ Success Indicators

- [ ] App starts without module errors
- [ ] Sentry initializes: "✅ Sentry initialized successfully"
- [ ] Database connects: "✅ Database connected successfully"
- [ ] Health checks pass
- [ ] API endpoints respond (even if 500 due to missing tables)

## 📁 File Structure

```
microbima/
├── apps/api/Dockerfile          # ✅ API Dockerfile
├── infra/fly/
│   ├── internal-api/fly.toml    # Points to apps/api/Dockerfile
│   ├── web-admin/Dockerfile     # ✅ Next.js Dockerfile
│   └── public-api/Dockerfile    # ✅ Kong Dockerfile
```

---
**💡 Tip**: Always run from repo root and use the full config path!
