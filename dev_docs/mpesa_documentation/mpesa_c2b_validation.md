# C2B Validation URL (Daraja RegisterURL)

**Endpoint (MicroBima):** `POST /api/public/mpayesa/validation`  
**Sandbox RegisterURL:** `POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl`  
**Production RegisterURL:** `POST https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl`

## Purpose

When **external validation** is enabled on a paybill shortcode, Safaricom calls your **ValidationURL** *before* completing a payment. Your server must respond with JSON accepting or rejecting the transaction.

MicroBima uses **passthrough acceptance** on this endpoint:

- Always responds `{ "ResultCode": 0, "ResultDesc": "Accepted" }`
- Does **not** reject unknown `BillRefNumber` values here

**Why:** The same paybill may receive payments for other systems. Rejecting at validation would block those payments entirely.

Account matching and customer messaging happen on the **confirmation** endpoint (`POST /api/public/mpayesa/confirmation`):

- Matched `BillRefNumber` → policy payment processing
- Unmatched → `payment_received_unmatched` SMS (when phone is usable)

## Sandbox vs production

| Environment | ValidationURL on RegisterURL |
|---|---|
| **Sandbox shortcode `174379`** | **Required** (non-empty HTTPS URL). Shared sandbox has external validation enabled. |
| **Production paybill** | Often **optional** if external validation is disabled in the M-Pesa business portal. Only `ConfirmationURL` is needed for IPN. |

`ResponseType: "Completed"` means Safaricom may still complete a payment if validation is slow or unreachable—but RegisterURL still requires a valid URL on sandbox.

## Register URLs (staging example)

Obtain OAuth token, then:

```http
POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "ShortCode": "174379",
  "ResponseType": "Completed",
  "ConfirmationURL": "https://maishapoa-staging-internal-api.fly.dev/api/public/mpayesa/confirmation",
  "ValidationURL": "https://maishapoa-staging-internal-api.fly.dev/api/public/mpayesa/validation"
}
```

Production (when validation disabled in portal):

```json
{
  "ShortCode": "<your_live_shortcode>",
  "ResponseType": "Completed",
  "ConfirmationURL": "https://maishapoa-production-internal-api.fly.dev/api/public/mpayesa/confirmation",
  "ValidationURL": ""
}
```

(Empty `ValidationURL` only works when external validation is off for that shortcode.)

## Request payload (from Safaricom)

Same shape as C2B confirmation / IPN, e.g.:

```json
{
  "TransactionType": "Pay Bill",
  "TransID": "LK12345678",
  "TransTime": "20250127143045",
  "TransAmount": "100.00",
  "BusinessShortCode": "174379",
  "BillRefNumber": "POL123456",
  "MSISDN": "254712345678",
  "FirstName": "John",
  "LastName": "Doe"
}
```

## Response (MicroBima passthrough)

```json
{
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

To reject a payment (not used by MicroBima today):

```json
{
  "ResultCode": "C2B00012",
  "ResultDesc": "Invalid Account Number"
}
```

## Security

- No API key (same as confirmation / STK callback)
- `IpWhitelistGuard`: production enforces Safaricom IP ranges; staging/development allow all IPs
- M-Pesa uses **POST** only—opening the URL in a browser (GET) is not a valid test

## Testing

```bash
curl -X POST "https://maishapoa-staging-internal-api.fly.dev/api/public/mpayesa/validation" \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "Pay Bill",
    "TransID": "TEST-VALIDATION-1",
    "TransTime": "20250127143045",
    "TransAmount": "100.00",
    "BusinessShortCode": "174379",
    "BillRefNumber": "ANY-REF",
    "MSISDN": "254722000000"
  }'
```

Expected: `{"ResultCode":0,"ResultDesc":"Accepted"}`

## Related docs

- [`mpesa_express_stkpush.md`](./mpesa_express_stkpush.md) — STK flow includes C2B validation step (items 9–11)
- [`apps/api/env.example`](../../apps/api/env.example) — callback URL examples (`mpayesa` path)
