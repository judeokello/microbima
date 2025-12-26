# M-Pesa Passkey vs Security Credential

## Important Distinction

There are **TWO different credentials** in the M-Pesa portal:

1. **Security Credential** (RSA-encrypted, ~344 characters)
   - Used for: B2C, B2B, Account Balance, Transaction Status
   - Format: Long Base64-encoded RSA-encrypted string
   - **NOT used for STK Push**

2. **Passkey** (Simple string, ~64 characters)
   - Used for: STK Push (Lipa na M-Pesa Online)
   - Format: 64-character hex string or shorter Base64 string
   - **This is what we need for STK Push**

## For Sandbox Testing

The well-known sandbox test passkey is:
```
bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

This is **64 characters** (hex string).

## Where to Find STK Push Passkey

### Option 1: M-Pesa Portal
1. Go to https://developer.safaricom.co.ke/
2. Log in → "My Apps" → Select your sandbox app
3. Look for **"Test Credentials"** section
4. Find **"Passkey"** or **"Lipa na M-Pesa Online Passkey"** (NOT Security Credential)
5. If you only see "Security Credential", that's the wrong one

### Option 2: Use Well-Known Sandbox Passkey
For sandbox testing, you can use the well-known test passkey:
```
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
```

## How to Verify

1. **Check passkey length**:
   - STK Push passkey: ~64 characters (hex) or ~88 characters (Base64)
   - Security Credential: ~344 characters (RSA-encrypted Base64)

2. **Check format**:
   - STK Push passkey: Simple hex or Base64 string
   - Security Credential: Long Base64 string with many `=` padding

3. **Test with sandbox passkey**:
   ```bash
   MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
   ```

## If You Only Have Security Credential

If the M-Pesa portal only shows "Security Credential" (344 chars), you have two options:

1. **Contact M-Pesa Support**: Ask for the STK Push passkey specifically
2. **Use Sandbox Test Passkey**: For testing, use the well-known sandbox passkey above

## Production

For production, Safaricom will provide:
- Consumer Key
- Consumer Secret
- Business Short Code
- **Passkey** (for STK Push) - separate from Security Credential
- Security Credential (for other APIs)

## Summary

- ❌ **Security Credential (344 chars)**: NOT for STK Push
- ✅ **Passkey (64 chars)**: For STK Push
- ✅ **Sandbox test passkey**: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`

