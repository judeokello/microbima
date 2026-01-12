# M-Pesa Daraja API Configuration Guide

This guide explains how to configure the M-Pesa Daraja API integration for MicroBima, including environment variables, callback URL registration, and external dependencies.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Callback URL Registration](#callback-url-registration)
- [External Dependencies](#external-dependencies)
- [Production Configuration](#production-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **M-Pesa Daraja API Account**
   - Sign up at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
   - Create a sandbox app for testing
   - Complete "Go Live" process for production access

2. **Public HTTPS Endpoint**
   - For local development: Use ngrok or similar tunnel service
   - For staging/production: Deploy API with publicly accessible HTTPS URL

## Environment Variables

All M-Pesa configuration is done via environment variables. See `apps/api/env.example` for a complete list with detailed comments.

### Required Variables

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `MPESA_CONSUMER_KEY` | OAuth consumer key | `your_consumer_key` | Safaricom Developer Portal |
| `MPESA_CONSUMER_SECRET` | OAuth consumer secret | `your_consumer_secret` | Safaricom Developer Portal |
| `MPESA_BUSINESS_SHORT_CODE` | Business short code | `174379` (sandbox) | Safaricom Developer Portal / Production credentials |
| `MPESA_PASSKEY` | Security credential/passkey | `your_passkey` | Safaricom Developer Portal / Production credentials |
| `MPESA_STK_PUSH_CALLBACK_URL` | STK Push callback URL | `https://api.example.com/api/public/mpesa/stk-push/callback` | Your deployed API URL |
| `MPESA_IPN_CONFIRMATION_URL` | IPN confirmation URL | `https://api.example.com/api/public/mpesa/confirmation` | Your deployed API URL |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `MPESA_ENVIRONMENT` | Environment: `sandbox` or `production` | `sandbox` | Affects API base URL |
| `MPESA_BASE_URL` | Custom base URL | Auto-derived from environment | Only override if needed |
| `MPESA_ALLOWED_IP_RANGES` | IP whitelist (CIDR notation) | None (all IPs in dev) | Required for production |
| `MPESA_STK_PUSH_TIMEOUT_MINUTES` | STK Push timeout | `5` minutes | Configurable timeout |
| `MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES` | Expiration check interval | `2` minutes | Periodic job interval |

### Example Configuration

#### Local Development (.env file)

```bash
# M-Pesa Daraja API Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY='your_passkey_here'  # Use quotes if passkey has special characters

# Environment
MPESA_ENVIRONMENT=sandbox

# Callback URLs (use ngrok for local testing)
# Example: If ngrok gives you https://abc123.ngrok.io
MPESA_STK_PUSH_CALLBACK_URL=https://abc123.ngrok.io/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://abc123.ngrok.io/api/public/mpesa/confirmation

# IP Whitelist (optional for sandbox)
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128
```

#### Production (Fly.io Secrets)

```bash
flyctl secrets set \
  MPESA_CONSUMER_KEY="your_production_consumer_key" \
  MPESA_CONSUMER_SECRET="your_production_consumer_secret" \
  MPESA_BUSINESS_SHORT_CODE="your_production_shortcode" \
  MPESA_PASSKEY="your_production_passkey" \
  MPESA_ENVIRONMENT="production" \
  MPESA_STK_PUSH_CALLBACK_URL="https://your-api.fly.dev/api/public/mpesa/stk-push/callback" \
  MPESA_IPN_CONFIRMATION_URL="https://your-api.fly.dev/api/public/mpesa/confirmation" \
  MPESA_ALLOWED_IP_RANGES="196.201.214.0/24,196.201.215.0/24" \
  -a your-production-app
```

**Important Notes:**
- Passkey values with special characters (`+`, `/`, `=`) must be quoted
- Use production credentials (not sandbox) for production environment
- Callback URLs must be publicly accessible HTTPS endpoints
- IP ranges must be obtained from Safaricom support for production

## Callback URL Registration

M-Pesa callbacks are sent **dynamically** - you do NOT need to pre-register callback URLs in the M-Pesa portal. The callback URLs are sent with each STK Push request and configured in your application.

### How It Works

1. **STK Push Requests**: The callback URL is read from `MPESA_STK_PUSH_CALLBACK_URL` environment variable and sent with each STK Push request to M-Pesa
2. **IPN Notifications**: The IPN confirmation URL is configured in your M-Pesa portal settings (if required by your setup)
3. **Security**: Callbacks are secured via IP whitelist validation (see [External Dependencies](#external-dependencies))

### Local Development Setup

For local development, you need a publicly accessible HTTPS endpoint. Use ngrok:

```bash
# Start ngrok tunnel
ngrok http 3001

# Use the ngrok URL in your .env file
MPESA_STK_PUSH_CALLBACK_URL=https://abc123.ngrok.io/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://abc123.ngrok.io/api/public/mpesa/confirmation
```

See [Ngrok Setup Guide](../testing/ngrok-setup-guide.md) for detailed instructions.

### Production Setup

1. Deploy your API with a publicly accessible HTTPS URL
2. Set the callback URLs in your environment variables (Fly.io secrets)
3. Ensure your API endpoints are accessible (test with curl)
4. Configure IP whitelist for security (see [External Dependencies](#external-dependencies))

## External Dependencies

### IP Whitelist (Required for Production)

For production, you **must** whitelist Safaricom IP addresses to secure callback endpoints.

#### Getting Safaricom IP Ranges

Contact Safaricom support to get official IP ranges:
- Email: `apisupport@safaricom.co.ke`
- Or check Safaricom Developer Portal documentation

**Example IP Ranges** (subject to change - verify with Safaricom):
```
196.201.214.200
196.201.214.206
196.201.213.114
196.201.214.207
196.201.214.208
196.201.213.44
196.201.212.127
196.201.212.138
196.201.212.129
196.201.212.136
196.201.212.74
196.201.212.69
```

Convert to CIDR notation or use individual IPs with `/32`:
```bash
MPESA_ALLOWED_IP_RANGES="196.201.214.200/32,196.201.214.206/32,196.201.213.114/32,..."
```

**Development:** IP whitelist is optional - all IPs are allowed in development mode.

### Security Credentials (Passkey)

The M-Pesa Passkey (also called "Security Credential") is used to generate STK Push passwords.

#### For Sandbox
1. Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Log in to your account
3. Navigate to **"My Apps"** → Select your sandbox app
4. Look for **"Test Credentials"** or **"Security Credential"** section
5. Click **"Generate"** to create a security credential
6. Copy the generated value - this is your passkey

#### For Production
1. Complete the "Go Live" process in the M-Pesa portal
2. Safaricom will send production credentials via email
3. The passkey will be included in the production credentials

**Important:** If your passkey contains special characters (`+`, `/`, `=`), wrap it in quotes in your `.env` file:
```bash
MPESA_PASSKEY='your+passkey/with=special+chars'  # ✅ Correct
MPESA_PASSKEY=your+passkey/with=special+chars    # ❌ Wrong
```

See [M-Pesa Passkey Configuration Guide](../testing/mpesa-passkey-configuration.md) for detailed instructions.

## Production Configuration

### Checklist Before Going Live

- [ ] Obtain production credentials from Safaricom (Consumer Key, Secret, Short Code, Passkey)
- [ ] Deploy API with publicly accessible HTTPS URL
- [ ] Configure all required environment variables
- [ ] Obtain and configure Safaricom IP ranges for whitelist
- [ ] Test callback endpoints are accessible
- [ ] Verify IP whitelist validation works
- [ ] Test STK Push initiation and callbacks
- [ ] Test IPN notifications
- [ ] Monitor logs for errors
- [ ] Set up Sentry alerts for payment processing errors

### Security Best Practices

1. **Never commit credentials** - Use environment variables only
2. **Use strong passkeys** - Safaricom-generated credentials only
3. **Enable IP whitelist** - Required for production
4. **Monitor callback logs** - Watch for unauthorized access attempts
5. **Use HTTPS only** - M-Pesa requires HTTPS for callbacks
6. **Rotate credentials** - Follow Safaricom's credential rotation policy

## Troubleshooting

### Common Issues

#### 1. Callback Not Received

**Symptoms:** STK Push initiated but no callback received

**Solutions:**
- Verify callback URL is publicly accessible (test with curl)
- Check ngrok is running (for local development)
- Verify callback URL matches environment variable exactly
- Check M-Pesa API status/downtime
- Review application logs for errors

#### 2. IP Whitelist Rejection

**Symptoms:** Callbacks rejected with security violation logs

**Solutions:**
- Verify IP ranges are correct (contact Safaricom for latest ranges)
- Check IP whitelist configuration format (CIDR notation)
- Ensure production environment is set correctly
- Review security violation logs for actual IP addresses

#### 3. Authentication Errors

**Symptoms:** OAuth token generation fails

**Solutions:**
- Verify Consumer Key and Secret are correct
- Check credentials match environment (sandbox vs production)
- Ensure credentials are active in Safaricom portal
- Verify base URL matches environment

#### 4. Passkey Issues

**Symptoms:** STK Push password generation fails

**Solutions:**
- Verify passkey is correct (wrap in quotes if special characters)
- Check passkey matches environment (sandbox vs production)
- Ensure passkey is properly formatted (no extra whitespace)

### Getting Help

- **Safaricom Support**: `apisupport@safaricom.co.ke`
- **Developer Portal**: https://developer.safaricom.co.ke/
- **MicroBima Documentation**: See [testing guides](../testing/)
- **Application Logs**: Check structured JSON logs for error details

## Related Documentation

- [M-Pesa STK Push Testing Guide](../testing/mpesa-stk-push-testing-guide.md)
- [M-Pesa Passkey Configuration](../testing/mpesa-passkey-configuration.md)
- [Ngrok Setup Guide](../testing/ngrok-setup-guide.md)
- [Ngrok Callback URL Explanation](../testing/ngrok-callback-url-explanation.md)
- [Environment Variables Reference](../../apps/api/env.example)





