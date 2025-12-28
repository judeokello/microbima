# M-PESA EXPRESS QUERY API

**Sandbox URL:** `https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query`  
**Production URL:** `https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query`

## Overview

Use this API to check the status of a Lipa Na M-Pesa Online Payment. This API allows merchants to query the status of an M-PESA Express (STK Push) transaction that was previously initiated using the `CheckoutRequestID` received from the STK Push API response.

## How It Works

The Query API is used to check the status of a transaction after an STK Push request has been initiated. You need the `CheckoutRequestID` from the original STK Push API response to query the transaction status. This API is synchronous and returns immediate results, making it useful when callback results from the STK Push API are delayed or not received.

## Integration Steps

### M-Pesa Express Query API Flow

1. Merchant performs "Auth" to obtain an access token
2. Merchant sends "Authentication Token Request" to Payment Gateway
3. Merchant sends "Transaction Query Request" to Payment Gateway with the `CheckoutRequestID`
4. Payment Gateway performs "Authenticate and Query Transaction"
5. Payment Gateway responds with "Query Status response" to Merchant

### When to Use the Query API

The Query API is useful in the following scenarios:

- **Delayed Callbacks:** If the callback results from the STK Push API are delayed or not received
- **Status Verification:** To verify the current status of a transaction before processing the merchants app logic
- **Reconciliation:** To reconcile transactions and ensure all payments are accounted for
- **Error Recovery:** To check transaction status after a network error or timeout

## Use Cases

1. **Transaction Status Verification:** Merchants can verify the status of a payment request when callbacks are delayed or not received.
2. **Reconciliation:** Helps merchants reconcile transactions and ensure all payments are properly recorded.
3. **Error Handling:** Allows merchants to check transaction status after network errors or timeouts.
4. **Customer Support:** Enables customer support teams to verify transaction status when customers report payment issues.

## Environments

| Environment | Description | URL |
|-------------|-------------|-----|
| Sandbox | Testing environment | `https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query` |
| Production | Live environment for real transactions | `https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query` |

## Request Body

```json
{
  "BusinessShortCode":"174379",
  "Password": "MTc0Mzc5YmZiMjc5TliZGJjZjE10GU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMTYwMjE2MTY1",
  "Timestamp":"20160216165627",
  "CheckoutRequestID": "ws_CO_260520211133524545"
}
```

## Request Parameter Definition

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| BusinessShortCode | The organization's shortcode (Paybill or Buygoods - a 5 to 7-digit account number) used to identify an organization and receive the transaction | Numeric | Shortcode (5 to 7 digits) e.g. 654321 |
| Password | The password used for encrypting the request sent: a base64 encoded string. (The base64 string is a combination of Shortcode+Passkey+Timestamp) | String | `base64.encode(Shortcode+Passkey+Timestamp)` |
| Timestamp | The Timestamp of the transaction, normally in the format of YEAR+MONTH+DATE+HOUR+MINUTE+SECOND (YYYYMMDDHHMMSS). Each part should be at least two digits, apart from the year which takes four digits | Timestamp | `YYYYMMDDHHmmss` |
| CheckoutRequestID | A global unique identifier of the processed checkout transaction request | String | `ws_CO_DMZ_123212312_2342347678234` |

## Response Body

```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID":"22205-34066-1",
  "CheckoutRequestID": "ws_CO_13012021093521236557",
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully."
}
```

## Response Parameter Definition

| Name | Description | Type | Sample Value |
|------|-------------|------|--------------|
| MerchantRequestID | A global unique Identifier for any submitted payment request | String | `16813-1590513-1` |
| CheckoutRequestID | A global unique identifier of the processed checkout transaction request | String | `ws_CO_DMZ_123212312_2342347678234` |
| ResponseCode | A numeric status code that indicates the status of the transaction submission. 0 means successful submission and any other code means an error occurred | Numeric | `0` |
| ResultDesc | Result description is a message from the API that gives the status of the request processing, usually maps to a specific ResultCode value. It can be a success processing message or an error description message | String | `0: The service request is processed successfully. 1032: Request canceled by the user` |
| ResponseDescription | Response description is an acknowledgment message from the API that gives the status of the request submission usually maps to a specific ResponseCode value. It can be a "Success" submission message or an error description | String | `The service request has failed. The service request has been accepted successfully` |
| ResultCode | A numeric status code that indicates the status of the transaction processing. 0 means successful processing and any other code means an error occurred or the transaction failed | Numeric | `0, 1032` |

## Error Response Parameter Definition

| Name | Description | Mitigation |
|------|-------------|------------|
| 404.001.04 Invalid Authentication Header | All M-PESA APIs on the Daraja platform are POST except Authorization API which is GET. If you've possibly misplaced the headers you will get the error | All M-PESA API requests on the Daraja platform are POST requests except Authorization API which is GET |
| 400.002.05 Invalid Request Payload | Your request body is not properly drafted | Make sure you are submitting the correct request payload as shown in the sample request body for all the APIs, to avoid typo errors |
| 400.003.01 Invalid Access Token | Might be using a wrong or expired access token | Regenerate a new token and use it before expiry, if you are copy-pasting manually make sure you've pasted the correct access token |
