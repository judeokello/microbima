# Manual M-Pesa OAuth Test

If the automated script is having issues, you can test OAuth manually:

## Quick Test Command

```bash
# Read credentials from .env
CONSUMER_KEY=$(grep "^MPESA_CONSUMER_KEY=" apps/api/.env | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')
CONSUMER_SECRET=$(grep "^MPESA_CONSUMER_SECRET=" apps/api/.env | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d ' ')

# Create Basic Auth
AUTH=$(echo -n "${CONSUMER_KEY}:${CONSUMER_SECRET}" | base64)

# Test OAuth (Sandbox)
curl -v "https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic $AUTH"
```

## Expected Success Response

```json
{
  "access_token": "abc123...",
  "expires_in": "3599"
}
```

## Common Issues

### 401 Unauthorized
- Wrong Consumer Key or Secret
- Credentials don't match environment (sandbox vs production)

### 404 Not Found
- Wrong base URL
- Wrong environment setting

### Timeout/Connection Error
- Network connectivity issue
- Firewall blocking request
- M-Pesa API temporarily unavailable

## Next Steps

Once OAuth works, you can test STK Push:
```bash
./scripts/test-stk-push.sh
```








