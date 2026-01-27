# Fixing "Wrong Credentials" Error for STK Push

## Error Code: 500.001.1001

**Error Message**: "Wrong credentials"

This error occurs when M-Pesa rejects the STK Push request due to incorrect authentication credentials.

## What This Means

✅ **Good News**: 
- OAuth token generation is working
- STK Push request is being sent to M-Pesa
- The request reaches M-Pesa's servers

❌ **Problem**: 
- M-Pesa is rejecting the password/BusinessShortCode/Passkey combination

## Common Causes

### 1. Wrong BusinessShortCode

**For Sandbox**: Must be `174379`

**Check your `.env`**:
```bash
MPESA_BUSINESS_SHORT_CODE=174379
```

**For Production**: Use your production BusinessShortCode (provided by Safaricom)

### 2. Wrong Passkey (Security Credential)

The Passkey is the **"Security Credential"** from the M-Pesa portal, NOT the Consumer Secret.

**Where to find it**:
1. Go to https://developer.safaricom.co.ke/
2. Log in → "My Apps" → Select your sandbox app
3. Look for **"Test Credentials"** or **"Security Credential"** section
4. Click **"Generate"** to create a security credential
5. Copy the generated value - **this is your passkey**

**Important**: The Security Credential is different from:
- Consumer Key ❌
- Consumer Secret ❌
- Passkey ✅ (this is the Security Credential)

### 3. Passkey Not Properly Quoted in .env

If your passkey contains special characters (`+`, `/`, `=`), it must be quoted:

```bash
# ✅ CORRECT - With quotes
MPESA_PASSKEY='bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'

# ✅ CORRECT - With double quotes
MPESA_PASSKEY="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"

# ❌ WRONG - No quotes (special characters may be misinterpreted)
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

### 4. Password Generation

The password is generated as: `Base64(BusinessShortCode + Passkey + Timestamp)`

**Example**:
- BusinessShortCode: `174379`
- Passkey: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
- Timestamp: `20251226151413` (YYYYMMDDHHmmss format, UTC)
- Password String: `174379bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c91920251226151413`
- Password (Base64): `MTc0Mzc5YmZiMjc5ZjlhYTliZGJjZjE1OGU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjUxMjI2MTUxNDEz`

## Verification Steps

### 1. Check Your .env File

```bash
# In apps/api/.env
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY='your_security_credential_here'  # Must be quoted if special chars
```

### 2. Verify Passkey is Correct

The passkey should be:
- Generated from M-Pesa portal (Test Credentials section)
- A long string (usually 64+ characters)
- May contain special characters (`+`, `/`, `=`)

### 3. Restart API After Changes

After updating `.env`, **always restart your API**:
```bash
# Stop API (Ctrl+C)
# Then restart
pnpm dev:api
```

### 4. Check Debug Logs

After restarting, test again and check logs for:
```
STK_PUSH_PASSWORD_GENERATED
```

This will show:
- BusinessShortCode being used
- Passkey length (to verify it's not empty)
- Timestamp format
- Password length

## Testing

1. **Verify OAuth works**:
   ```bash
   ./scripts/test-mpesa-oauth-simple.sh
   ```
   Should return 200 OK with access token.

2. **Test STK Push**:
   ```bash
   ./scripts/test-stk-push.sh
   ```

3. **Check logs** for `STK_PUSH_PASSWORD_GENERATED` to verify password generation.

## Still Not Working?

If you've verified:
- ✅ BusinessShortCode = `174379` (sandbox)
- ✅ Passkey is the Security Credential from M-Pesa portal
- ✅ Passkey is properly quoted in `.env`
- ✅ API was restarted after changes

Then:
1. **Regenerate Security Credential** in M-Pesa portal
2. **Update `.env`** with new Security Credential
3. **Restart API**
4. **Test again**

## M-Pesa Portal Links

- **Sandbox Apps**: https://developer.safaricom.co.ke/MyApps
- **Test Credentials**: Look for "Test Credentials" or "Security Credential" section in your app








