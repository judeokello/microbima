# M-Pesa Passkey Configuration Guide

## What is the M-Pesa Passkey?

The **M-Pesa Passkey** (also called "Security Credential" in the M-Pesa portal) is a credential used to generate the password for STK Push requests.

**Formula:** `Base64(BusinessShortCode + Passkey + Timestamp)`

This password is sent to M-Pesa with each STK Push request for authentication.

## Where to Find It

### For Sandbox (Testing)

1. Go to https://developer.safaricom.co.ke/
2. Log in to your account
3. Navigate to **"My Apps"** → Select your sandbox app
4. Look for **"Test Credentials"** or **"Security Credential"** section
5. Click **"Generate"** to create a security credential
6. Copy the generated value - **this is your passkey**

### For Production

1. Complete the "Go Live" process in the M-Pesa portal
2. Safaricom will send production credentials via email
3. The passkey will be included in the production credentials

## Special Characters in .env File

The passkey (security credential) is often a **Base64-encoded string** that may contain special characters like:
- `+` (plus sign)
- `/` (forward slash)
- `=` (equals sign)

### ✅ Correct Way: Use Quotes

**Always wrap the passkey value in quotes** in your `.env` file:

```bash
# ✅ CORRECT - Use single quotes
MPESA_PASSKEY='your+passkey/with=special+chars'

# ✅ CORRECT - Use double quotes
MPESA_PASSKEY="your+passkey/with=special+chars"

# ❌ WRONG - No quotes (special characters may be misinterpreted)
MPESA_PASSKEY=your+passkey/with=special+chars
```

### Why Quotes Are Important

Without quotes, some shell environments or .env parsers might:
- Interpret `+` as a special character
- Split on `/` 
- Misinterpret `=` as an assignment operator

**With quotes, the entire string is treated as a single value.**

## Example .env Configuration

```bash
# M-Pesa Daraja API Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY='bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'
MPESA_ENVIRONMENT=sandbox

# Callback URLs
MPESA_STK_PUSH_CALLBACK_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/confirmation
```

## Verification

After adding the passkey to your `.env` file:

1. **Restart your API** to load the new environment variable
2. **Check logs** when initiating STK Push - you should see:
   - `OAUTH_TOKEN_GENERATED` (if OAuth works)
   - `STK_PUSH_REQUEST` (if passkey is correct)
   - `STK_PUSH_SUCCESS` (if everything works)

3. **If you see errors**, check:
   - Passkey is quoted in `.env`
   - No extra spaces around the quotes
   - Passkey value matches exactly what's in the M-Pesa portal

## Common Issues

### Issue: "Invalid password" or "Authentication failed"

**Possible causes:**
- Passkey not quoted in `.env` (special characters misinterpreted)
- Extra spaces in the passkey value
- Wrong passkey (using production passkey in sandbox or vice versa)

**Solution:**
```bash
# Check your .env file
cat apps/api/.env | grep MPESA_PASSKEY

# Should show:
# MPESA_PASSKEY='your+passkey/here'
# NOT:
# MPESA_PASSKEY = 'your+passkey/here'  (extra spaces)
# MPESA_PASSKEY=your+passkey/here       (no quotes)
```

### Issue: Passkey contains newlines or extra characters

**Solution:**
- Copy the passkey directly from M-Pesa portal (don't add line breaks)
- Ensure no trailing spaces
- Use single quotes to preserve the exact value

## Testing the Configuration

Once configured, test with:

```bash
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254723505347",
    "amount": 100.00,
    "accountReference": "324235431"
  }'
```

**Expected behavior:**
- ✅ If passkey is correct: STK Push request sent to M-Pesa
- ❌ If passkey is wrong: "Authentication failed" or "Invalid password" error

## Security Notes

- **Never commit `.env` files** to version control
- **Use different passkeys** for sandbox and production
- **Rotate passkeys** if compromised (contact Safaricom support)
- **Store production passkeys** securely (use secrets management for production)

## Summary

1. ✅ **Security Credential = Passkey** (you're correct!)
2. ✅ **Always quote the passkey** in `.env` file
3. ✅ **Special characters (`+`, `/`, `=`) are fine** when quoted
4. ✅ **Restart API** after updating `.env`
5. ✅ **Test with STK Push** to verify it works


