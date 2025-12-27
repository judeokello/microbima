# M-Pesa Daraja API IPN and STK Push Integration Plan

## Overview

Integrate M-Pesa Daraja API Instant Payment Notification (IPN) as the primary transaction data source and M-Pesa Express (STK Push) for agent-initiated payments. Statement uploads will serve as secondary source for gap filling when records are missing. IPN items will be created immediately when received, and statement uploads will deduplicate against existing IPN records. STK Push requests initiated by agents will be linked to IPN transactions via account reference matching.

## Schema Changes

### 1. Add MpesaPaymentSource Enum

**File**: `apps/api/prisma/schema.prisma`

- Add new enum `MpesaPaymentSource` with values: `IPN`, `STATEMENT`
- Place after existing `MpesaStatementReasonType` enum (around line 401)

### 2. Add MpesaStkPushStatus Enum

**File**: `apps/api/prisma/schema.prisma`

- Add new enum `MpesaStkPushStatus` with values: `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`
- Place after `MpesaPaymentSource` enum

### 3. Create MpesaStkPushRequest Model

**File**: `apps/api/prisma/schema.prisma`

- Create new model `MpesaStkPushRequest`:
  - `id String @id @default(uuid()) @db.Uuid` - Used as MerchantRequestID
  - `checkoutRequestID String? @db.VarChar(100)` - From Daraja STK Push response
  - `phoneNumber String @db.VarChar(20)` - Customer phone number
  - `amount Decimal @db.Decimal(10, 2)` - Transaction amount
  - `accountReference String @db.VarChar(100)` - policy.paymentAcNumber
  - `transactionDesc String? @db.VarChar(500)` - Transaction description
  - `status MpesaStkPushStatus @default(PENDING)` - Request status
  - `resultCode String? @db.VarChar(10)` - From STK Push callback
  - `resultDesc String? @db.VarChar(500)` - From STK Push callback
  - `linkedTransactionId String? @db.VarChar(100)` - TransID from IPN (when received)
  - `initiatedBy String?` - Agent/user ID who initiated
  - `initiatedAt DateTime @default(now())` - When STK Push was initiated
  - `completedAt DateTime?` - When transaction completed
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - Relation: `transaction MpesaPaymentReportItem?` (one-to-one, nullable)
  - Indexes:
    - `@@unique([checkoutRequestID])` - Unique checkout request ID
    - `@@index([accountReference])` - For matching with IPN BillRefNumber
    - `@@index([status, createdAt])` - For querying pending requests
    - `@@index([phoneNumber])` - For matching
  - `@@map("mpesa_stk_push_requests")`

### 4. Update MpesaPaymentReportItem Model

**File**: `apps/api/prisma/schema.prisma` (lines 826-855)

- Make `mpesaPaymentReportUploadId` nullable (change `String` to `String?`)
- Update relation to be optional: `MpesaPaymentReportUpload?`
- Add new fields:
  - `msisdn String? @db.VarChar(20)` - Customer phone number
  - `firstName String? @db.VarChar(100)` - Customer first name
  - `middleName String? @db.VarChar(100)` - Customer middle name
  - `lastName String? @db.VarChar(100)` - Customer last name
  - `source MpesaPaymentSource @default(IPN)` - Data source (IPN or STATEMENT)
  - `businessShortCode String? @db.VarChar(20)` - Business short code from IPN
  - `mpesaStkPushRequestId String? @db.Uuid` - FK to STK Push request (nullable)
- Add relation: `mpesaStkPushRequest MpesaStkPushRequest? @relation(fields: [mpesaStkPushRequestId], references: [id])`
- Update indexes:
  - Keep existing `idx_transaction_reference`
  - Add composite index: `@@index([transactionReference, source], name: "idx_transaction_reference_source")`
  - Add source index: `@@index([source], name: "idx_source")`
  - Add account number index: `@@index([accountNumber], name: "idx_account_number")` - For matching with STK Push requests
  - Keep existing `idx_mpesa_payment_report_upload_id`

### 5. Create Migration

- Run `npx prisma migrate dev --name add_mpesa_ipn_and_stk_push`
- Migration will:
  - Create `MpesaPaymentSource` enum
  - Create `MpesaStkPushStatus` enum
  - Create `mpesa_stk_push_requests` table
  - Alter `mpesa_payment_report_items` table to make `mpesaPaymentReportUploadId` nullable
  - Add new columns (msisdn, firstName, middleName, lastName, source, businessShortCode, mpesaStkPushRequestId)
  - Add new indexes
  - Update foreign key constraints

## STK Push Service Implementation

### 6. Create MpesaStkPushService

**File**: `apps/api/src/services/mpesa-stk-push.service.ts`

- Initiate STK Push request:
  - Accept: phoneNumber, amount, accountReference (policy.paymentAcNumber), transactionDesc, initiatedBy
  - Create `MpesaStkPushRequest` record with status `PENDING`
  - Use `MpesaStkPushRequest.id` as `MerchantRequestID` when calling Daraja API
  - Call Daraja STK Push API (`/stkpush/v1/processrequest`)
  - Store `CheckoutRequestID` from response in `MpesaStkPushRequest.checkoutRequestID`
  - Return STK Push request details
- Handle STK Push callback:
  - Parse callback payload (CheckoutRequestID, ResultCode, ResultDesc)
  - Find `MpesaStkPushRequest` by `checkoutRequestID`
  - Update status: `COMPLETED` if ResultCode = 0, `FAILED` otherwise
  - Store `resultCode` and `resultDesc`
  - Set `completedAt` timestamp
- Link IPN to STK Push request:
  - Match using: `accountReference` (BillRefNumber) + phone number + amount + time window (24 hours)
  - Update `MpesaPaymentReportItem.mpesaStkPushRequestId`
  - Update `MpesaStkPushRequest.linkedTransactionId` with TransID from IPN

### 7. Daraja STK Push API Integration

**File**: `apps/api/src/services/mpesa-stk-push.service.ts`

- Implement Daraja API authentication (OAuth token)
- Build STK Push request payload:
  - BusinessShortCode (from config)
  - Password (Base64 encoded)
  - Timestamp (format: YYYYMMDDHHmmss)
  - TransactionType: "CustomerPayBillOnline"
  - Amount
  - PartyA: phoneNumber
  - PartyB: BusinessShortCode
  - PhoneNumber: phoneNumber
  - CallBackURL: STK Push callback endpoint URL
  - AccountReference: accountReference (policy.paymentAcNumber)
  - TransactionDesc: transactionDesc
  - MerchantRequestID: MpesaStkPushRequest.id
- Handle API responses and errors
- Store API credentials in configuration service

## STK Push Controller

### 8. Create MpesaStkPushController

**File**: `apps/api/src/controllers/internal/mpesa-stk-push.controller.ts`

- Internal endpoint (requires authentication):
  - `POST /api/internal/mpesa/stk-push/initiate`
  - Accept: phoneNumber, amount, accountReference, transactionDesc
  - Call `MpesaStkPushService.initiateStkPush()`
  - Return STK Push request details with checkoutRequestID
- STK Push callback endpoint (public, no auth):
  - `POST /api/public/mpesa/stk-push/callback`
  - Accept callback payload from Daraja API
  - Call `MpesaStkPushService.handleStkPushCallback()`
  - Return M-Pesa expected response format: `{ ResultCode: 0, ResultDesc: "Accepted" }`
- Add Swagger documentation
- Mark callback endpoint as public (no `@ApiSecurity` decorator)

### 9. Update Middleware to Exclude STK Push Callback

**File**: `apps/api/src/middleware/api-key-auth.middleware.ts` (around line 34)

- Add STK Push callback endpoint to skip list:
  - `/api/public/mpesa/stk-push/callback`
  - `/public/mpesa/stk-push/callback`
- This allows M-Pesa to call the endpoint without API key authentication

## IPN Service Implementation

### 10. Create MpesaIpnService

**File**: `apps/api/src/services/mpesa-ipn.service.ts`

- Parse IPN payload from Daraja API
- Map `TransactionType` to `MpesaStatementReasonType` enum
- Parse `TransTime` (format: YYYYMMDDHHmmss) to DateTime
- Determine transaction direction (paidIn vs withdrawn) based on TransactionType
- Extract `BillRefNumber` and store in `accountNumber` field
- Upsert logic:
  - Check if record exists by `transactionReference` and `source = 'IPN'`
  - If exists: Update with any new data (idempotent)
  - If not exists: Create new record with `source = 'IPN'`
- Set `mpesaPaymentReportUploadId = null` for IPN items
- Handle customer name fields (FirstName, MiddleName, LastName)
- Store MSISDN, businessShortCode
- Link to STK Push request:
  - Extract `BillRefNumber` (accountNumber), `MSISDN` (phone), `TransAmount`
  - Query `MpesaStkPushRequest` where:
    - `accountReference = BillRefNumber`
    - `phoneNumber = MSISDN` (normalized)
    - `amount` matches (within tolerance, e.g., ±0.01)
    - `status = PENDING` or `COMPLETED`
    - `createdAt` within last 24 hours
  - If found: Set `MpesaPaymentReportItem.mpesaStkPushRequestId` and update `MpesaStkPushRequest.linkedTransactionId`
- Return proper M-Pesa response format: `{ ResultCode: 0, ResultDesc: "Accepted" }`

### 11. TransactionType to ReasonType Mapping

**File**: `apps/api/src/services/mpesa-ipn.service.ts`

- Create mapping function similar to existing `mapReasonType` in `MpesaPaymentsService`
- Map Daraja TransactionType values to `MpesaStatementReasonType`:
  - "Pay Bill" → `PayBill_STK`
  - "Buy Goods" → `PayBill_STK` (or appropriate)
  - Handle other transaction types as needed
  - Default to `Unmapped` if unknown

## IPN Controller

### 12. Create MpesaIpnController

**File**: `apps/api/src/controllers/public/mpesa-ipn.controller.ts`

- Public endpoint (no authentication required)
- Route: `POST /api/public/mpesa/confirmation`
- Accept IPN payload from M-Pesa Daraja API
- Use `@Body()` decorator to receive JSON payload
- Call `MpesaIpnService.processIpnNotification()`
- Return M-Pesa expected response format:
  ```json
  {
    "ResultCode": 0,
    "ResultDesc": "Accepted"
  }
  ```
- Handle errors and return appropriate ResultCode/ResultDesc
- Add Swagger documentation with `@ApiTags('M-Pesa IPN')`
- Mark as public endpoint (no `@ApiSecurity` decorator)

### 13. Update Middleware to Exclude IPN Endpoint

**File**: `apps/api/src/middleware/api-key-auth.middleware.ts` (around line 34)

- Add IPN endpoint to skip list:
  - `/api/public/mpesa/confirmation`
  - `/public/mpesa/confirmation`
- This allows M-Pesa to call the endpoint without API key authentication

### 14. Register Controllers in AppModule

**File**: `apps/api/src/app.module.ts`

- Import `MpesaIpnController` and `MpesaStkPushController`
- Add to `controllers` array
- Import `MpesaIpnService` and `MpesaStkPushService` and add to `providers` array

## DTOs

### 15. Create MpesaIpnDto

**File**: `apps/api/src/dto/mpesa-ipn/mpesa-ipn.dto.ts`

- Define DTO for incoming IPN payload:
  - `TransactionType: string`
  - `TransID: string` (transactionReference)
  - `TransTime: string` (YYYYMMDDHHmmss format)
  - `TransAmount: string` (decimal as string)
  - `BusinessShortCode: string`
  - `BillRefNumber?: string` (accountNumber/paymentAcNumber)
  - `InvoiceNumber?: string` (linkedTransactionId)
  - `OrgAccountBalance: string` (decimal as string)
  - `ThirdPartyTransID?: string`
  - `MSISDN: string` (phone number)
  - `FirstName?: string`
  - `MiddleName?: string`
  - `LastName?: string`
- Add validation decorators (`@IsString()`, `@IsOptional()`, etc.)
- Add Swagger documentation with `@ApiProperty()`

### 16. Create MpesaIpnResponseDto

**File**: `apps/api/src/dto/mpesa-ipn/mpesa-ipn.dto.ts`

- Response DTO matching M-Pesa expected format:
  - `ResultCode: number` (0 for success, 1+ for errors)
  - `ResultDesc: string` (description message)

### 17. Create STK Push DTOs

**File**: `apps/api/src/dto/mpesa-stk-push/mpesa-stk-push.dto.ts`

- `InitiateStkPushDto`:
  - `phoneNumber: string` - Customer phone number
  - `amount: number` - Transaction amount
  - `accountReference: string` - policy.paymentAcNumber
  - `transactionDesc?: string` - Transaction description
- `StkPushRequestResponseDto`:
  - `id: string` - STK Push request ID
  - `checkoutRequestID: string` - From Daraja response
  - `merchantRequestID: string` - Same as id
  - `status: string` - Current status
- `StkPushCallbackDto`:
  - `Body: { stkCallback: { CheckoutRequestID, ResultCode, ResultDesc, ... } }`
- `StkPushCallbackResponseDto`:
  - `ResultCode: number`
  - `ResultDesc: string`

## Statement Upload Deduplication

### 18. Update MpesaPaymentsService

**File**: `apps/api/src/services/mpesa-payments.service.ts`

- Modify `uploadAndParseStatement()` method
- Before creating items, check for existing IPN records:
  - For each transaction in statement:
    - Query: `findFirst({ where: { transactionReference, source: 'IPN' } })`
    - If IPN record exists:
      - Log match (don't create statement record)
      - Increment `matchedIpnRecords` counter
    - If IPN record doesn't exist:
      - Create new record with `source = 'STATEMENT'`
      - Set `mpesaPaymentReportUploadId` to upload ID
      - Increment `gapsFilled` counter
- Return upload statistics:
  - `totalStatementItems: number`
  - `matchedIpnRecords: number`
  - `gapsFilled: number`

### 19. Update Statement Item Creation

**File**: `apps/api/src/services/mpesa-payments.service.ts` (around line 507-522)

- When creating statement items, set `source = 'STATEMENT'`
- Ensure `mpesaPaymentReportUploadId` is populated (not null)
- Add deduplication check before `create()` operation

## Error Handling

### 20. IPN Error Handling

**File**: `apps/api/src/services/mpesa-ipn.service.ts`

- Handle invalid IPN payloads
- Validate required fields (TransID, TransTime, TransAmount, etc.)
- Handle date parsing errors (TransTime format)
- Handle decimal parsing errors (TransAmount, OrgAccountBalance)
- Log errors with correlation ID
- Return appropriate ResultCode/ResultDesc to M-Pesa
- Use existing `ValidationException` for validation errors
- Use existing error codes from `ErrorCodes` enum

### 21. STK Push Error Handling

**File**: `apps/api/src/services/mpesa-stk-push.service.ts`

- Handle Daraja API errors (network, authentication, invalid responses)
- Handle STK Push callback errors
- Validate phone number format
- Validate amount (minimum, maximum)
- Log errors with correlation ID
- Update STK Push request status to `FAILED` on errors
- Return appropriate error responses

### 22. Statement Deduplication Error Handling

**File**: `apps/api/src/services/mpesa-payments.service.ts`

- Handle database errors during deduplication queries
- Log errors but continue processing other items
- Track failed items for reporting

## Reporting and Logging

### 23. Upload Response Enhancement

**File**: `apps/api/src/dto/mpesa-payments/mpesa-payment.dto.ts`

- Update `MpesaPaymentUploadResponseDto` to include:
  - `matchedIpnRecords: number`
  - `gapsFilled: number`
- Update service to return these statistics

### 24. Logging Matches

**File**: `apps/api/src/services/mpesa-payments.service.ts`

- Log when statement items match existing IPN records
- Include transactionReference, upload ID, correlation ID in logs
- Use structured logging format

## Configuration

### 25. Add M-Pesa Daraja Configuration

**File**: `apps/api/src/config/configuration.service.ts`

- Add M-Pesa Daraja API configuration:
  - `mpesa.consumerKey: string`
  - `mpesa.consumerSecret: string`
  - `mpesa.businessShortCode: string`
  - `mpesa.passkey: string`
  - `mpesa.environment: 'sandbox' | 'production'`
  - `mpesa.stkPushCallbackUrl: string`
  - `mpesa.ipnConfirmationUrl: string`
- Load from environment variables
- Document required environment variables

## Testing Considerations

### 26. IPN Endpoint Testing

- Test with M-Pesa sandbox IPN payloads
- Test duplicate IPN notifications (idempotency)
- Test invalid payloads
- Test missing required fields
- Test linking IPN to STK Push requests
- Verify response format matches M-Pesa expectations

### 27. STK Push Testing

- Test STK Push initiation with valid/invalid data
- Test STK Push callback handling
- Test linking STK Push requests to IPN transactions
- Test account reference matching logic
- Test with M-Pesa sandbox environment

### 28. Statement Deduplication Testing

- Test statement upload with all items matching IPN records
- Test statement upload with no matching IPN records (all gaps)
- Test statement upload with mixed matches and gaps
- Verify statistics are accurate
- Test with large statement files

## Documentation

### 29. Update Swagger Documentation

- Document IPN endpoint in Swagger
- Document STK Push endpoints in Swagger
- Add example IPN payloads
- Add example STK Push request/response payloads
- Document response formats
- Mark public endpoints (no auth required)

### 30. Environment Configuration Documentation

- Document required M-Pesa Daraja API credentials
- Document callback URL registration in M-Pesa Daraja portal
- Note: IPN and STK Push callback endpoints should be publicly accessible
- Document environment variables needed

## Implementation Order

1. Schema changes (steps 1-5)
2. Configuration (step 25)
3. STK Push DTOs (step 17)
4. STK Push Service (steps 6-7)
5. STK Push Controller (step 8)
6. IPN DTOs (steps 15-16)
7. IPN Service (steps 10-11)
8. IPN Controller (step 12)
9. Middleware updates (steps 9, 13)
10. AppModule registration (step 14)
11. Statement deduplication (steps 18-19)
12. Error handling (steps 20-22)
13. Reporting/logging (steps 23-24)
14. Testing (steps 26-28)
15. Documentation (steps 29-30)

## Future Enhancements (Deferred)

- **Reconciliation mechanism for delayed IPN**: Scheduled job to check pending STK Push requests and query Daraja Transaction Status API. This will be implemented in a future feature to handle cases where IPN callbacks are delayed or missing.


