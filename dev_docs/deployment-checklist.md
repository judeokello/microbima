# MicroBima Deployment Checklist

## Pre-Deployment Checklist

- [ ] All changes tested locally
- [ ] Tests passing (`pnpm test`)
- [ ] Code reviewed and approved
- [ ] Feature branch created and pushed
- [ ] Pull request created to development

## Stage 1: Staging Deployment

### Development → Staging
- [ ] Merge PR to development branch
- [ ] Pull latest development: `git checkout development && git pull origin development`
- [ ] Switch to staging: `git checkout staging`
- [ ] Merge development: `git merge development`
- [ ] Push to staging: `git push origin staging`
- [ ] Monitor GitHub Actions deployment
- [ ] Verify staging health checks pass

### Staging Verification
- [ ] Internal API: `curl -f https://microbima-staging-internal-api.fly.dev/api/internal/health`
- [ ] Web Admin: `curl -f https://microbima-staging-web-admin.fly.dev/`
- [ ] Public API: `curl -f https://microbima-staging-public-api.fly.dev/`
- [ ] Test all new functionality in staging
- [ ] Verify no errors in staging logs
- [ ] Performance testing completed

## Stage 2: Production Deployment

### Staging → Production
- [ ] **ONLY proceed if staging is fully verified**
- [ ] Switch to master: `git checkout master`
- [ ] Pull latest master: `git pull origin master`
- [ ] Merge staging: `git merge staging`
- [ ] Push to master: `git push origin master`
- [ ] Monitor GitHub Actions deployment
- [ ] Verify production health checks pass

### Production Verification
- [ ] Internal API: `curl -f https://microbima-production-internal-api.fly.dev/api/internal/health`
- [ ] Web Admin: `curl -f https://microbima-production-web-admin.fly.dev/`
- [ ] Public API: `curl -f https://microbima-production-public-api.fly.dev/`
- [ ] Test critical functionality in production
- [ ] Monitor production metrics
- [ ] Verify no errors in production logs

## Post-Deployment

- [ ] Update deployment documentation if needed
- [ ] Notify team of successful deployment
- [ ] Monitor application for 30 minutes
- [ ] Document any issues encountered
- [ ] Clean up feature branch if no longer needed

## Emergency Rollback

If issues are discovered:
- [ ] Revert commit: `git revert HEAD`
- [ ] Push revert: `git push origin master`
- [ ] Monitor rollback deployment
- [ ] Verify rollback success
- [ ] Investigate issue in staging

## Quick Commands Reference

```bash
# Check current branch status
git status
git log --oneline -5

# Switch and merge branches
git checkout staging
git merge development
git push origin staging

# Health checks
curl -f https://microbima-staging-internal-api.fly.dev/api/internal/health
curl -f https://microbima-production-internal-api.fly.dev/api/internal/health

# View logs
flyctl logs -a microbima-staging-internal-api
flyctl logs -a microbima-production-internal-api
```

---

**Remember**: Never skip staging verification before production deployment!
