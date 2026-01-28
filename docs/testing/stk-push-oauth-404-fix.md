# Fixing OAuth 404 Error in API

## Problem

The OAuth test script works (using `curl -u`), but the API's `fetch()` is getting 404 errors.

## Root Cause

The API's Node.js `fetch()` might be:
1. Using a different URL than expected
2. Being blocked by M-Pesa's WAF differently than curl
3. Not picking up the correct base URL from environment

## Solution Steps

### 1. Verify API Restarted

**Important**: After code changes, you MUST restart the API:

```bash
# Stop the API (Ctrl+C in the terminal running it)
# Then restart:
cd apps/api
pnpm start:dev
```

### 2. Check API Logs

Look for this log entry when testing STK Push:
```
OAUTH_TOKEN_REQUEST
```

It should show the URL being used. Verify it matches:
```
https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials
```

### 3. Add MPESA_BASE_URL to .env (Optional but Recommended)

Even though it defaults correctly, explicitly set it:

```bash
# In apps/api/.env
MPESA_ENVIRONMENT=sandbox
MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa
```

### 4. Test OAuth Directly

Before testing STK Push, verify OAuth works:
```bash
./scripts/test-mpesa-oauth-simple.sh
```

This should return a 200 OK with an access token.

### 5. Check API Configuration

The API should be using:
- `MPESA_ENVIRONMENT=sandbox` (or not set, defaults to sandbox)
- Base URL: `https://sandbox.safaricom.co.ke/mpesa`

## Debugging

### Check What URL API is Using

Add temporary logging or check API console for:
```
OAUTH_TOKEN_REQUEST
```

The log should show the exact URL being called.

### Compare with Working curl

The working curl command:
```bash
curl -u "${CONSUMER_KEY}:${CONSUMER_SECRET}" \
  "https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials"
```

The API should be calling the exact same URL.

## If Still Failing

If OAuth test script works but API doesn't:

1. **Check API logs** - Look for the exact URL in `OAUTH_TOKEN_REQUEST` log
2. **Verify environment variables** - Make sure API is reading from correct `.env` file
3. **Restart API** - Code changes require restart
4. **Check for typos** - Verify `MPESA_ENVIRONMENT` is exactly `sandbox` (not `Sandbox` or `SANDBOX`)

## Expected Flow

1. ✅ OAuth test script works → Credentials are correct
2. ⏳ API OAuth works → API can authenticate
3. ⏳ STK Push sent → M-Pesa receives request
4. ⏳ STK Push on phone → Customer sees prompt

We're stuck at step 2. Once API OAuth works, STK Push should work.








