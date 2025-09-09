# Manual Deployment Commands

## 🚨 Emergency Hotfix Deployment

These commands are for emergency hotfixes when CI/CD is not available or when immediate deployment is needed.

### **Prerequisites**
- Ensure you're in the repository root: `cd /path/to/microbima`
- Have `flyctl` installed and authenticated
- Have appropriate permissions for the target environment

## 🚀 Staging Deployments

### Internal API
```bash
flyctl deploy -a microbima-staging-internal-api -c infra/fly/internal-api/staging/fly.toml
```

### Web Admin
```bash
flyctl deploy -a microbima-staging-web-admin -c infra/fly/web-admin/staging/fly.toml
```

### Public API (Kong)
```bash
flyctl deploy -a microbima-staging-public-api -c infra/fly/public-api/staging/fly.toml
```

## 🏭 Production Deployments

### Internal API
```bash
flyctl deploy -a microbima-production-internal-api -c infra/fly/internal-api/production/fly.toml
```

### Web Admin
```bash
flyctl deploy -a microbima-production-web-admin -c infra/fly/web-admin/production/fly.toml
```

### Public API (Kong)
```bash
flyctl deploy -a microbima-production-public-api -c infra/fly/public-api/production/fly.toml
```

## 🔍 Health Checks

After deployment, verify the services are running:

### Staging
```bash
# Internal API
curl -f https://microbima-staging-internal-api.fly.dev/api/internal/health

# Web Admin
curl -f https://microbima-staging-web-admin.fly.dev/

# Public API
curl -f https://microbima-staging-public-api.fly.dev/
```

### Production
```bash
# Internal API
curl -f https://microbima-production-internal-api.fly.dev/api/internal/health

# Web Admin
curl -f https://microbima-production-web-admin.fly.dev/

# Public API
curl -f https://microbima-production-public-api.fly.dev/
```

## 🚨 Rollback Commands

If deployment fails, rollback to previous version:

```bash
# List available releases
flyctl releases -a <app-name>

# Rollback to specific release
flyctl deploy -a <app-name> --image-label <previous-version>
```

## 📋 Pre-Deployment Checklist

- [ ] Verify you're in the repository root
- [ ] Check that the correct branch is checked out
- [ ] Ensure all tests pass locally
- [ ] Verify environment variables are set in Fly.io dashboard
- [ ] Check that the target app exists in Fly.io

## ⚠️ Important Notes

1. **Manual deployments should be rare** - Use CI/CD for regular deployments
2. **Always test in staging first** - Never deploy directly to production
3. **Monitor logs after deployment** - `flyctl logs -a <app-name>`
4. **Have a rollback plan** - Know how to quickly revert if issues occur
5. **Document the reason** - Keep track of why manual deployment was needed

## 🔧 Troubleshooting

### Common Issues
- **Wrong app name**: Double-check the app name in the command
- **Missing config file**: Ensure the path to `fly.toml` is correct
- **Authentication issues**: Run `flyctl auth login`
- **Permission denied**: Check your Fly.io account permissions

### Quick Fixes
```bash
# Check app status
flyctl status -a <app-name>

# View recent logs
flyctl logs -a <app-name>

# Restart app
flyctl restart -a <app-name>
```

---

**Remember**: Manual deployments are for emergencies only. Regular deployments should go through CI/CD pipeline!
