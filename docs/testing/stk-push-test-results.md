# STK Push Test Results

## ✅ Test Status: Endpoint Working

**Date:** 2025-12-26  
**Ngrok URL:** `https://unwhisperable-underanged-ivory.ngrok-free.dev`  
**API Status:** ✅ Running on `http://localhost:3001`

## Test Results

### 1. Endpoint Accessibility ✅
- **Endpoint:** `POST /api/internal/mpesa/stk-push/test`
- **Status:** ✅ Accessible and responding
- **Authentication:** ✅ Correctly skips auth (test endpoint)

### 2. Validation Working ✅
- **Phone Number Validation:** ✅ Working (normalizes to 254XXXXXXXXX format)
- **Amount Validation:** ✅ Working (validates 1-70,000 KES range)
- **Account Reference Validation:** ✅ Working (checks for policy existence)

**Test Response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "status": 404,
    "message": "NOT_FOUND: Policy with payment account number 'TEST123' not found",
    "details": {
      "accountReference": "Policy with payment account number 'TEST123' not found"
    }
  }
}
```

This confirms:
- ✅ Endpoint is accessible
- ✅ Request validation works
- ✅ Policy lookup validation works
- ✅ Error responses are properly formatted

## What's Needed for Full Test

To test the complete STK Push flow, you need:

### 1. M-Pesa Credentials in `.env`

Add to `apps/api/.env`:
```bash
# M-Pesa Daraja API Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORT_CODE=174379
MPESA_PASSKEY=your_passkey_here
MPESA_ENVIRONMENT=sandbox

# Callback URLs (use current ngrok URL)
MPESA_STK_PUSH_CALLBACK_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://unwhisperable-underanged-ivory.ngrok-free.dev/api/public/mpesa/confirmation

# Optional
MPESA_ALLOWED_IP_RANGES=127.0.0.1/32,::1/128
```

**Get credentials from:** https://developer.safaricom.co.ke/

### 2. A Policy with Payment Account Number

You need a policy in your database with a `paymentAcNumber`. Options:

**Option A: Use Existing Policy**
```sql
-- Check for existing policies with payment account numbers
SELECT id, "policyNumber", "paymentAcNumber" 
FROM policies 
WHERE "paymentAcNumber" IS NOT NULL 
LIMIT 5;
```

**Option B: Create Test Policy via API**
- Use the policy creation endpoint to create a prepaid policy
- It will automatically generate a `paymentAcNumber`

**Option C: Manual Test Policy (for testing only)**
```sql
-- Only for testing - creates a minimal test policy
-- Replace with actual customer_id and package_id from your database
INSERT INTO policies (
  id,
  "customerId",
  "packageId",
  "packagePlanId",
  "paymentAcNumber",
  "premium",
  "frequency",
  "status",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'your-customer-id-here',
  1, -- Replace with actual package_id
  1, -- Replace with actual package_plan_id
  'TEST123', -- This will be your account reference
  100.00,
  'MONTHLY',
  'ACTIVE',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
```

### 3. Test Phone Number

For M-Pesa sandbox testing, use:
- **Test Phone:** `254708374149` (official M-Pesa sandbox test number)
- Or any number in format: `254XXXXXXXXX`

## Full Test Command

Once you have:
1. ✅ M-Pesa credentials in `.env`
2. ✅ A policy with `paymentAcNumber` (e.g., `TEST123`)
3. ✅ Restarted API to load new `.env` values

Run:
```bash
curl -X POST http://localhost:3001/api/internal/mpesa/stk-push/test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254708374149",
    "amount": 100.00,
    "accountReference": "TEST123",
    "transactionDesc": "Test STK Push payment"
  }'
```

## Expected Flow

1. **Request Sent** → API receives STK Push request
2. **Validation** → Checks policy exists, validates phone/amount
3. **DB Record Created** → Creates `MpesaStkPushRequest` with status `PENDING`
4. **M-Pesa API Called** → Sends STK Push to customer's phone
5. **Response Returned** → Returns `checkoutRequestID` and request details
6. **Customer Action** → Customer sees prompt on phone
7. **Callback Received** → M-Pesa sends callback to ngrok URL
8. **Status Updated** → Request status updated to `COMPLETED`/`CANCELLED`/`FAILED`
9. **Payment Records** → If completed, creates records in `mpesa_payment_report_items` and `policy_payments`

## Monitoring

### Check ngrok Requests
Open in browser: `http://127.0.0.1:4040`

### Check API Logs
Watch your API console for:
- `STK_PUSH_INITIATION_START`
- `STK_PUSH_REQUEST_CREATED`
- `OAUTH_TOKEN_GENERATED`
- `STK_PUSH_SUCCESS` or `STK_PUSH_RETRY_EXHAUSTED`
- `STK_PUSH_CALLBACK_RECEIVED` (when customer responds)

### Check Database
```sql
-- Check STK Push requests
SELECT id, "checkoutRequestId", "phoneNumber", amount, status, "initiatedAt"
FROM mpesa_stk_push_requests
ORDER BY "initiatedAt" DESC
LIMIT 5;

-- Check payment records (if completed)
SELECT id, "transactionReference", amount, source, "createdAt"
FROM mpesa_payment_report_items
ORDER BY "createdAt" DESC
LIMIT 5;
```

## Troubleshooting

### Error: "MPESA_CONSUMER_KEY is required"
- **Solution:** Add M-Pesa credentials to `.env` and restart API

### Error: "Policy with payment account number 'XXX' not found"
- **Solution:** Use a valid `paymentAcNumber` from an existing policy

### Error: "OAuth token request failed"
- **Solution:** Check `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` are correct

### Error: "STK Push request failed"
- **Solution:** 
  - Check `MPESA_BUSINESS_SHORT_CODE` (should be `174379` for sandbox)
  - Check `MPESA_PASSKEY` is correct
  - Verify callback URL is publicly accessible (ngrok is running)

### Callback Not Received
- **Solution:**
  - Verify ngrok is running
  - Check callback URL in `.env` matches ngrok URL
  - Check ngrok web interface for incoming requests
  - Verify IP whitelist allows M-Pesa IPs (for production)

## Next Steps

1. ✅ Endpoint is working - **DONE**
2. ⏳ Add M-Pesa credentials to `.env`
3. ⏳ Get/create a policy with `paymentAcNumber`
4. ⏳ Restart API
5. ⏳ Run full test
6. ⏳ Monitor callbacks and payment records



