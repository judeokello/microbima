# LIPA NA M-PESA ONLINE API (M-PESA Express)

**Sandbox URL:** `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest`  
**Production URL:** `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest`

## Overview

The LIPA NA M-PESA ONLINE API (M-PESA Express) is a Merchant/Business initiated Customer-to-Business (C2B) transaction. Merchants can integrate with the API to initiate payment authorization prompts to M-PESA registered and active customers.

## How It Works

1. The Merchant (Partner) captures API parameters and sends an API request.
2. The API receives, validates, and sends an acknowledgment response.
3. An API Proxy sends a network-initiated push request to the customer's M-PESA-registered phone number.
4. The customer confirms payment by entering their M-PESA PIN.
5. The response is sent back to M-PESA and processed:
   - M-PESA validates the customer's PIN.
   - M-PESA debits the customer's mobile wallet.
   - M-PESA credits the Merchant (Partner) account.
6. After processing, results are sent to the API Management system, which forwards them to the merchant via a specified callback URL.
7. The customer receives an SMS confirmation message for the payment.

## Getting Started

### Prerequisites

- Create a Daraja Account on the Safaricom Developer Portal.
- Create a sandbox app in the portal to obtain API credentials.
- Retrieve Consumer Key & Consumer Secret from the sandbox app on "My Apps."
- Test data is available in the simulator section.
- A passkey for password parameter encryption is available on test data in the sandbox simulator; in production, it will be sent via developer email after go-live.
- For live operations, a live M-PESA pay bill/till number with Business Admin/Manager operators must be created.

### Good to Know

- This API is asynchronous.
- It can be consumed over the internet, a virtual private network, or a Multiprotocol Switch.
- **Get Auth Token:** Developers must first generate an access token for API call authentication. This process is also automated in the simulate request section.

## Environments

| Environment | Description | URL |
|-------------|-------------|-----|
| Sandbox | Testing environment | `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` |
| Production | Live environment for real transactions | `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest` |

## Integration Steps

### M-Pesa Express Payment Flow

**Participants:** Merchant, Payment Gateway, M-pesa Customer

1. Merchant sends "Authentication Request" to Payment Gateway
2. Payment Gateway responds with "Authentication Token" to Merchant
3. Merchant sends "USSD NI request" to Payment Gateway
4. Payment Gateway responds with "ACK Response" to Merchant
5. Payment Gateway sends "USSD Prompt request" to M-pesa Customer
6. M-pesa Customer performs "Enter M-pesa Password"
7. M-pesa Customer sends "M-pesa Password" to Payment Gateway
8. Payment Gateway performs "Process Payment"
9. Payment Gateway sends "C2B Validation Request" to Merchant
10. Merchant performs "Validate Customer Transaction Details"
11. Merchant sends "C2B Validation Response" to Payment Gateway
12. Payment Gateway sends "USSD NI Results" to Merchant
13. Payment Gateway sends "C2B Confirmation results" to Merchant
14. Payment Gateway sends "SMS Notification" to M-pesa Customer
15. Payment Gateway performs "Complete transaction"

### M-Pesa Express Query API Flow

1. Merchant performs "Auth"
2. Merchant sends "Authentication Token Request" to Payment Gateway
3. Payment Gateway performs "Authenticate and Query Transaction"
4. Payment Gateway responds with "Query Status response" to Merchant

### Transaction Status Query Flow (If Confirmation Results Delay)

If Confirmation Results delay, use Transaction Status Query to query the status of transaction.

1. Merchant performs "Auth"
2. Merchant sends "Authentication Token" to Payment Gateway
3. Merchant sends "Transaction Status Request" to Payment Gateway
4. Payment Gateway performs "Authenticate and validate request"
5. Payment Gateway responds with "ACK Response" to Merchant
6. Payment Gateway performs "Query Transaction Status"
7. Payment Gateway responds with "Transaction Status Query results" to Merchant

## Use Cases

1. **Reduction of wrong payments/reversals:** Customers only need to enter their M-PESA PIN to validate transactions, as the pay bill/till number, amount, and account number are pre-set by the merchant and included in the M-PESA push request. This eliminates the need for manual input of these details.
2. **Enhanced and shorter payment journey.**

## Request Body

```json
{
  "BusinessShortCode": 174379,
  "Password": "MTc0Mzc5YmZiMjc5Zj1hYTliZGJjZjE10GU5N2RkNzFhNDY3Y2QyZTBjODkzMDU5YjEwZjc4ZTZiNzJhZGExZWQyYzkxOTIwMjEwNjI4MDkyN",
  "Timestamp": "20210628092408",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": "1",
  "PartyA": "254722000000",
  "PartyB": "174379",
  "PhoneNumber": "254722111111",
  "CallBackURL": "https://mydomain.com/path",
  "AccountReference": "accountref",
  "TransactionDesc": "txndesc"
}
```

## Request Parameter Definition

| Name | Description | Type | Sample Value |
|------|-------------|------|--------------|
| BusinessShortCode | The M-PESA Shortcode assigned to the Business | Numeric | 654321 (5 to 6 digits) |
| Password | Base64 encoded string used for encrypting the request. Format: `base64 encode(Shortcode+Passkey+Timestamp)` | String | `base64.encode(Shortcode+Passkey+Timestamp)` |
| Timestamp | Timestamp of the transaction in the format `YYYYMMDDHHmmss` | Timestamp | `20210628092408` |
| TransactionType | Identifies the transaction type. Use "CustomerPayBillOnline" for PayBill Numbers and "CustomerBuyGoodsOnline" for Till Numbers | String | `CustomerPayBillOnline` or `CustomerBuyGoodsOnline` |
| Amount | The transaction amount | Numeric | `10` |
| PartyA | The phone number sending money. Must be a valid Safaricom M-PESA number in the format `2547XXXXXXXX` | Numeric | `254722000000` |
| PartyB | The organization receiving the funds (credit party) | Numeric | `174379` |
| PhoneNumber | The mobile number to receive the USSD prompt. Can be the same as PartyA. Format: `2547XXXXXXXX` | Numeric | `254722111111` |
| CallBackURL | The URL where the payment gateway will send the result | URL | `https://mydomain.com/path` |
| AccountReference | Alpha-numeric identifier for the transaction, defined by your system. Displayed to the customer in the USSD prompt. Max 12 characters | Alpha-Numeric | `accountref` |
| TransactionDesc | Additional information/comment for the request. Max 13 characters | String | `txndesc` |

**Note:** All fields apart from TransactionDesc are mandatory.

## Response Body

```json
{
  "MerchantRequestID": "2654-4b64-97ff-b827b542881d3130",
  "CheckoutRequestID": "ws_CO_1007202409152617172396192",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

## Response Parameter Definition

| Name | Description | Type | Sample Value |
|------|-------------|------|--------------|
| MerchantRequestID | Global unique identifier for the transaction request returned by the API proxy upon successful request submission | String | `2654-4b64-97ff-b827b542881d3130` |
| CheckoutRequestID | Global unique identifier for the transaction request returned by M-PESA upon successful request submission | String | `ws_CO_1007202409152617171293992` |
| ResponseCode | Numeric status code indicating the status of the transaction submission. `0` means successful submission; any other code indicates an error | Numeric | `0` |
| ResponseDescription | Acknowledgment message from the API that gives the status of the request submission, usually mapping to a specific ResponseCode value | String | `Accept the service request successfully` |
| CustomerMessage | Message intended for the customer, usually confirming the status of the request | String | `Success. Request accepted for processing` |

## Callback Payload

### Sample Unsuccessful Callback Payload

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "f1e2-4b95-a71d-b30d3cdbb7a7942864",
      "CheckoutRequestID": "ws_CO_21072024125243250722943992",
      "ResultCode": 1032,
      "ResultDesc": "Request cancelled by user"
    }
  }
}
```

### Sample Successful Callback Payload

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1.00
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61SV"
          },
          {
            "Name": "TransactionDate",
            "Value": 20191219102115
          },
          {
            "Name": "PhoneNumber",
            "Value": 254708374149
          }
        ]
      }
    }
  }
}
```

## Callback Parameter Definition

| Parameter | Description | Type | Optional | Sample Value |
|-----------|-------------|------|----------|--------------|
| Body | Root key for the entire callback message | JSON Object | No | `{"Body": {}}` |
| stkCallback | First child of the Body, contains the callback details | JSON Object | No | - |
| MerchantRequestID | Global unique identifier for the submitted payment request. Same as in the initial request response | String | No | `7071-4170-a0e4-8345632bad441652435` |
| CheckoutRequestID | Global unique identifier for the processed checkout transaction request. Same as in the initial request response | String | No | `ws_CO_21072024125130652700961992` |
| ResultCode | Numeric status code indicating the transaction processing status. 0 means success, any other code means error or failure | Numeric | No | `0, 1032` |
| ResultDesc | Message describing the status of the request processing. Maps to the ResultCode value | String | No | `The service request is processed successfully. Request cancelled by user` |

## Additional Parameters for Successful Requests

| Parameter Name | Description | Type | Optional | Sample Value |
|----------------|-------------|------|----------|--------------|
| CallbackMetadata | JSON object holding more transaction details. Returned only for successful transactions | JSON Object | Yes | - |
| Item | Array within CallbackMetadata holding additional transaction details as JSON objects. Only for successful transactions | JSON Array | Yes | - |
| Amount | Amount transacted | Decimal | Yes | `10500.00` |
| MpesaReceiptNumber | Unique M-PESA transaction ID for the payment request. Also sent to customer via SMS | String | Yes | `SG722NMVXQ` |
| Balance | Balance of the account for the shortcode used as PartyB | Decimal | Yes | `32009.9` |
| TransactionDate | Timestamp for when the transaction completed, format YYYYMMDDHHmmss | Timestamp | Yes | `20170827163400` |
| PhoneNumber | Number of the customer who made the payment | PhoneNumber | Yes | `254722000000` |

## Results Parameter Definition

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| ConversationID | The unique identifier generated by M-PESA for a request | String | `AG_20180223_0000493344ae97d86f75` |
| OriginatorConversationID | The unique identifier of the request message. This is auto-generated by M-PESA for third-party/Organizations. Its value comes from the response message. It can be used to check the status of the transaction | String | `3213-416199-2` |
| ReferenceData | It is used to carry some reference data that M-PESA need not analyse but need to record into the transaction log | ReferenceData | `n/a` |
| ReferenceItem | It is used to carry some reference data that MM needs not analyse but needs to record in the transaction log | ParameterType | `n/a` |
| ResultCode | It indicates whether M-PESA processes the request successfully or not. The max length is 10 | String | `0` |
| ResultDesc | Its value is a description of the parameter Result Code. The max length is 1024 | String | `The service request is processed successfully.` |
| ResultParameters | It is used to carry specific parameters for reversals API | n/a | `n/a` |
| Key | It indicates a parameter name | String | `DebitPartyName` |
| Value | It indicates a parameter value | String | `600310 - Safaricom333` |
| ResultType | 0: completed 1: waiting for further messages | Integer | `0` |
| TransactionID | It's only for transactions. When the request is a transaction request, M-PESA will generate a unique identifier for the transaction | String | `MBN0000000` |

## Response Codes

| Response Code | Response Description |
|---------------|----------------------|
| 0 | Success |

## Result Codes

| Code | Description | Explanation |
|------|-------------|-------------|
| 0 | The service request is processed successfully | The transaction has been processed successfully on M-PESA |
| 1 | The balance is insufficient for the transaction | The customer does not have enough money in their M-PESA account to complete the transaction |
| 2 | Declined due to limit rule. Declined due to limit rule: greater than the maximum transaction amount | The amount provided is less than the allowed C2B transaction minimum (currently Ksh 1) |
| 3 | Declined due to limit rule: greater than the maximum transaction amount | The amount provided exceeds the allowed C2B transaction maximum |
| 4 | Declined due to limit rule: would exceed daily transfer limit | The transaction would exceed the customer's daily transfer limit (currently Ksh 500,000) |
| 8 | Declined due to limit rule: would exceed the maximum balance | Processing the transaction would exceed the Pay Bill or Till Number account balance limit |
| 17 | Rule limited | Transactions were initiated in succession (within 2 minutes) for the same amount to the same customer. Wait at least 2 minutes between such requests |
| 1019 | Transaction has expired | The transaction was not processed within the allowable time |
| 1025 | An error occurred while sending a push request | The USSD prompt message is too long (over 182 characters). Ensure the account reference value is not too long |
| 1032 | Request cancelled by user | The prompt was canceled by the user |
| 1037 | DS timeout user cannot be reached | The customer's phone could not be reached with the NIPUSH prompt (phone offline, busy, or ongoing session) |
| 2001 | The initiator information is invalid | The customer entered an incorrect M-PESA PIN. Advise the customer to use the correct PIN |
| 2028 | The request is not permitted according to product assignment | Either the TransactionType or PartyB is incorrect. For BuyGoods/Tills: BusinessShortCode: short code used on Go Live, PartyB: Till Number, TransactionType: CustomerBuyGoodsOnline. For Pay Bills: BusinessShortCode: short code used on Go Live, PartyB: Pay Bill, TransactionType: CustomerPayBillOnline |
| 8006 | The security credential is locked | The customer should contact Customer Care (call 100 or 200) for assistance |
| SFC_J_C0003 | The operator does not exist | Either the TransactionType or PartyB is incorrect. For BuyGoods/Tills: BusinessShortCode: short code used on Go Live, PartyB: Till Number, TransactionType: CustomerBuyGoodsOnline. For Pay Bills: BusinessShortCode: short code used on Go Live, PartyB: Pay Bill, TransactionType: CustomerPayBillOnline |

## Error Codes

### Sample Error Response

```json
{
  "requestId": "1c5b-4ba8-815c-ac45c57a3db01495926",
  "errorCode": "400.002.02",
  "errorMessage": "Bad Request - Invalid Business ShortCode"
}
```

### Common Error Codes

| Error Code | Error Message | Mitigation | HTTP Code |
|------------|---------------|------------|-----------|
| 400.002.02 | Bad Request - Invalid XXXX | Ensure the request payload is set as per API documentation | 400 |
| 404.001.03 | Invalid Access Token | Regenerate a new access token and use it before one hour expiry period. Also ensure you're using the correct consumer key and consumer secret attached to the Daraja application | 404 |
| 404.001.01 | Resource not found | Make sure you are calling the correct API endpoint | 404 |
| 405.001 | Method Not Allowed (e.g. GET Method Not Allowed) | Ensure you're passing the request as POST. Any other method will be rejected | 405 |
| 500.001.001 | Merchant does not exist | Ensure you're using the short code used on Go Live as BusinessShortCode parameter value in the request | 500 |
| 500.001.001 | Wrong credentials | This error can be caused by: - The Password parameter provided in the request is either invalid or missing. - The Password given (after proper encoding: base64 encode(Shortcode+Passkey+Timestamp)) does not match the BusinessShortCode. - Either the BusinessShortCode or Timestamp used in encoding the Password does not match the one used in the body of the request | 500 |
| 500.001.001 | Unable to lock subscriber, a transaction is already in process for the current subscriber | There is an ongoing session that conflicts with the PUSH request. Wait at least 1 minute between requests to allow previous sessions to complete | 500 |
| 500.003.02 | System is busy. Please try again in few minutes | Retry the request after a short wait | 500 |
| 500.003.01 | Internal Server Error | Make sure everything on your side is correctly set up as per the documentation and your server is running as expected | 500 |
| 500.003.02 | Error Occurred: Spike Arrest Violation | You are sending multiple requests that violate the API transaction per second limit. Ensure your application/system is not sending excessive requests | 500 |
| 500.003.03 | Quota Violation | You are sending multiple requests that violate the API request limit. Ensure your application/system is not sending excessive requests | 500 |

## Testing

### Option 1: Daraja Simulator

Create a new test app under apps on the main nerve bar, select transaction status product. Once app is successfully created the simulator is automated to pick app credentials (Consumer key and Consumer Secret) and predefined test data, you can hit the simulate button.

**Steps to Test:**
1. Select one of your apps to simulate
2. Use simulator to invoke requests to the API
3. Check response for success or to resolve any errors

### Option 2: Postman

Use the credentials to generate access token using the below endpoint.

**Sandbox URL:** `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest`  
**Production URL:** `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest`

Initiate Transaction status using the above transaction status request body. Download the availed postman collection. Ensure to replace the parameters with actual credentials.

## GO LIVE

Time to launch! Here Dev you need help from the business teams no more Rambo stunts behind the keyboard. Some collaboration will do; a handshake to the business team in the morning it is. Wait! You can act Rambo if you are both the Business and Dev.

We've already tested, and finished development—now attach the integration to a live pay bill/till number. Navigate to the GO LIVE tab and fill in the required fields with live data.

### Requirements

- **Organization short code:** Pay bill number, Store Number for a Till, HO number, or B2C account short code (see FAQs for more insights)
- **Organization name:** The name of your organization. Shorten the organization name on Go Live and remove any symbols or special characters
- **Mpesa Username:** Username of the operator with Business Administrator or Business Manager role assigned on the M-PESA Org portal. Username is case sensitive on Go Live

### Important Notes

- For the creation of an administrator on the M-PESA Org portal, contact the M-PESABusiness@Safaricom.co.ke team
- **Note:** OTP for Go Live is sent to the phone number specified under the user profile on the M-PESA portal. Ensure the linked phone number is a Safaricom line to receive the OTP
- In case of challenges, use our Daraja assistant, raise an incident on self-services, or email APISupport@safaricom.co.ke for further guidance
- Kindly visit our How-To section for more information on M-PESA Org portal access and user creation

Upon successful go live, production endpoints will be sent to developer email and the test sandbox app will be moved to production with production consumer key and secrets.

## Transaction Limits

A registered customer can receive up to Ksh 250,000 per transaction.

- The maximum customer account balance is Ksh 500,000
- The daily transaction value limit is Ksh 500,000
- The minimum transaction amount is Ksh 1

## How to Apply for a Live Pay Bill Number/Till Number or B2C Account

Application email: `M-PESABusiness@Safaricom.co.ke`

## Support

### Chatbot

Developers can get instant responses using the Daraja Chatbot for both development and production support.

### Production Issues & Incident Management

For production support and incident management:
- **Incident Management Page:** Visit the Incident Management page
- **Email:** Reach out to API support at `apisupport@safaricom.co.ke`

## FAQs

**Why am I not receiving callbacks on my CallbackURL?**
- Ensure your CallbackURL is publicly accessible over the internet
- Use a valid IP address or domain name
- Confirm your endpoint is not blocked by firewalls or network restrictions

**What should I do if I encounter an invalid access token error?**
- Check that your access token has not expired (tokens expire hourly)
- Make sure you are using the correct consumer key and consumer secret to generate the token

**Can I use my actual pay bill on the Daraja portal simulator?**
- No. The Daraja simulator only supports sandbox test short codes
- To test with your actual short code, use your application or a REST client like Postman

**Do you have a test environment for M-PESA Express API?**
- Yes. The sandbox environment and test credentials (including test short codes) are available on the Daraja developer portal
- You can test using the Daraja simulator, your application, or any REST client

**What are the transaction limits for M-PESA Express?**
- A registered customer can receive up to Ksh 250,000 per transaction
- The maximum customer account balance is Ksh 500,000
- The daily transaction value limit is Ksh 500,000
- The minimum transaction amount is Ksh 1

**What should I do to resolve the "Invalid API call as no apiproduct match found" error?**
- For production, ensure the Lipa na M-PESA production product is enabled on your Daraja application
- For Sandbox, ensure the M-PESA Express Sandbox product is enabled
- Verify you are calling the correct API endpoint

**Can I reverse an M-PESA Express transaction using the Reversal API?**
- Yes

**Where do I view the transaction history for M-PESA Express transactions?**
- Use the M-PESA Org portal: `https://org.ke.m-pesa.com/` to view all transactions for your business account

**Why am I getting "Bad Request - Invalid BusinessShortCode" error?**
- Possible causes:
  - Wrong request Content-Type. Ensure to specify `Content-Type: application/json` in your request headers
  - Incorrect parameter name
  - Invalid or missing BusinessShortCode value

**Can I use a Till Number for STK Push API?**
- Yes, you can integrate a Till Number with the M-PESA Express/STKpush API
- Ensure the parameters are set as below:
  - `BusinessShortCode`: Short code used on Go Live (HO/store number)
  - `PartyB`: Till Number
  - `TransactionType`: CustomerBuyGoodsOnline

