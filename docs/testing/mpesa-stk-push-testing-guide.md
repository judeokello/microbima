# M-Pesa STK Push Testing Guide

This guide explains how to configure and test the M-Pesa STK Push functionality.

## Prerequisites

1. **M-Pesa Daraja API Account**: You need a Safaricom Developer Portal account
   - Sign up at: https://developer.safaricom.co.ke/
   - Create a sandbox app to get credentials

2. **M-Pesa Sandbox Credentials** (for testing):
   - Consumer Key
   - Consumer Secret
   - Business Short Code (test shortcode: `174379`)
   - Passkey

3. **Public Callback URLs**: Your API must be publicly accessible for M-Pesa callbacks
   - For local testing: Use ngrok or similar tunnel service
   - For staging/production: Use your deployed API URL

## Configuration

### 1. Local Development (.env file)

Add these variables to `apps/api/.env`:

```bash
# M-Pesa Daraja API Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_ENVIRONMENT=sandbox

# Callback URLs (use ngrok for local testing)
# Example: If ngrok gives you https://abc123.ngrok.io
MPESA_STK_PUSH_CALLBACK_URL=https://abc123.ngrok.io/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://abc123.ngrok.io/api/public/mpesa/confirmation

# IP Whitelist (optional for sandbox, required for production)
# For sandbox testing, leave empty or use localhost ranges
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128

# Optional: Timeout configuration
MPESA_STK_PUSH_TIMEOUT_MINUTES=5
MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES=2
```

### 2. Staging Environment (Fly Secrets)

Set secrets for your staging app:

```bash
# Set all M-Pesa secrets at once
flyctl secrets set \
  MPESA_CONSUMER_KEY="your_consumer_key" \
  MPESA_CONSUMER_SECRET="your_consumer_secret" \
  MPESA_BUSINESS_SHORT_CODE="174379" \
  MPESA_PASSKEY="your_passkey" \
  MPESA_ENVIRONMENT="sandbox" \
  MPESA_STK_PUSH_CALLBACK_URL="https://maishapoa-staging-internal-api.fly.dev/api/public/mpesa/stk-push/callback" \
  MPESA_IPN_CONFIRMATION_URL="https://maishapoa-staging-internal-api.fly.dev/api/public/mpesa/confirmation" \
  MPESA_ALLOWED_IP_RANGES="196.201.214.0/24,196.201.215.0/24" \
  -a maishapoa-staging-internal-api
```

**Note**: Replace `maishapoa-staging-internal-api.fly.dev` with your actual staging API URL.

### 3. Production Environment (Fly Secrets)

```bash
# Set all M-Pesa secrets at once
flyctl secrets set \
  MPESA_CONSUMER_KEY="your_production_consumer_key" \
  MPESA_CONSUMER_SECRET="your_production_consumer_secret" \
  MPESA_BUSINESS_SHORT_CODE="your_production_shortcode" \
  MPESA_PASSKEY="your_production_passkey" \
  MPESA_ENVIRONMENT="production" \
  MPESA_STK_PUSH_CALLBACK_URL="https://maishapoa-production-internal-api.fly.dev/api/public/mpesa/stk-push/callback" \
  MPESA_IPN_CONFIRMATION_URL="https://maishapoa-production-internal-api.fly.dev/api/public/mpesa/confirmation" \
  MPESA_ALLOWED_IP_RANGES="196.201.214.0/24,196.201.215.0/24" \
  -a maishapoa-production-internal-api
```

**Important**: 
- Get official IP ranges from Safaricom support (apisupport@safaricom.co.ke)
- Use production credentials (not sandbox)
- Ensure callback URLs are publicly accessible HTTPS

## Testing STK Push

### Option 1: Test Endpoint (No Authentication Required)

The test endpoint skips authentication for easier testing:

```bash
# Test endpoint (no auth required)
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254722000000",
    "amount": 100.00,
    "accountReference": "POL123456",
    "transactionDesc": "Test payment"
  }'
```

**Response**:
```json
{
  "id": "uuid-here",
  "checkoutRequestID": "ws_CO_270120251430451234567890",
  "merchantRequestID": "uuid-here",
  "status": "PENDING",
  "phoneNumber": "254722000000",
  "amount": 100.00,
  "accountReference": "POL123456",
  "initiatedAt": "2025-01-27T14:30:45Z"
}
```

### Option 2: Production Endpoint (Requires Bearer Token)

For production-like testing with authentication:

```bash
# Get Supabase JWT token first (from your frontend/login)
TOKEN="your-supabase-jwt-token"

# Initiate STK Push
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phoneNumber": "254722000000",
    "amount": 100.00,
    "accountReference": "POL123456",
    "transactionDesc": "Premium payment"
  }'
```

### Testing on Staging

```bash
# Test endpoint on staging
curl -X POST https://maishapoa-staging-internal-api.fly.dev/api/internal/mpesa/stk-push/test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254722000000",
    "amount": 100.00,
    "accountReference": "POL123456"
  }'
```

## What Happens When You Test

1. **STK Push Request Created**: A record is created in `mpesa_stk_push_requests` table with status `PENDING`
2. **M-Pesa API Called**: The system calls M-Pesa Daraja API to send payment prompt to customer's phone
3. **Customer Receives Prompt**: Customer sees M-Pesa prompt on their phone
4. **Customer Action**: Customer can:
   - Enter PIN and confirm → Status becomes `COMPLETED`
   - Cancel → Status becomes `CANCELLED`
   - Let it timeout → Status becomes `EXPIRED`
5. **Callback Received**: M-Pesa sends callback to `/api/public/mpesa/stk-push/callback`
6. **Payment Records Created**: If completed, records are created in `mpesa_payment_report_items` and `policy_payments`
7. **IPN Linking**: When IPN arrives, it links to the STK Push request if within 24-hour window

## Testing Checklist

- [ ] M-Pesa credentials configured in `.env` (local) or Fly secrets (staging/production)
- [ ] Callback URLs are publicly accessible (use ngrok for local)
- [ ] API is running and accessible
- [ ] Test endpoint accessible (no auth required)
- [ ] STK Push request created successfully
- [ ] Customer receives M-Pesa prompt
- [ ] Callback received when customer completes/cancels
- [ ] Payment records created (if completed)
- [ ] IPN links to STK Push request (if IPN arrives)

## Troubleshooting

### Error: "MPESA_CONSUMER_KEY is required"
- **Solution**: Ensure all required M-Pesa environment variables are set

### Error: "Invalid phone number format"
- **Solution**: Use format `254XXXXXXXXX` (12 digits starting with 254)

### Error: "Policy with payment account number 'XXX' not found"
- **Solution**: Ensure the `accountReference` matches an existing policy's `paymentAcNumber`

### Error: "OAuth token request failed"
- **Solution**: Check Consumer Key and Consumer Secret are correct

### Error: "STK Push request failed"
- **Solution**: 
  - Check Business Short Code and Passkey
  - Verify callback URL is publicly accessible
  - Check M-Pesa API status

### Callback Not Received
- **Solution**:
  - Verify callback URL is publicly accessible (use ngrok for local)
  - Check IP whitelist allows M-Pesa IPs (for production)
  - Check application logs for callback attempts

## Getting M-Pesa Sandbox Credentials

1. Go to https://developer.safaricom.co.ke/
2. Sign up/Login
3. Go to "My Apps" → Create new app (or use existing)
4. Copy:
   - Consumer Key
   - Consumer Secret
   - Business Short Code (test: `174379`)
   - Passkey (found in app settings)

## Using Ngrok for Local Testing

```bash
# Install ngrok (if not installed)
# macOS: brew install ngrok
# Linux: Download from https://ngrok.com/

# Start your API locally
cd apps/api && pnpm start:dev

# In another terminal, start ngrok
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use it in your .env:
# MPESA_STK_PUSH_CALLBACK_URL=https://abc123.ngrok.io/api/public/mpesa/stk-push/callback
# MPESA_IPN_CONFIRMATION_URL=https://abc123.ngrok.io/api/public/mpesa/confirmation
```

## Next Steps

After successful testing:
1. Verify payment records are created correctly
2. Test IPN linking to STK Push requests
3. Test statement upload deduplication
4. Monitor logs for any errors
5. Test error scenarios (invalid phone, wrong amount, etc.)


