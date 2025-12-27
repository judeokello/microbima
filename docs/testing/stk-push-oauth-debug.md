# STK Push OAuth Debugging Guide

## Current Error

```
OAuth token request failed: 404 Not Found
```

This means **the request is NOT reaching M-Pesa**. The OAuth token request fails before the STK Push request is even sent.

## What This Means

1. ✅ **Your API endpoint is working** - Request validation passed
2. ✅ **Policy lookup is working** - Account reference found
3. ❌ **M-Pesa OAuth is failing** - Cannot authenticate with M-Pesa API
4. ❌ **STK Push never sent** - Request fails before reaching M-Pesa

## Root Cause

The OAuth endpoint is returning 404, which typically means:
- **Wrong base URL** (sandbox vs production)
- **Wrong OAuth endpoint path**
- **M-Pesa API endpoint changed** (unlikely)

## OAuth URL Structure

The OAuth URL is constructed as:
```
{MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials
```

**For Sandbox:**
```
https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials
```

**For Production:**
```
https://api.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials
```

## Debugging Steps

### 1. Check Your .env Configuration

Verify these values in `apps/api/.env`:

```bash
MPESA_ENVIRONMENT=sandbox
MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
```

**Common Issues:**
- ❌ `MPESA_BASE_URL` missing or wrong
- ❌ `MPESA_ENVIRONMENT` not set (should be `sandbox` for testing)
- ❌ Trailing slashes in base URL (should NOT have trailing slash)

### 2. Test OAuth Endpoint Directly

Test the OAuth endpoint manually:

```bash
# Get your credentials from .env
CONSUMER_KEY="your_consumer_key"
CONSUMER_SECRET="your_consumer_secret"

# Create Basic Auth header
AUTH=$(echo -n "${CONSUMER_KEY}:${CONSUMER_SECRET}" | base64)

# Test sandbox OAuth
curl -X GET "https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic ${AUTH}"
```

**Expected Response (Success):**
```json
{
  "access_token": "abc123...",
  "expires_in": "3599"
}
```

**If you get 404:**
- Check if the URL is correct
- Verify you're using sandbox credentials with sandbox URL
- Check M-Pesa portal for any API changes

### 3. Check API Logs

Look for these log entries in your API console:

```
OAUTH_TOKEN_REQUEST
OAUTH_TOKEN_GENERATED (success)
OAUTH_TOKEN_ERROR (failure)
```

The logs should show the exact URL being called.

### 4. Verify M-Pesa Credentials

1. Go to https://developer.safaricom.co.ke/
2. Log in to your account
3. Go to "My Apps" → Select your sandbox app
4. Verify:
   - Consumer Key matches your `.env`
   - Consumer Secret matches your `.env`
   - App is active/enabled

### 5. Check Base URL Configuration

The base URL should be:
- **Sandbox:** `https://sandbox.safaricom.co.ke/mpesa` (NO trailing slash)
- **Production:** `https://api.safaricom.co.ke/mpesa` (NO trailing slash)

**In your .env:**
```bash
# ✅ CORRECT
MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa

# ❌ WRONG - trailing slash
MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa/

# ❌ WRONG - wrong environment
MPESA_BASE_URL=https://api.safaricom.co.ke/mpesa  # (for production)
```

## Quick Fix Checklist

- [ ] `MPESA_ENVIRONMENT=sandbox` in `.env`
- [ ] `MPESA_BASE_URL=https://sandbox.safaricom.co.ke/mpesa` (no trailing slash)
- [ ] `MPESA_CONSUMER_KEY` matches M-Pesa portal
- [ ] `MPESA_CONSUMER_SECRET` matches M-Pesa portal
- [ ] Restarted API after updating `.env`
- [ ] Tested OAuth endpoint manually (see step 2 above)

## After Fixing

Once OAuth works, you should see:
1. `OAUTH_TOKEN_GENERATED` in logs
2. `STK_PUSH_REQUEST` in logs
3. `STK_PUSH_SUCCESS` in logs
4. Response with `checkoutRequestID`
5. **Then** M-Pesa sends STK Push to your phone

## Still Not Working?

If OAuth works but STK Push still doesn't arrive:
1. Check phone number format (must be `254XXXXXXXXX`)
2. Verify callback URL is publicly accessible (ngrok running)
3. Check M-Pesa sandbox test phone number requirements
4. Look for `STK_PUSH_SUCCESS` in logs (means M-Pesa accepted the request)


