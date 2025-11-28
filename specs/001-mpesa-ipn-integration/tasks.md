# Implementation Tasks: M-Pesa Daraja IPN and STK Push Integration

**Feature**: M-Pesa Daraja IPN and STK Push Integration  
**Branch**: `001-mpesa-ipn-integration`  
**Created**: 2025-01-27  
**Status**: Ready for Implementation

## Overview

This document breaks down the implementation into actionable, dependency-ordered tasks organized by user story priority. Each user story is independently testable and can be delivered incrementally.

**User Stories**:
- **US1** (P1): Real-time Payment Notifications - IPN processing
- **US2** (P2): Agent-Initiated Payment Requests - STK Push
- **US3** (P3): Statement Upload Gap Filling - Deduplication

**MVP Scope**: User Story 1 (US1) - IPN processing provides the foundation for real-time payment tracking.

## Dependencies

### Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (Polish)
```

**Story Dependencies**:
- **US1** (P1): Can be implemented independently - foundation for all payment processing
- **US2** (P2): Depends on US1 (needs IPN processing to link STK Push requests)
- **US3** (P3): Depends on US1 (needs IPN records for deduplication)

### External Dependencies

**Blocking for Production** (tracked in `tasks.md`):
1. **Safaricom IP address ranges** (for IP whitelist validation)
   - Required for: T015 (IPN callback guard), T025 (STK Push callback guard)
   - Contact: apisupport@safaricom.co.ke or Safaricom Developer Portal support
   - **Note**: For development/testing, localhost and common development IPs should be allowed

**Note**: Development can proceed with placeholder configuration, but production deployment requires these details.

**M-Pesa API Base URLs**:
- Sandbox: `https://sandbox.safaricom.co.ke/mpesa`
- Production: `https://api.safaricom.co.ke/mpesa`

## Parallel Execution Opportunities

### Within User Story 1 (US1):
- T010-T011: DTOs can be created in parallel
- T012-T013: Service and controller can be developed in parallel after DTOs
- T014-T015: Security middleware updates can be done in parallel with service development

### Within User Story 2 (US2):
- T025-T026: DTOs can be created in parallel
- T027-T028: Service and controller can be developed in parallel after DTOs

### Cross-Story:
- T010 (IPN DTOs) and T025 (STK Push DTOs) can be done in parallel
- T012 (IPN Service) and T027 (STK Push Service) can be done in parallel after schema

## Implementation Strategy

**MVP First**: Implement User Story 1 (US1) first to establish real-time payment processing foundation.

**Incremental Delivery**:
1. **MVP**: US1 - Real-time IPN processing (enables immediate payment visibility)
2. **Increment 1**: US2 - STK Push initiation (enables agent-initiated payments)
3. **Increment 2**: US3 - Statement deduplication (ensures data completeness)

Each increment is independently testable and delivers value.

---

## Phase 1: Setup

**Goal**: Initialize project structure and configuration for M-Pesa Daraja API integration.

### Configuration Setup

- [ ] T001 Add M-Pesa Daraja API configuration to `apps/api/src/config/configuration.service.ts`
  - Add `mpesa.consumerKey`, `mpesa.consumerSecret`, `mpesa.businessShortCode`, `mpesa.passkey`
  - Add `mpesa.environment` ('sandbox' | 'production')
  - Add `mpesa.baseUrl` (sandbox: `https://sandbox.safaricom.co.ke/mpesa`, production: `https://api.safaricom.co.ke/mpesa`)
  - Add `mpesa.stkPushCallbackUrl`, `mpesa.ipnConfirmationUrl`
  - Add `mpesa.allowedIpRanges` (array, placeholder for now)
  - Load from environment variables with validation

- [ ] T002 Add M-Pesa environment variables to `.env.example` in `apps/api/`
  - Document `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_BUSINESS_SHORT_CODE`, `MPESA_PASSKEY`
  - Document `MPESA_ENVIRONMENT` ('sandbox' | 'production')
  - Document `MPESA_BASE_URL` (optional, defaults based on environment: sandbox=`https://sandbox.safaricom.co.ke/mpesa`, production=`https://api.safaricom.co.ke/mpesa`)
  - Document `MPESA_STK_PUSH_CALLBACK_URL`, `MPESA_IPN_CONFIRMATION_URL`
  - Document `MPESA_ALLOWED_IP_RANGES` (comma-separated, placeholder values)

- [ ] T003 Create phone number normalization utility in `apps/api/src/utils/phone-number.util.ts`
  - Implement `normalizePhoneNumber(phone: string): string` function
  - Strip leading zeros, ensure country code (254), validate format (254XXXXXXXXX)
  - Handle edge cases (missing country code, extra zeros, non-numeric characters)
  - Return normalized format or throw ValidationException for invalid numbers

---

## Phase 2: Foundational

**Goal**: Database schema changes and shared infrastructure that blocks all user stories.

### Schema Changes

- [ ] T004 Add `MpesaPaymentSource` enum to `apps/api/prisma/schema.prisma`
  - Add enum with values: `IPN`, `STATEMENT`
  - Place after `MpesaStatementReasonType` enum

- [ ] T005 Add `MpesaStkPushStatus` enum to `apps/api/prisma/schema.prisma`
  - Add enum with values: `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `EXPIRED`
  - Place after `MpesaPaymentSource` enum

- [ ] T006 Create `MpesaStkPushRequest` model in `apps/api/prisma/schema.prisma`
  - Add model with all fields per data-model.md
  - Set `id` as `String @id @default(uuid()) @db.Uuid` (auto-generated)
  - Add indexes: `@@unique([checkoutRequestId])`, `@@index([accountReference])`, `@@index([status, createdAt])`, `@@index([phoneNumber])`
  - Add relation: `transaction MpesaPaymentReportItem?`
  - Map to table: `@@map("mpesa_stk_push_requests")`

- [ ] T007 Update `MpesaPaymentReportItem` model in `apps/api/prisma/schema.prisma`
  - Make `mpesaPaymentReportUploadId` nullable (change to `String?`)
  - Add new fields: `msisdn`, `firstName`, `middleName`, `lastName`, `source`, `businessShortCode`, `mpesaStkPushRequestId`
  - Set `source` default to `IPN`
  - Add composite index: `@@index([transactionReference, source], name: "idx_transaction_reference_source")`
  - Add indexes: `@@index([source], name: "idx_source")`, `@@index([accountNumber], name: "idx_account_number")`
  - Add foreign key: `mpesaStkPushRequest MpesaStkPushRequest?` relation

- [ ] T008 Create and apply Prisma migration
  - Run `npx prisma migrate dev --name add_mpesa_ipn_and_stk_push` in `apps/api/`
  - Verify migration file created in `apps/api/prisma/migrations/`
  - Verify schema changes applied to database

- [ ] T009 Generate Prisma client
  - Run `npx prisma generate` in `apps/api/`
  - Verify new types available in `@prisma/client`

---

## Phase 3: User Story 1 - Real-time Payment Notifications (P1)

**Goal**: Process IPN notifications in real-time, create payment records immediately, and link to STK Push requests when applicable.

**Independent Test**: Send IPN payloads from M-Pesa sandbox to `/api/public/mpesa/confirmation` endpoint and verify payment records are created with correct transaction details, customer information, and account references.

### DTOs

- [ ] T010 [P] [US1] Create IPN DTOs in `apps/api/src/dto/mpesa-ipn/mpesa-ipn.dto.ts`
  - Create `MpesaIpnPayloadDto` class with all IPN payload fields (TransactionType, TransID, TransTime, TransAmount, etc.)
  - Add validation decorators (`@IsString()`, `@IsOptional()`, etc.)
  - Add Swagger decorators (`@ApiProperty()`)
  - Create `MpesaIpnResponseDto` class with `ResultCode` and `ResultDesc` fields

### Service

- [ ] T011 [US1] Create IPN service in `apps/api/src/services/mpesa-ipn.service.ts`
  - Implement `processIpnNotification(payload: MpesaIpnPayloadDto, correlationId: string): Promise<MpesaIpnResponseDto>`
  - Parse IPN payload and normalize phone number using phone-number.util
  - **Map M-Pesa TransactionType to internal reasonType**: Create private method `mapTransactionTypeToReasonType(transactionType: string): MpesaStatementReasonType`
    - Map "Pay Bill" → `PayBill_STK`
    - Map "Buy Goods" → `PayBill_STK` (or appropriate based on business logic)
    - Map "CustomerPayBillOnline" → `Paybill_MobileApp`
    - Map other transaction types as needed (reference M-Pesa Daraja API documentation)
    - Default to `Unmapped` if transaction type is unknown
  - Check for existing record by `transactionReference` and `source = 'IPN'` (idempotency)
  - If exists: Update existing record
  - If not exists: Create new `MpesaPaymentReportItem` with `source = 'IPN'`, `mpesaPaymentReportUploadId = null`, and mapped `reasonType`
  - Store customer data (firstName, middleName, lastName, msisdn) from IPN payload
  - Attempt to link to STK Push request (matching logic: accountReference, normalized phone, exact amount, 24-hour window)
  - Return success response (`ResultCode: 0, ResultDesc: "Accepted"`) even on errors
  - Log errors internally for investigation (use correlationId for tracing)
  - Handle database write failures gracefully (return success, log error)

- [ ] T012 [US1] Implement STK Push to IPN linking logic in `apps/api/src/services/mpesa-ipn.service.ts`
  - Create private method `linkToStkPushRequest(ipnRecord: MpesaPaymentReportItem, accountReference: string, phoneNumber: string, amount: number): Promise<void>`
  - Query `MpesaStkPushRequest` with matching criteria:
    - `accountReference = BillRefNumber`
    - `phoneNumber = normalized MSISDN`
    - `amount = TransAmount` (exact match, 0.00 tolerance)
    - `status IN ['PENDING', 'COMPLETED']`
    - `initiatedAt` within last 24 hours
    - Order results by `initiatedAt DESC` (most recent first)
  - **Handle multiple matches**: If multiple STK Push requests match:
    - **Priority 1**: Exact amount match (query already filters by exact amount, so all results have exact match)
    - **Priority 2**: Most recent match (use first result from ordered query: `ORDER BY initiatedAt DESC LIMIT 1`)
    - If still multiple matches after ordering (same timestamp): Use first result and log warning with correlationId for investigation
    - Log warning when multiple matches found (include count, accountReference, phoneNumber, amount, correlationId)
  - If match found: Update both records (set `mpesaStkPushRequestId` on payment, `linkedTransactionId` on STK Push request)

### Controller

- [ ] T013 [US1] Create IPN controller in `apps/api/src/controllers/public/mpesa-ipn.controller.ts`
  - Create `MpesaIpnController` class with `@Controller('public/mpesa')` decorator
  - Add `@Post('confirmation')` endpoint method
  - Inject `MpesaIpnService` and `CorrelationIdService` (or generate correlationId)
  - Call service `processIpnNotification()` method
  - Return response DTO
  - Add Swagger decorators (`@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`)
  - Mark endpoint as public (no authentication required)

### Security Middleware

- [ ] T014 [US1] Update API key auth middleware to exclude IPN callback endpoint in `apps/api/src/middleware/api-key-auth.middleware.ts`
  - Add path check: `req.path.startsWith('/api/public/mpesa/confirmation')` or `req.originalUrl.startsWith('/api/public/mpesa/confirmation')`
  - Skip authentication for this path (return `next()`)
  - Add comment explaining M-Pesa requirement

- [ ] T015 [US1] Create IP whitelist guard for IPN callback endpoint in `apps/api/src/guards/ip-whitelist.guard.ts`
  - Create `IpWhitelistGuard` class implementing `CanActivate`
  - Read allowed IP ranges from configuration service
  - **For development/testing**: Always allow localhost (`127.0.0.1`, `::1`) and common development IPs (`192.168.*.*`, `10.*.*.*`, `172.16.*.*` to `172.31.*.*`)
  - **For production**: Validate request IP against Safaricom IP ranges from configuration
  - Return `ForbiddenException` if IP not whitelisted (except in development)
  - Add placeholder implementation (log warning if IP ranges not configured in production)
  - Note: Full production implementation requires Safaricom IP ranges (external dependency)

- [ ] T017 [US1] Apply security guard to IPN controller in `apps/api/src/controllers/public/mpesa-ipn.controller.ts`
  - Add `@UseGuards(IpWhitelistGuard)` to confirmation endpoint
  - Ensure guard runs before service logic

### Module Registration

- [ ] T018 [US1] Register IPN controller and service in `apps/api/src/app.module.ts`
  - Add `MpesaIpnController` to `controllers` array
  - Add `MpesaIpnService` to `providers` array
  - Ensure `ConfigurationService` is available (already global)

---

## Phase 4: User Story 2 - Agent-Initiated Payment Requests (P2)

**Goal**: Enable agents to initiate STK Push payment requests, track request status, and automatically link to IPN transactions.

**Independent Test**: Initiate STK Push request through `/api/internal/mpesa/stk-push/initiate`, verify request sent to M-Pesa, receive callback with status updates, and confirm request linked when corresponding IPN arrives.

### DTOs

- [ ] T019 [P] [US2] Create STK Push DTOs in `apps/api/src/dto/mpesa-stk-push/mpesa-stk-push.dto.ts`
  - Create `InitiateStkPushDto` class with `phoneNumber`, `amount`, `accountReference`, `transactionDesc?`
  - Add validation decorators (`@IsString()`, `@IsNumber()`, `@Min(1)`, `@Max(70000)`, etc.)
  - Add Swagger decorators
  - Create `StkPushRequestResponseDto` class with response fields
  - Create `StkPushCallbackDto` class for callback payload
  - Create `MpesaCallbackResponseDto` class for callback response

### M-Pesa Daraja API Client

- [ ] T020 [US2] Create M-Pesa Daraja API client service in `apps/api/src/services/mpesa-daraja-api.service.ts`
  - Create `MpesaDarajaApiService` class
  - Use base URL from configuration (sandbox: `https://sandbox.safaricom.co.ke/mpesa`, production: `https://api.safaricom.co.ke/mpesa`)
  - Implement OAuth 2.0 token generation (`generateAccessToken()`) - endpoint: `/oauth/v1/generate?grant_type=client_credentials`
  - Implement STK Push initiation (`initiateStkPush(phoneNumber, amount, accountReference, merchantRequestId, callbackUrl): Promise<StkPushResponse>`) - endpoint: `/stkpush/v1/processrequest`
    - **Note**: `merchantRequestId` parameter uses camelCase (code convention), but M-Pesa API expects `MerchantRequestID` in request payload
  - Add retry logic: retry up to 3 times with exponential backoff (1s, 2s, 4s delays)
  - Handle network errors, timeouts, and API errors
  - Use configuration service for API credentials and environment
  - Log all API calls with correlation IDs

### Service

- [ ] T021 [US2] Create STK Push service in `apps/api/src/services/mpesa-stk-push.service.ts`
  - Implement `initiateStkPush(dto: InitiateStkPushDto, correlationId: string, userId?: string): Promise<StkPushRequestResponseDto>`
  - Validate phone number (normalize using phone-number.util)
  - Validate amount (1-70,000 KES)
  - Validate account reference exists (check policy payment account number)
  - Create `MpesaStkPushRequest` record with `status = 'PENDING'` (id is auto-generated UUID)
  - Call M-Pesa Daraja API with `MerchantRequestID = stkPushRequest.id` (M-Pesa API field name)
  - Store `CheckoutRequestID` from M-Pesa response in `checkoutRequestId` database field (camelCase)
  - Handle API failures (retry logic in API client, update status to FAILED if all retries fail)
  - Return STK Push request details

- [ ] T022 [US2] Implement STK Push callback handling in `apps/api/src/services/mpesa-stk-push.service.ts`
  - Implement `handleStkPushCallback(payload: StkPushCallbackDto, correlationId: string): Promise<MpesaCallbackResponseDto>`
  - Find `MpesaStkPushRequest` by `checkoutRequestId` field, matching `CheckoutRequestID` from M-Pesa callback payload
  - Update status based on `ResultCode`:
    - `ResultCode = 0` → `COMPLETED`
    - Otherwise → `FAILED` or `CANCELLED` (based on ResultDesc)
  - Store `resultCode` and `resultDesc` fields
  - Set `completedAt` timestamp
  - Return success response (`ResultCode: 0`) even on errors
  - Log errors internally for investigation

### Controller

- [ ] T023 [US2] Create STK Push internal controller in `apps/api/src/controllers/internal/mpesa-stk-push.controller.ts`
  - Create `MpesaStkPushController` class with `@Controller('internal/mpesa/stk-push')` decorator
  - Add `@Post('initiate')` endpoint for agent-initiated requests (requires authentication)
  - Inject `MpesaStkPushService` and correlation ID service
  - Call service `initiateStkPush()` method
  - Return response DTOs
  - Add Swagger decorators

- [ ] T023b [US2] Create STK Push public controller for callback endpoint in `apps/api/src/controllers/public/mpesa-stk-push.controller.ts`
  - Create `MpesaStkPushPublicController` class with `@Controller('public/mpesa/stk-push')` decorator
  - Add `@Post('callback')` endpoint for M-Pesa callbacks (public, no authentication)
  - Endpoint path: `/api/public/mpesa/stk-push/callback`
  - Inject `MpesaStkPushService` and correlation ID service
  - Call service `handleStkPushCallback()` method
  - Return response DTOs
  - Add Swagger decorators
  - **Note**: Separate public controller maintains clear architectural separation between internal and public endpoints

### Testing Endpoint (Development/Testing)

- [ ] T023a [US2] Create simple test endpoint for STK Push in `apps/api/src/controllers/internal/mpesa-stk-push.controller.ts`
  - Add `@Post('test')` endpoint for quick STK Push testing during development
  - Accept minimal payload: `phoneNumber`, `amount`, `accountReference` (optional: `transactionDesc`)
  - Call `initiateStkPush()` service method
  - Return STK Push request details (id, status, checkoutRequestId, etc.)
  - Add Swagger decorators with clear documentation that this is for testing
  - **Note**: This allows testing STK Push integration independently before integrating into register/payment page flow
  - **Future consideration**: Remove in production or gate behind feature flag/environment check

### Security Middleware

- [ ] T024 [US2] Update API key auth middleware to exclude STK Push callback endpoint in `apps/api/src/middleware/api-key-auth.middleware.ts`
  - Add path check: `req.path.startsWith('/api/public/mpesa/stk-push/callback')` or `req.originalUrl.startsWith('/api/public/mpesa/stk-push/callback')`
  - Skip authentication for this path

- [ ] T025 [US2] Apply security guard to STK Push callback endpoint in `apps/api/src/controllers/public/mpesa-stk-push.controller.ts`
  - Add `@UseGuards(IpWhitelistGuard)` to callback endpoint
  - Ensure guard runs before service logic

### Module Registration

- [ ] T026 [US2] Register STK Push controllers and services in `apps/api/src/app.module.ts`
  - Add `MpesaStkPushController` (internal) to `controllers` array
  - Add `MpesaStkPushPublicController` (public) to `controllers` array
  - Add `MpesaStkPushService` and `MpesaDarajaApiService` to `providers` array

---

## Phase 5: User Story 3 - Statement Upload Gap Filling (P3)

**Goal**: Enhance existing statement upload functionality to check against existing IPN records, skip duplicates, and only create records for gaps.

**Note**: The statement upload functionality already exists in `MpesaPaymentsService.uploadAndParseStatement()`. This phase **updates** the existing method to add deduplication logic, not rebuild it.

**Independent Test**: Upload statement file containing transactions that partially overlap with existing IPN records, verify duplicates are skipped, only new transactions are created, and accurate statistics are returned.

### Service Updates

- [ ] T027 [US3] Update existing statement upload deduplication logic in `apps/api/src/services/mpesa-payments.service.ts`
  - **Note**: This is an UPDATE to existing functionality, not a rebuild
  - Locate existing `uploadAndParseStatement()` method (already handles Excel parsing, file storage, and payment record creation)
  - Before creating payment records from statement, add deduplication check:
    - For each transaction in statement:
      - Query: `MpesaPaymentReportItem` where `transactionReference = statement.transactionReference` AND `source = 'IPN'`
      - If IPN record exists: Skip, increment match counter
      - If no IPN record: Create new record with `source = 'STATEMENT'` and `mpesaPaymentReportUploadId = upload.id`
  - Track statistics: `totalItems`, `matchedIpnRecords`, `gapsFilled` (new records created)
  - Return statistics in response
  - Preserve all existing functionality (file validation, Excel parsing, file storage, etc.)

- [ ] T028 [US3] Update existing statement records to set source in `apps/api/src/services/mpesa-payments.service.ts`
  - After migration, update all existing `MpesaPaymentReportItem` records:
    - Set `source = 'STATEMENT'` for all records that have `mpesaPaymentReportUploadId` set
    - This can be done in a separate migration script or one-time data fix

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Error handling, logging, documentation, and final integration.

### Error Handling

- [ ] T029 Add error handling for M-Pesa API failures in `apps/api/src/services/mpesa-daraja-api.service.ts`
  - Handle specific M-Pesa error codes
  - Map M-Pesa errors to internal error codes
  - Log errors with correlation IDs
  - Throw appropriate exceptions

- [ ] T030 Add error handling for validation failures in `apps/api/src/services/mpesa-ipn.service.ts` and `apps/api/src/services/mpesa-stk-push.service.ts`
  - Use `ValidationException` for validation errors
  - Check `ErrorCodes` enum for existing codes before creating new ones
  - Return standardized error response format with `status` field (not `statusCode`)
  - Include correlation IDs in error responses

### Logging & Observability

- [ ] T031 Add structured logging throughout IPN and STK Push services
  - Log all IPN notifications received (with correlationId)
  - Log all STK Push requests initiated (with correlationId)
  - Log all matching operations (STK Push to IPN linking)
  - Log all errors with full context (correlationId, transaction details)
  - Use correlation IDs for request tracing

- [ ] T032 Add metrics/monitoring hooks (if applicable)
  - Add counters for IPN notifications processed
  - Add counters for STK Push requests initiated
  - Add counters for matching success/failure
  - Add timing metrics for IPN processing (target: 95% within 2 seconds)

### Documentation

- [ ] T033 Update Swagger documentation for all endpoints in controllers
  - Ensure all endpoints have `@ApiOperation()` with descriptions
  - Add `@ApiResponse()` decorators for all response scenarios
  - Mark public callback endpoints appropriately
  - Add example payloads in Swagger decorators

- [ ] T034 Update environment variable documentation
  - Document all M-Pesa configuration variables in README or environment docs
  - Include callback URL registration instructions
  - Note external dependencies (IP ranges, signature details)

### Testing

- [ ] T035 Create unit tests for IPN service in `apps/api/tests/unit/mpesa-ipn.service.spec.ts`
  - Test IPN payload parsing and normalization
  - Test idempotency (duplicate IPN handling)
  - Test STK Push linking logic
  - Test error handling (validation failures, database errors)
  - Mock Prisma service and M-Pesa API calls

- [ ] T036 Create unit tests for STK Push service in `apps/api/tests/unit/mpesa-stk-push.service.spec.ts`
  - Test STK Push initiation with valid/invalid data
  - Test callback handling (completed, failed, cancelled)
  - Test retry logic for M-Pesa API failures
  - Mock Prisma service and M-Pesa API client

- [ ] T037 Create integration tests for callback endpoints in `apps/api/tests/integration/mpesa-callbacks.e2e-spec.ts`
  - Test IPN callback endpoint with valid payloads
  - Test IPN callback endpoint with invalid payloads
  - Test STK Push callback endpoint
  - Test IP whitelist guard (with mocks for localhost/development IPs)
  - Verify database records created correctly

### Code Quality

- [ ] T038 Run linter and fix any issues
  - Run `pnpm lint` in `apps/api/`
  - Fix all linting errors
  - Ensure TypeScript strict mode compliance

- [ ] T039 Verify all date/time operations use UTC methods
  - Review all date operations in IPN and STK Push services
  - Ensure `setUTCHours()`, `Date.UTC()`, etc. are used (not local timezone methods)
  - Verify time window calculations use UTC

### Final Integration

- [ ] T040 Register all new modules and verify application starts
  - Verify all controllers and services registered in `app.module.ts`
  - Start application and verify no startup errors
  - Verify all endpoints are accessible (check Swagger docs)

- [ ] T041 Verify database migration applied correctly
  - Check that all new enums and models exist in database
  - Verify indexes created
  - Verify foreign key constraints
  - Check that existing records have correct `source` values

---

## Summary

**Total Tasks**: 42 (T016 - signature verification guard removed, T023b - public callback controller added)

**Tasks by Phase**:
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (US1 - IPN): 8 tasks (signature verification removed)
- Phase 4 (US2 - STK Push): 10 tasks (includes test endpoint and separate public controller)
- Phase 5 (US3 - Statement Deduplication): 2 tasks
- Phase 6 (Polish): 13 tasks

**Tasks by User Story**:
- US1 (IPN Processing): 8 tasks (signature verification removed)
- US2 (STK Push): 10 tasks (includes test endpoint and separate public controller)
- US3 (Statement Deduplication): 2 tasks

**Parallel Opportunities**: 
- DTOs can be created in parallel (T010, T019)
- Services can be developed in parallel after schema (T011, T021)
- Security middleware updates can be done in parallel (T014, T024)

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (18 tasks) - Delivers real-time IPN processing foundation.

**External Dependencies** (blocking for production):
1. **Safaricom IP address ranges** (for T015, T025 - IP whitelist guards)
   - **Note**: For development/testing, localhost and common development IPs are automatically allowed

**Independent Test Criteria**:
- **US1**: Send IPN payloads from M-Pesa sandbox to confirmation endpoint, verify payment records created
- **US2**: Initiate STK Push request via test endpoint or initiate endpoint, verify sent to M-Pesa, receive callback, confirm linking when IPN arrives
- **US3**: Upload statement file with overlapping transactions, verify deduplication and gap filling

**Future Integration Notes**:
- **Register/Payment Page Integration**: The STK Push functionality is designed as a standalone service that can be integrated into the existing register/payment page. The register/payment page currently works as designed but lacks STK Push functionality. Future work will integrate STK Push initiation into the register/payment page, allowing agents to initiate STK Push requests directly from the registration flow. The test endpoint (T023a) allows independent testing of STK Push functionality before this integration.
