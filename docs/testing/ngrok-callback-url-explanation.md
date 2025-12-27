# Understanding Ngrok URLs and M-Pesa Callbacks

## Question 1: How to Use the Ngrok URL

Your ngrok forwarding URL is:
```
https://unwhisperable-underanged-ivory.ngrok-free.dev -> http://localhost:3001
```

**This IS your absolute URL!** You just need to append your API path to it.

### Complete Callback URLs

For your `.env` file, use:

```bash
MPESA_STK_PUSH_CALLBACK_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/confirmation
```

**Breakdown:**
- Base URL: `https://unwhisperable-underanged-ivory.ngrok-free.dev`
- API Path: `/api/public/mpesa/stk-push/callback`
- Full URL: `https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback`

### Testing the URL

You can test that your callback endpoint is accessible:

```bash
# Test STK Push callback endpoint (should return 200 OK)
curl https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback

# Test IPN confirmation endpoint (should return 200 OK)
curl https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/confirmation
```

**Note**: These endpoints expect POST requests with M-Pesa payloads, so a GET request might return 404 or 405, but that's okay - it confirms the URL is reachable.

## Question 2: How Does Safaricom Know the Callback URL?

**You do NOT need to configure the callback URL in the M-Pesa sandbox app!**

### How It Works

The callback URL is sent **dynamically with each STK Push request** to M-Pesa. Here's the flow:

1. **You initiate STK Push** via your API:
   ```bash
   POST /api/internal/mpesa/stk-push/test
   ```

2. **Your API reads the callback URL from `.env`**:
   ```typescript
   const callbackUrl = config.mpesa.stkPushCallbackUrl;
   // e.g., "https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback"
   ```

3. **Your API sends STK Push request to M-Pesa** with the callback URL included:
   ```json
   {
     "BusinessShortCode": "174379",
     "PhoneNumber": "254722000000",
     "Amount": 100.00,
     "CallBackURL": "https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback",
     "AccountReference": "POL123456",
     ...
   }
   ```

4. **M-Pesa stores the callback URL** for this specific STK Push request

5. **When customer completes/cancels**, M-Pesa sends callback to the URL you provided:
   ```
   POST https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback
   ```

### Key Points

- ✅ **No configuration needed** in M-Pesa sandbox app
- ✅ **Callback URL is sent with each request** - you can change it anytime
- ✅ **Different callback URLs** can be used for different requests (though typically you use the same one)
- ✅ **M-Pesa remembers the URL** for each specific STK Push request

### For IPN (Instant Payment Notification)

IPN works differently - you typically configure it once in the M-Pesa portal, but for sandbox testing, M-Pesa may send IPNs to any URL you specify. However, our implementation doesn't require pre-configuration because:

1. IPN callbacks are sent automatically by M-Pesa for all transactions
2. The IPN confirmation URL in your `.env` is used for logging/reference, but M-Pesa may send IPNs regardless

## Important Notes

### Ngrok URL Changes

**Free ngrok URLs change every time you restart ngrok!**

If you restart ngrok, you'll get a new URL like:
```
https://different-random-name.ngrok-free.dev
```

**You must update your `.env` file** with the new URL and restart your API:

```bash
# 1. Stop ngrok (Ctrl+C)
# 2. Restart ngrok
ngrok http 3001

# 3. Copy the new URL
# 4. Update .env file
MPESA_STK_PUSH_CALLBACK_URL=https://new-url.ngrok-free.dev/api/public/mpesa/stk-push/callback

# 5. Restart your API
pnpm start:dev
```

### Solution: Fixed Domain with Paid Ngrok

**Yes, paid ngrok plans offer fixed/static domains!**

If you upgrade to a paid ngrok plan, you can reserve a custom subdomain that stays the same:

```bash
# Reserve a subdomain in ngrok dashboard (e.g., "microbima-dev")
# Then start ngrok with your reserved subdomain:
ngrok http --subdomain=microbima-dev 3001

# Your URL will always be:
# https://microbima-dev.ngrok.io
```

**Benefits:**
- ✅ URL never changes
- ✅ No need to update `.env` file
- ✅ Consistent for testing
- ✅ Can share with team

**Pricing:** Check https://ngrok.com/pricing for current plans (typically starts around $8/month)

### Alternatives to Paid Ngrok

**Option 1: Use Staging Environment for Testing**
- Deploy to staging (Fly.io)
- Use staging URL directly (no ngrok needed)
- More realistic testing environment
- **Cost:** Free (you already have staging)

**Option 2: Cloudflare Tunnel (Free)**
- Free alternative with fixed domains
- More stable than free ngrok
- Setup: `cloudflared tunnel --url http://localhost:3001`

**Option 3: Localtunnel (Free)**
- Free, but URLs still change
- Command: `npx localtunnel --port 3001`

**Option 4: Accept Free Ngrok Limitation**
- For occasional local testing, updating `.env` is acceptable
- Most testing can be done on staging anyway
- **Cost:** Free

### Production/Staging

For production/staging, you don't need ngrok because your API is already publicly accessible:

```bash
# Staging
MPESA_STK_PUSH_CALLBACK_URL=https://maishapoa-staging-internal-api.fly.dev/api/public/mpesa/stk-push/callback

# Production
MPESA_STK_PUSH_CALLBACK_URL=https://maishapoa-production-internal-api.fly.dev/api/public/mpesa/stk-push/callback
```

## Quick Setup Checklist

- [ ] Ngrok is running: `ngrok http 3001`
- [ ] Copy the HTTPS URL from ngrok output
- [ ] Update `.env` with full callback URLs (base URL + API path)
- [ ] Restart your API to pick up new `.env` values
- [ ] Test STK Push - M-Pesa will automatically use the callback URL from your request

## Example .env Configuration

```bash
# M-Pesa Credentials
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey
MPESA_ENVIRONMENT=sandbox

# Callback URLs (use your current ngrok URL)
MPESA_STK_PUSH_CALLBACK_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/confirmation

# IP Whitelist (optional for sandbox)
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128
```

