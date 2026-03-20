# M-PESA RATIBA (STANDING ORDER API) — FULL SPEC (SOURCE-ALIGNED)

## Endpoint

POST https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal

---

## Overview

This API allows third-party integrators to facilitate the creation of M-PESA standing orders on their digital channels.

---

## Audience

This API is intended for businesses who wish to integrate with standing orders for the automation of recurring revenue collection.

---

## Prerequisites

- Knowledge of RESTful APIs and JSON  
- Understanding of asynchronous processing and callback handling  
- Access to Daraja platform with M-Pesa Ratiba enabled  

---

## High-Level Flow

1. User enters standing order details
2. Merchant sends request to API
3. API authenticates request
4. System initiates STK Push
5. User enters PIN
6. System validates and creates standing order
7. Callback is sent to merchant

---

## Request Body

```json
{
  "StandingOrderName": "Test Standing Order",
  "StartDate": "20240905",
  "EndDate": "20230905",
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

---

## Request Parameters

| Name | Description | Type | Sample |
|------|-------------|------|--------|
| StandingOrderName | Unique name per customer | String | Phone Lipa Mdogo Mdogo |
| StartDate | Start date | Date | 20240905 |
| EndDate | End date | Date | 20250905 |
| BusinessShortCode | Paybill/Till | String | 1112223 |
| TransactionType | Pay Bill or Merchant | String | Standing Order Customer Pay Bill |
| Amount | Whole numbers only | String | 100 |
| PartyA | MSISDN format | String | 254712345678 |
| CallBackURL | Callback endpoint | URL | https://mydomain.com/callback |
| AccountReference | Max 12 chars | String | Test |
| TransactionDesc | Max 13 chars | String | Electric Bike Repayment |
| Frequency | Recurrence value | String | 2 |
| ReceiverPartyIdentifierType | 2=Till, 4=Paybill | String | 4 |

---

## Immediate Response

```json
{
  "ResponseHeader": {
    "responseRefID": "4dd9b5d9-d738-42ba-9326-2cc99e966000",
    "responseCode": "200",
    "responseDescription": "Request accepted for processing",
    "ResultDesc": "The service request is processed successfully."
  },
  "ResponseBody": {
    "responseDescription": "Request accepted for processing",
    "responseCode": "200"
  }
}
```

---

## Callback - Success

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
      { "name": "TransactionID", "value": "SC8F2IQMH5" },
      { "name": "responseCode", "value": "0" },
      { "name": "Status", "value": "OKAY" },
      { "name": "Msisdn", "value": "2547******867" }
    ]
  }
}
```

---

## Callback - Failure

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
      { "Name": "TransactionID", "Value": "0000000000" },
      { "Name": "responseCode", "Value": "1037" },
      { "Name": "Status", "Value": "ERROR" },
      { "Name": "Msisdn", "Value": "*********149" }
    ]
  }
}
```

---

## Notes

- API is asynchronous  
- Callback URL must be publicly accessible  
- Customer PIN authentication required  
- Supports recurring frequencies  
