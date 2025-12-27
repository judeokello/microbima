# Ngrok Persistent URL Options

## The Problem

Free ngrok URLs change every time you restart ngrok, requiring you to:
1. Update `.env` file
2. Restart your API
3. This is cumbersome for frequent testing

## Solutions

### Option 1: Paid Ngrok (Fixed Domain) ⭐ Recommended for Frequent Testing

**Cost:** ~$8/month (check current pricing at https://ngrok.com/pricing)

**Setup:**
1. Upgrade to paid ngrok plan
2. Reserve a custom subdomain in ngrok dashboard (e.g., `microbima-dev`)
3. Start ngrok with your reserved subdomain:

```bash
ngrok http --subdomain=microbima-dev 3001
```

**Your URL will always be:**
```
https://microbima-dev.ngrok.io
```

**Benefits:**
- ✅ URL never changes
- ✅ No `.env` updates needed
- ✅ Consistent for team collaboration
- ✅ Professional development workflow

**Your `.env` stays the same:**
```bash
MPESA_STK_PUSH_CALLBACK_URL=https://microbima-dev.ngrok.io/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://microbima-dev.ngrok.io/api/public/mpesa/confirmation
```

### Option 2: Use Staging Environment ⭐ Best for Real Testing

**Cost:** Free (you already have staging)

**Why this is better:**
- ✅ More realistic testing environment
- ✅ No ngrok needed
- ✅ Stable URLs
- ✅ Tests actual deployment
- ✅ Can test with real M-Pesa credentials

**Setup:**
1. Deploy to staging (already set up)
2. Use staging URL directly:

```bash
# In Fly secrets for staging
MPESA_STK_PUSH_CALLBACK_URL=https://maishapoa-staging-internal-api.fly.dev/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://maishapoa-staging-internal-api.fly.dev/api/public/mpesa/confirmation
```

**Workflow:**
- Develop locally (no callbacks needed for unit testing)
- Test STK Push on staging (real environment)
- Use ngrok only for debugging specific local issues

### Option 3: Cloudflare Tunnel (Free Alternative)

**Cost:** Free

**Setup:**
```bash
# Install cloudflared
# Linux: Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Create tunnel
cloudflared tunnel --url http://localhost:3001
```

**Benefits:**
- ✅ Free
- ✅ More stable than free ngrok
- ⚠️ URLs may still change (check Cloudflare docs)

### Option 4: Accept Free Ngrok Limitation

**Cost:** Free

**When this works:**
- Occasional local testing
- Most testing done on staging
- Don't mind updating `.env` occasionally

**Workflow:**
1. Start ngrok when needed
2. Copy URL to `.env`
3. Restart API
4. Test
5. Keep ngrok running for the session

## Recommendation

**For your use case, I recommend:**

1. **Primary Testing:** Use staging environment
   - Deploy to staging
   - Test with staging URL
   - Most realistic and stable

2. **Local Debugging:** Use free ngrok when needed
   - Only when debugging specific local issues
   - Accept the URL change limitation
   - Update `.env` when needed

3. **If you test locally frequently:** Consider paid ngrok
   - Only if you find yourself testing locally very often
   - $8/month may be worth it for convenience

## Quick Comparison

| Solution | Cost | URL Stability | Setup Complexity | Best For |
|----------|------|---------------|------------------|----------|
| **Staging** | Free | ✅ Stable | Easy | Production-like testing |
| **Paid Ngrok** | ~$8/mo | ✅ Fixed | Easy | Frequent local testing |
| **Free Ngrok** | Free | ❌ Changes | Easy | Occasional local testing |
| **Cloudflare** | Free | ⚠️ May change | Medium | Alternative to ngrok |

## My Recommendation for You

**Start with staging for testing:**
- You already have staging deployed
- More realistic environment
- No additional cost
- Stable URLs

**Use free ngrok only when:**
- Debugging specific local issues
- Need to test before deploying
- Occasional use is fine

**Upgrade to paid ngrok only if:**
- You find yourself testing locally very frequently
- The URL changes become a real pain point
- $8/month is worth the convenience


