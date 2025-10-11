# NPM v11.6.2 Upgrade Summary

## ✅ All Dockerfiles Updated

All Node.js-based Dockerfiles have been upgraded to use npm v11.6.2.

### Updated Files:

#### Internal API (NestJS)
- ✅ `infra/fly/internal-api/staging/Dockerfile`
- ✅ `infra/fly/internal-api/production/Dockerfile`

#### Web Admin (Next.js)
- ✅ `infra/fly/web-admin/staging/Dockerfile`
- ✅ `infra/fly/web-admin/production/Dockerfile`

#### Agent Registration (Next.js)
- ✅ `infra/fly/agent-registration/staging/Dockerfile`
- ✅ `infra/fly/agent-registration/production/Dockerfile`

#### Public API (Kong)
- ⏭️ `infra/fly/public-api/staging/Dockerfile` - **Not applicable** (Kong, not Node.js)
- ⏭️ `infra/fly/public-api/production/Dockerfile` - **Not applicable** (Kong, not Node.js)

## 📝 Changes Made

Each Dockerfile now includes this line after the base image declaration:

```dockerfile
# Upgrade npm to latest version in base image
RUN npm install -g npm@11.6.2
```

This ensures that:
- ✅ npm is upgraded before any npm commands run
- ✅ All stages inherit the upgraded npm version
- ✅ No more npm upgrade warnings in Fly.io console
- ✅ Latest npm features and security patches are available

## 🚀 Next Deployment

The next time you deploy to Fly.io, your apps will automatically use npm v11.6.2:

```bash
# Staging deployments
fly deploy --config infra/fly/internal-api/staging/fly.toml

# Production deployments
fly deploy --config infra/fly/internal-api/production/fly.toml
```

## 🔍 Verify npm Version

After deployment, you can verify the npm version:

```bash
# SSH into your Fly.io app
fly ssh console -a YOUR_APP_NAME

# Check npm version
npm --version
# Should output: 11.6.2
```

## 📊 npm Version Strategy

### Current Setup:
- **Base Images**: Node 20 & Node 22 Alpine
- **npm Version**: Explicitly set to v11.6.2
- **pnpm Version**: v10.17.1 (unchanged)

### Why This Approach?
1. **Explicit version control** - No surprises from base image updates
2. **Security** - Latest npm includes security fixes
3. **Performance** - npm v11 has significant performance improvements
4. **Consistency** - Same npm version across all environments

## 🔄 Future Updates

To update npm version across all apps:

1. Update the version in all Dockerfiles:
   ```bash
   # Find and replace across all Dockerfiles
   find infra/fly -name "Dockerfile" -type f -exec sed -i 's/npm@11.6.2/npm@NEW_VERSION/g' {} +
   ```

2. Commit and deploy:
   ```bash
   git add infra/fly
   git commit -m "chore: upgrade npm to vNEW_VERSION"
   git push
   ```

## ✅ Testing

Before deploying to production, test the Dockerfile changes:

```bash
# Build locally
docker build -f infra/fly/internal-api/staging/Dockerfile -t test-api .

# Verify npm version
docker run test-api npm --version
```

## 📚 Related Documentation

- [npm v11 Release Notes](https://github.com/npm/cli/releases/tag/v11.6.2)
- [Fly.io Docker Best Practices](https://fly.io/docs/languages-and-frameworks/dockerfile/)
- [Multi-stage Docker Builds](https://docs.docker.com/build/building/multi-stage/)

