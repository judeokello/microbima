# Production Deployment Checklist

Quick reference checklist for production deployments. Print or bookmark this page!

---

## Pre-Deployment (1-2 days before)

### Testing
- [ ] All tests pass on staging (`pnpm test`)
- [ ] All health checks pass on staging
- [ ] Manual testing completed on critical flows
- [ ] Load testing if significant changes
- [ ] Security review for auth/permission changes

### Code Review
- [ ] All PRs reviewed and approved
- [ ] No `TODO:` or `FIXME:` in critical paths
- [ ] Changelog updated
- [ ] API documentation updated if needed

### Database
- [ ] Database migrations tested on staging
- [ ] Backup strategy confirmed
- [ ] Data migration scripts reviewed
- [ ] Rollback plan for DB changes

### Configuration
- [ ] All secrets set in Fly.io production apps
- [ ] Environment variables reviewed
- [ ] Apps created in Frankfurt region (`fra`)
- [ ] Region verified: `flyctl info -a [app-name] | grep Region`
- [ ] Feature flags configured (if using)
- [ ] Third-party services configured

### Team
- [ ] Team notified of deployment time
- [ ] On-call schedule confirmed
- [ ] Deployment window scheduled (Tue-Thu, 10 AM-2 PM)
- [ ] Stakeholders informed

---

## Day of Deployment

### Pre-Deploy (1 hour before)

- [ ] Review changes one more time:
  ```bash
  git log production..staging --oneline
  ```
- [ ] Check staging one final time
- [ ] Inform team: "Starting production deployment"
- [ ] Have rollback commands ready
- [ ] Slack/communication channel open

### Merge to Production

```bash
# From staging branch
git checkout staging
git pull origin staging

# Create release
git checkout production
git merge staging --no-ff -m "Release: [Brief description]"
git push origin production
```

- [ ] Merge staging → production
- [ ] Push triggers GitHub Actions workflow

### Approve Deployment

1. [ ] Go to GitHub → Actions → Running workflow
2. [ ] Click "Review deployments"
3. [ ] Verify commit hash and changes
4. [ ] Click "Approve and deploy"

### Monitor Deployment

- [ ] Watch GitHub Actions logs
- [ ] Monitor Fly.io dashboard
- [ ] Watch Sentry for new errors
- [ ] Keep terminal ready for quick commands

---

## Post-Deployment (Immediately After)

### Automated Checks
- [ ] GitHub Actions health checks pass
- [ ] All apps deployed successfully

### Manual Verification

```bash
# Health checks
curl https://maishapoa-production-internal-api.fly.dev/api/health
curl https://maishapoa-production-agent-registration.fly.dev/
curl https://maishapoa-production-public-api.fly.dev/
```

- [ ] All health endpoints return 200
- [ ] Test critical user flows manually
- [ ] Check one production transaction end-to-end

### Monitoring

```bash
# Check logs
flyctl logs -a maishapoa-production-internal-api
flyctl logs -a maishapoa-production-agent-registration
flyctl logs -a maishapoa-production-public-api
```

- [ ] No errors in application logs (first 5 minutes)
- [ ] Response times normal
- [ ] Error rate in Sentry < baseline
- [ ] Database connections healthy
- [ ] CPU/Memory usage normal

---

## Ongoing Monitoring (Next 1-2 Hours)

- [ ] Monitor error rates every 15 minutes
- [ ] Check application metrics
- [ ] Watch for user-reported issues
- [ ] Team member on standby
- [ ] Document any issues observed

---

## End of Day

- [ ] Final check of all metrics
- [ ] Confirm no critical errors
- [ ] Update team: "Deployment stable"
- [ ] Document any issues or learnings
- [ ] Schedule post-deployment review (next day)

---

## If Something Goes Wrong

### Immediate Actions

1. **Assess severity**:
   - Critical (users affected, data loss risk) → Rollback immediately
   - High (some users affected) → Quick fix or rollback
   - Medium (minor issues) → Fix forward
   - Low (cosmetic) → Note for next deploy

2. **Communicate**:
   ```
   "⚠️ Issue detected in production. Investigating..."
   ```

3. **Quick Rollback** (if needed):
   ```bash
   git checkout production
   git revert HEAD --no-edit
   git push origin production
   # Approve deployment in GitHub Actions
   ```

4. **Or Fly.io Rollback**:
   ```bash
   flyctl releases -a maishapoa-production-internal-api
   flyctl releases rollback v[previous-version] -a maishapoa-production-internal-api
   ```

---

## Emergency Contacts

- **Team Lead**: [Contact]
- **DevOps**: [Contact]
- **On-Call**: [Contact]
- **Fly.io Support**: https://fly.io/docs/about/support/

---

## Rollback Commands (Keep Ready)

```bash
# Option 1: Git revert
git checkout production
git revert HEAD --no-edit
git push origin production

# Option 2: Fly.io rollback
flyctl releases -a maishapoa-production-internal-api
flyctl releases rollback v[VERSION] -a maishapoa-production-internal-api
flyctl releases rollback v[VERSION] -a maishapoa-production-agent-registration
flyctl releases rollback v[VERSION] -a maishapoa-production-public-api

# Option 3: Emergency stop
flyctl scale count 0 -a maishapoa-production-internal-api
```

---

## Notes Section

Use this space for deployment-specific notes:

**Deployment Date**: _______________

**Deployed By**: _______________

**Key Changes**:
- 
- 
- 

**Issues Observed**:
- 
- 

**Lessons Learned**:
- 
- 

---

## Success Criteria

Deployment is considered successful when:

- ✅ All health checks pass
- ✅ No increase in error rates
- ✅ Response times within normal range
- ✅ Critical user flows working
- ✅ No rollback needed within 2 hours
- ✅ Team confirms stability

**Signature**: _______________ **Date/Time**: _______________


