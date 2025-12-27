# Finding API Logs

## Where Are the Logs?

The API logs are in the **terminal/console where you started the API**.

### If you started with:
```bash
pnpm dev:api
# OR
cd apps/api && pnpm start:dev
```

The logs appear in **that same terminal window**.

## What to Look For

When you test STK Push, look for these log entries:

### 1. OAuth Token Request
```
OAUTH_TOKEN_REQUEST
```
This shows:
- The exact URL being called
- Correlation ID
- Timestamp

### 2. OAuth Token Error (if it fails)
```
OAUTH_TOKEN_ERROR
```
This shows:
- HTTP status code
- The exact URL
- Base URL from config
- Environment (sandbox/production)
- Error response body

### 3. STK Push Logs
```
STK_PUSH_INITIATION_START
STK_PUSH_REQUEST_CREATED
STK_PUSH_SUCCESS (or STK_PUSH_RETRY_EXHAUSTED)
```

## Example Log Output

You should see something like:
```json
{
  "event": "OAUTH_TOKEN_REQUEST",
  "correlationId": "stk-test-123456",
  "url": "https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials",
  "timestamp": "2025-12-26T14:28:16.374Z"
}
```

And if it fails:
```json
{
  "event": "OAUTH_TOKEN_ERROR",
  "correlationId": "stk-test-123456",
  "status": 404,
  "url": "https://sandbox.safaricom.co.ke/mpesa/oauth/v1/generate?grant_type=client_credentials",
  "baseUrl": "https://sandbox.safaricom.co.ke/mpesa",
  "environment": "sandbox",
  "errorBody": "(empty response)"
}
```

## If You Can't Find the Terminal

1. **Check running processes:**
   ```bash
   ps aux | grep "nest start"
   ```

2. **Check which terminal it's in:**
   ```bash
   lsof -p $(pgrep -f "nest start") | grep cwd
   ```

3. **Or restart the API in a new terminal:**
   ```bash
   cd apps/api
   pnpm start:dev
   ```
   This will show logs in the new terminal.

## Log Format

All logs are in **structured JSON format** for easy parsing and searching.

## Tips

- **Keep the API terminal visible** while testing
- **Scroll up** to see earlier log entries
- **Look for the correlation ID** to trace a specific request through all logs
- **Search for "OAUTH"** to find OAuth-related logs quickly


