# M-PESA RATIBA API (Standing Order)

**Sandbox URL:** `https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`  
**Production URL:** `https://api.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`

## Overview

The Standing Order APIs enable teams to integrate with the standing order solution by initiating a request to create a standing order on the customer profile. This is an API that allows third party integrators to facilitate creation of M-Pesa standing order on their digital channels.

## Audience

This API is intended for businesses who wish to integrate with standing orders for the automation of recurring revenue collection.

## Important Note

**NB:** To consume this API, you will need to go through the documentation below, create a sandbox app with M-pesa Ratiba product and test using our simulator. Upon successful testing, email us at `apisupport@safaricom.co.ke` for Go Live as this is a commercial API. Our team will reach out for commercial discussion and contract signing and thereafter avail the API to your pay bill or till number.

## Getting Started

### Prerequisites

1. Knowledge of RESTful principles and JSON.
2. Understanding Asynchronous processing and callback handling.
3. Set up an App on Daraja to be used for testing on the simulator. Ensure to select "M-Pesa Ratiba" when creating the app.

### Description of M-PESA Ratiba API

M-PESA Ratiba API is an extension of the Safaricom Standing order functionality that will allow third party integrators to avail this functionality to their users. (STK Push/NI push) is a Merchant/Business initiated prompt, that will allow M-Pesa user to enter their pin for authentication and user validation purposes. Once you, our merchant integrate with the API, you will be able to send a pin prompt on the customer's phone (Popularly known as STK Push Prompt) to your customer's M-PESA registered phone number requesting them to enter their M-PESA pin to authorize, and continue with the rest of the journey involving opt in and creating a standing order.

### High Level User Flow

1. A user will probably interact with the integrated API through the merchant's digital channel, could be a web interface or an app interface. The user will enter the standing order details, including the name, amount, start date, end date, etc. - (As per the merchant's configurations on the digital channel.)

2. The merchant channel, through the API will send the data to our systems. Here we will run the authentication checks through our gateway. Once authenticated, we will initiate an NI push to the M-Pesa user. The user will enter their pin. This will be consent to proceed with all operations coming after and also validate ownership of the MSISDN.

3. We will run a check to see if the user is opted in, if not, we will opt the user in. If the user is opted in, we will proceed with the request to create a standing order.

4. We will then send a callback to the merchant, with the status of the process, the transaction code and the unique response id.

## Environments

| Environment | Description | URL |
|-------------|-------------|-----|
| Sandbox | Testing environment | `https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal` |
| Production | Live environment for real transactions | `https://api.safaricom.co.ke/standingorder/v1/createStandingOrderExternal` |

## Request Description

1. **URL:** `https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`
2. **Method:** POST
3. **Parameters:** StandingOrderName, StartDate, EndDate, BusinessShortCode, TransactionType, Amount, PartyA, PartyB, PhoneNumber, CallBackURL, TransactionDesc, Frequency

**Note:** You will first generate an access token to allow you to make the API call. See how to generate an access token here [Authorization API link](../authorization.txt). We've also automated this on the simulate request section.

## Request Body

```json
{
  "StandingOrderName": "Test Standing Order",
  "StartDate": "20240905",
  "EndDate": "20250905",
  "BusinessShortCode": "174379",
  "TransactionType": "Standing Order Customer Pay Bill",
  "ReceiverPartyIdentifierType": "4",
  "Amount": "4500",
  "PartyA": "254708374149",
  "CallBackURL": "https://mydomain.com/pat",
  "AccountReference": "Test",
  "TransactionDesc": "Test",
  "Frequency": "2"
}
```

## Request Parameter Definition

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| StandingOrderName | Name of standing order. Must be unique per customer. | String | "Phone Lipa Mdogo Mdogo" |
| StartDate | The date for the standing order to start executing. | Date(yyyymmdd) | "20240905" |
| EndDate | The date for the standing order to stop executing. | Date(yyyymmdd) | "20250905" |
| BusinessShortCode | The business short code to which the payment is to be sent. | String | "1112223" |
| TransactionType | Identifies the transaction type for M-PESA. Use "Standing Order Customer Pay Bill" for paybill or "Standing Order Customer Pay Marchant" for buy goods. | String | "Standing Order Customer Pay Bill" |
| Amount | Numeric value of the amount to be transacted. Only whole numbers are supported. Deducted from user's M-PESA balance. | String | "100" |
| PartyA | The phone number sending money, expected in the format 2547XXXXXXXX for a Valid Safaricom Mobile Number registered with M-PESA. | String | "254712345678" |
| CallBackURL | A valid secure URL to receive notifications from the Standing Order Solution. | String URL | "https://mydomain.com/callback" |
| AccountReference | An identifier for the transaction, typically an account number for paybill payments. Maximum 12 characters. | Alpha numeric | "Test" |
| TransactionDesc | Additional information or comment for the request. Maximum 13 characters. | String | "Electric Bike Repayment" |
| Frequency | Represents how often transactions should occur. Valid values are: 1 - One Off, 2 - Daily, 3 - Weekly, 4 - Monthly, 5 - Bi-Monthly, 6 - Quarterly, 7 - Half Year, 8 - Yearly. | String | "2" |
| ReceiverPartyIdentifierType | Code to identify the short code in the request body. "2" for a Merchant till (Till Number), and "4" for a Business Short Code (PayBill). | String | "4" |

## Response Body

### Successful Response

```json
{
  "ResponseHeader": {
    "responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000",
    "responseCode": "200",
    "responseDescription": "Request accepted for processing,",
    "ResultDesc": "The service request is processed successfully."
  },
  "ResponseBody": {
    "responseDescription": "Request accepted for processing,",
    "responseCode": "200"
  }
}
```

## Response Parameter Definition

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| ResponseHeader | Contains MetaData of the response data. | JSON Object | `{"responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000", "requestRefID": "c8c2bb31-3b3a-402e-84fc-21ef35161e48", "responseDescription": "Request Processed successfully."}` |
| responseRefID | A unique value per request in the response header, used for tracking requests and responses. | String | "4dd9b5d9-d738-42ba-9326-2cc99e966000" |
| responseCode | HTTP response code. "200" for success, "401" for unauthorized, "500" for system failure. | String | "200" |
| ResultDesc | A message in the response header describing the status, progress, error, success, or failure of the request. | String | "The service request is processed successfully." |
| ResponseBody | Encapsulates response body metadata. | JSON Object | `{"responseDescription": "Request accepted for processing.", "responseCode": "200"}` |
| responseDescription | A descriptive message for the Async request, corresponding to the result code. | String | "Request accepted for processing" |

## Callback Responses

### Successful Callback Response

```json
{
  "responseHeader": {
    "responseRefID": "0acc0239-20fa-4a52-8b9d-9bd64c0465c3",
    "requestRefID": "0acc0239-20fa-4a52-8b9d-9bd64c0465c3",
    "responseCode": "0",
    "responseDescription": "The service request is processed successfully"
  },
  "responseBody": {
    "responseData": [
      {
        "name": "TransactionID",
        "value": "SC8F2IQMH5"
      },
      {
        "name": "responseCode",
        "value": "0"
      },
      {
        "name": "Status",
        "value": "OKAY"
      },
      {
        "name": "Msisdn",
        "value": "254******867"
      }
    ]
  }
}
```




### Successful Callback Response Parameters

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| ResponseHeader | Contains MetaData of the response data. | JSON Object | `{"responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000", "requestRefID": "c8c2bb31-3b3a-402e-84fc-21ef35161e48", "responseDescription": "Request Processed successfully"}` |
| responseRefID | Contained in the response header - Is a value, unique per request, used to track and trace a request and a response across the application systems. | String | "4dd9b5d9-d738-42ba-9326-2cc99e966000" |
| requestRefID | Contained in the response header - Is a Client generated value, unique per request, used to track and trace a request and a response across the application systems. | String | "c8c2bb31-3b3a-402e-84fc-21ef35161e48" |
| responseDescription | Contained in the response header - is a message giving a description of the status, progress, error, success or failure of the request. | String | "Request Processed successfully" |
| ResponseBody | Encapsulates response body metadata. | JSON Object | `{"ResponseData": [{"Name": "TransactionID", "Value": "SC8F2IQMH5"}, {"Name": "ResultCode", "Value": "0"}]}` |
| ResponseData | Contains Details of the response body in Key Value pairs. The values are TransactionID and ResultCode. | JSON Object | `[{"Name": "TransactionID", "Value": "SC8F2IQMH5"}, {"Name": "ResultCode", "Value": "0"}]` |

### Unsuccessful Callback Response

```json
{
  "ResponseHeader": {
    "responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000",
    "requestRefID": "c8c2bb31-3b3a-402e-84fc-21ef35161e48",
    "responseCode": "1037",
    "responseDescription": "Error"
  },
  "ResponseBody": {
    "ResponseData": [
      {
        "Name": "TransactionID",
        "Value": "0000000000"
      },
      {
        "Name": "responseCode",
        "Value": "1037"
      },
      {
        "Name": "Status",
        "Value": "ERROR"
      },
      {
        "Name": "Msisdn",
        "Value": "*******149"
      }
    ]
  }
}
```

### Unsuccessful Callback Response Parameters

| Name | Description | Type | Sample Values |
|------|-------------|------|---------------|
| ResponseHeader | Contains MetaData of the response data. | JSON Object | `{"responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000", "requestRefID": "c8c2bb31-3b3a-402e-84fc-21ef35161e48", "responseDescription": "An Error occured while processing your request"}` |
| responseRefID | Contained in the response header - Is a value, unique per request, used to track and trace a request and a response across the application systems. | String | "4dd9b5d9-d738-42ba-9326-2cc99e966000" |
| requestRefID | Contained in the response header - Is a Client generated value, unique per request, used to track and trace a request and a response across the application systems. | String | "c8c2bb31-3b3a-402e-84fc-21ef35161e48" |
| responseDescription | Contained in the response header - is a message giving a description of the status, progress, error, success or failure of the request. | String | "An Error occured while processing your request" |
| ResponseBody | Encapsulates response body metadata. | JSON Object | `{"ResponseData": [{"Name": "TransactionID", "Value": "0000000000"}, {"Name": "ResultCode", "Value": "1037"}]}` |
| ResponseData | Contains Details of the response body in Key Value pairs. The values are TransactionID and ResultCode. | JSON Object | `[{"Name": "TransactionID", "Value": "0000000000"}, {"Name": "ResultCode", "Value": "1037"}]` |

## Error Response Parameter Definition

| Error Code | Possible Cause | Mitigation |
|------------|----------------|------------|
| 1037 | Wr DS timeout user cannot be reached. It means that the STK Push Prompt never got to the user. Causes include:<br>- The user not having an updated SIM Card that has a small sim size and thus needs an update.<br>- The SIM card is too old (3+ years) to have received the STK Update to allow access to this service.<br>- Mobile phone is offline. | If the customer has a functional phone, partner to notify the customer of the prompt before initiating the request. |
| 1025 | An error occurred while sending push request due to system error on the partner platform. | Partner to retry the request, and make sure the system is working as expected. Partner to handle troubleshooting on their internal system. |
| 1037 | This means that the STK Push Prompt got to the customer but the response by the customer was not sent back on time. | Retry again to be able to receive a callback. |
| 1032 | The request was canceled by the user. This means that the STK Push Prompt was canceled from the user's end. This occurs when:<br>- STK Prompt timed out waiting for user input (takes between 1-3 minutes depending on phone model).<br>- The user canceled the request on their phone. | Retry again after 2-3 minutes to receive the callback. Be sure to notify the customer before initiating a request. Make sure to get customer consent. |
| 2001 | The initiator information is invalid.<br>- The user initiating the push has given invalid password input.<br>- The user has entered the wrong pin to validate the STK PUSH request. | Advice customer to key in the correct M-PESA pin. |
| 1001 | Unable to lock subscriber, a transaction is already in process for the current subscriber.<br>- Duplicated MSISDN, MSISDN has an existing USSD session.<br>- Conflicting sessions.<br>- The user has an ongoing USSD Session.<br>- Supplementary services are barred for users. | - Close the session before initiating another push.<br>- User to try again between 2-3 minutes.<br>- Make sure you send one push request to a user at a time.<br>- User to contact Safaricom for unbarring. |
| 1050 | The User already has a standing order with the same name on their profile. | Advice the customer to input a unique name for each standing order. |
| 1051 | Bad request. | One or more fields in the request payload is invalid. |

## Testing

### Option 1: Daraja Simulator

Create a new test app under apps on the main nerve bar, select M-Pesa Ratiba product. Once app is successfully created the simulator is automated to pick app credentials (Consumer key and Consumer Secret) and predefined test data, you can hit the simulate button.

**Steps to Test:**
1. Select one of your apps to simulate
2. Use simulator to invoke requests to the API
3. Check response for success or to resolve any errors

### Option 2: Postman

Use the credentials to generate access token using the Authorization API endpoint.

**Sandbox URL:** `https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`  
**Production URL:** `https://api.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`

Initiate Standing Order creation using the above request body. Download the availed postman collection. Ensure to replace the parameters with actual credentials.

## GO LIVE

To go live with M-Pesa Ratiba API:

1. Complete testing in the sandbox environment
2. Email `apisupport@safaricom.co.ke` for Go Live request
3. Our team will reach out for commercial discussion and contract signing
4. After contract signing, the API will be availed to your pay bill or till number

## Support

### Chatbot

Developers can get instant responses using the Daraja Chatbot for both development and production support.

### Production Issues & Incident Management

For production support and incident management:
- **Incident Management Page:** Visit the Incident Management page
- **Email:** Reach out to API support at `apisupport@safaricom.co.ke`

## FAQs

**What is M-Pesa Ratiba?**
- M-Pesa Ratiba is a standing order functionality that allows businesses to set up recurring payments from customers' M-PESA accounts.

**How do I get started with M-Pesa Ratiba API?**
- Create a sandbox app on Daraja with M-Pesa Ratiba product selected, test using the simulator, then email `apisupport@safaricom.co.ke` for Go Live.

**What are the frequency options for standing orders?**
- Valid frequency values: 1 - One Off, 2 - Daily, 3 - Weekly, 4 - Monthly, 5 - Bi-Monthly, 6 - Quarterly, 7 - Half Year, 8 - Yearly.

**What should I do if I get error code 1050?**
- Error code 1050 means the user already has a standing order with the same name. Advise the customer to input a unique name for each standing order.

**What should I do if I get error code 1037?**
- Error code 1037 indicates the STK Push Prompt never reached the user or timed out. Notify the customer before initiating the request, or retry after ensuring the customer's phone is online and functional.

**Can I use a Till Number for Standing Orders?**
- Yes, set `ReceiverPartyIdentifierType` to "2" for Till Numbers and use "Standing Order Customer Pay Marchant" as the TransactionType.

**What should I do if I get error code 1032?**
- Error code 1032 means the request was canceled by the user or timed out. Retry after 2-3 minutes and ensure to notify the customer before initiating a request.






