# Feature Specification: M-Pesa Daraja IPN and STK Push Integration

**Feature Branch**: `001-mpesa-ipn-integration`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Integrate M-Pesa Daraja API Instant Payment Notification (IPN) as the primary transaction data source and M-Pesa Express (STK Push) for agent-initiated payments. Statement uploads will serve as secondary source for gap filling when records are missing."

## Clarifications

### Session 2025-01-27

- Q: How should the system secure the public IPN and STK Push callback endpoints that cannot require API key authentication? → A: IP whitelist validation (validate M-Pesa source IPs against known ranges). **Note:** Signature verification removed as no documentation available. For development/testing, localhost and common development IPs should be allowed.
- Q: When matching STK Push requests to IPN transactions, what amount tolerance should be used to account for potential rounding differences? → A: Exact match only (0.00 tolerance)
- Q: How should phone numbers be normalized for matching between STK Push requests and IPN transactions? → A: Normalize to international format (254XXXXXXXXX) - strip leading zeros, ensure country code
- Q: When the system receives an IPN or STK Push callback with invalid data (malformed payload, missing required fields, or validation failures), what response should be returned to M-Pesa? → A: Return success (ResultCode: 0) and log error internally for investigation
- Q: When initiating an STK Push request, if the M-Pesa Daraja API call fails (network error, timeout, or API error), how should the system handle retries? → A: Retry up to 3 times with exponential backoff (e.g., 1s, 2s, 4s delays)
- Q: What amount limits should be enforced for STK Push requests? → A: Use M-Pesa standard limits (min 1 KES, max 70,000 KES per transaction)
- Q: If an IPN notification is received and validated, but the database write fails (database unavailable, constraint violation, etc.), what should the system do? → A: Return success (ResultCode: 0) to M-Pesa, log error for manual investigation and recovery

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-time Payment Notifications (Priority: P1)

When a customer makes an M-Pesa payment to a policy account, the system receives an instant payment notification (IPN) from M-Pesa Daraja API. The system processes this notification immediately, creates a payment record, and links it to the appropriate policy if the account reference matches. This enables real-time payment tracking without waiting for manual statement uploads.

**Why this priority**: Real-time payment processing is critical for providing immediate confirmation to customers and agents, enabling faster policy activation and reducing the need for manual reconciliation. This is the primary data source and foundation for the entire payment tracking system.

**Independent Test**: Can be fully tested by sending IPN payloads from M-Pesa sandbox to the confirmation endpoint and verifying that payment records are created with correct transaction details, customer information, and account references. Delivers immediate payment visibility without manual intervention.

**Acceptance Scenarios**:

1. **Given** a customer makes an M-Pesa payment to a policy account, **When** M-Pesa sends an IPN notification to the system, **Then** the system creates a payment record with transaction details, customer phone number, name, amount, and account reference
2. **Given** an IPN notification is received for a transaction that already exists (duplicate notification), **When** the system processes the notification, **Then** the system updates the existing record without creating duplicates (idempotent behavior)
3. **Given** an IPN notification contains an account reference matching a pending STK Push request, **When** the system processes the notification, **Then** the system links the IPN transaction to the STK Push request automatically
4. **Given** an IPN notification is received with invalid or missing required fields, **When** the system processes the notification, **Then** the system logs the error internally, returns success (ResultCode: 0) to M-Pesa to prevent retries, and does not create invalid records

---

### User Story 2 - Agent-Initiated Payment Requests (Priority: P2)

When an agent needs to collect a payment from a customer, they can initiate an STK Push request through the system. The system sends a payment prompt to the customer's phone, tracks the request status, and automatically links the resulting payment transaction when the IPN notification is received.

**Why this priority**: Enables agents to proactively collect payments from customers, improving cash flow and reducing payment delays. This complements the IPN system by providing a way to initiate payments rather than just receiving notifications.

**Independent Test**: Can be fully tested by initiating an STK Push request through the internal API, verifying the request is sent to M-Pesa, receiving the callback with status updates, and confirming the request is linked when the corresponding IPN arrives. Delivers agent-initiated payment collection capability.

**Acceptance Scenarios**:

1. **Given** an agent initiates an STK Push request with customer phone number, amount, and policy account reference, **When** the system processes the request, **Then** the system creates a pending STK Push request record and sends the payment prompt to the customer's phone
2. **Given** a customer completes the STK Push payment on their phone, **When** M-Pesa sends a callback notification, **Then** the system updates the STK Push request status to completed and stores the result details
3. **Given** a customer cancels or fails to complete the STK Push payment, **When** M-Pesa sends a callback notification, **Then** the system updates the STK Push request status to failed or cancelled with appropriate reason
4. **Given** an STK Push request is initiated and the corresponding IPN notification arrives, **When** the system processes the IPN, **Then** the system automatically links the IPN transaction to the STK Push request using account reference, phone number, and amount matching

---

### User Story 3 - Statement Upload Gap Filling (Priority: P3)

When statement files are uploaded manually, the system checks each transaction against existing IPN records. If an IPN record already exists for a transaction, the statement record is skipped to avoid duplicates. Only transactions that don't have corresponding IPN records are created from the statement, filling gaps in the payment data.

**Why this priority**: Provides a fallback mechanism for cases where IPN notifications might be missed or delayed, ensuring complete payment records. This maintains data completeness while preventing duplicate entries from multiple data sources.

**Independent Test**: Can be fully tested by uploading a statement file containing transactions that partially overlap with existing IPN records, verifying that duplicates are skipped and only new transactions are created, and confirming accurate statistics are returned. Delivers data completeness without duplication.

**Acceptance Scenarios**:

1. **Given** a statement file is uploaded containing transactions, **When** the system processes the file, **Then** the system checks each transaction against existing IPN records and only creates records for transactions not found in IPN data
2. **Given** a statement file contains transactions that all match existing IPN records, **When** the system processes the file, **Then** the system skips all transactions and reports zero new records created, with accurate match statistics
3. **Given** a statement file contains a mix of transactions with and without matching IPN records, **When** the system processes the file, **Then** the system creates records only for unmatched transactions and provides statistics showing matches and gaps filled
4. **Given** a statement file is uploaded, **When** the system processes it, **Then** the system marks all created records with source "STATEMENT" to distinguish them from IPN-sourced records

---

### Edge Cases

- What happens when an IPN notification arrives before the corresponding STK Push request is created? (System creates IPN record, and later when STK Push is initiated, matching logic should still work within the 24-hour window)
- How does the system handle IPN notifications with account references that don't match any policy? (System creates the payment record but it remains unlinked until manual review or policy creation)
- What happens when multiple STK Push requests have the same account reference and phone number within 24 hours? (Matching logic should use exact amount match and timestamp to find the most likely match)
- How does the system handle IPN notifications with malformed dates or amounts? (System validates and rejects invalid data, logs errors internally for investigation, and returns success to M-Pesa to prevent retry attempts)
- What happens when statement upload processing encounters a database error for one transaction? (System logs the error, continues processing remaining transactions, and reports failed items)
- What happens when an IPN notification is validated but database write fails? (System returns success to M-Pesa to prevent retries, logs error with full transaction details for manual investigation and recovery)
- How does the system handle STK Push callbacks that arrive before the IPN notification? (System updates STK Push status, and when IPN arrives later, matching logic links them)
- What happens when an IPN notification has a transaction reference that matches an existing statement-sourced record? (System creates a new IPN-sourced record since IPN is the primary source; both records exist but can be distinguished by source field)
- What happens when IPN matches a PENDING STK Push request? (System creates records in both `MpesaPaymentReportItem` and `policy_payments`, updates STK Push status. If STK Push callback later arrives with FAILED/CANCELLED status, see deferred decision)
- What happens when IPN matches a COMPLETED STK Push request? (System creates only `MpesaPaymentReportItem` record, skips `policy_payments` to prevent duplicate payment tracking)
- What happens when IPN doesn't match any STK Push request? (System validates using same logic as XLS statement processing, then creates records in both tables)
- What happens when duplicate IPN arrives? (System checks `policy_payments` table by `transactionReference` for idempotency, updates existing records if found)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST receive and process Instant Payment Notification (IPN) payloads from M-Pesa Daraja API in real-time
- **FR-002**: System MUST create payment records immediately upon receiving IPN notifications with transaction details, customer information, and account references. Payment records MUST be created in both `MpesaPaymentReportItem` and `policy_payments` tables, except when IPN matches a COMPLETED STK Push request (in which case only `MpesaPaymentReportItem` is created to prevent duplicate payment tracking)
- **FR-003**: System MUST handle duplicate IPN notifications idempotently by updating existing records instead of creating duplicates
- **FR-004**: System MUST link IPN transactions to STK Push requests automatically when account reference, normalized phone number (international format 254XXXXXXXXX), exact amount match (0.00 tolerance), and time window match
- **FR-005**: System MUST allow agents to initiate STK Push payment requests with customer phone number, amount, and policy account reference, and MUST retry failed M-Pesa API calls up to 3 times with exponential backoff (1s, 2s, 4s delays) before marking the request as failed. After 3 failed retries, system MUST update STK Push request status to FAILED, store error details from all 3 retry attempts, log retry exhaustion with correlation ID, and return generic "STK Push initiation failed" error to agent. Retry exhaustion MUST be tracked as a metric.
- **FR-006**: System MUST track STK Push request status (pending, completed, failed, cancelled, expired) and update status based on M-Pesa callbacks. System MUST also implement fallback expiration check: If no callback received within configured timeout (default: 5 minutes, configurable), mark as EXPIRED. Periodic job (default: every 2 minutes, configurable) MUST check for PENDING requests older than timeout. System MUST log expiration with correlation ID and distinguish between M-Pesa callback expiration and system timeout expiration.
- **FR-007**: System MUST store STK Push request details including checkout request ID, merchant request ID, result codes, and timestamps
- **FR-008**: System MUST process STK Push callback notifications from M-Pesa and update request status accordingly
- **FR-009**: System MUST check for existing IPN records before creating payment records from statement uploads
- **FR-010**: System MUST skip creating duplicate records when statement transactions match existing IPN records
- **FR-011**: System MUST create payment records from statement uploads only for transactions not found in IPN data (gap filling)
- **FR-012**: System MUST mark payment records with their data source (IPN or STATEMENT) to distinguish origin
- **FR-013**: System MUST provide statistics on statement uploads including total items, matched IPN records, gaps filled, and error counts. Statistics MUST exactly match actual processing: `matchedIpnRecords + gapsFilled + errors = totalItems` (or account for errors). Statistics MUST be returned immediately after upload. System MUST validate the statistics equation and throw an error if it doesn't match.
- **FR-014**: System MUST validate IPN payloads and reject invalid or malformed notifications with appropriate error responses
- **FR-015**: System MUST validate STK Push request parameters (phone number format normalized to international format 254XXXXXXXXX, amount within M-Pesa standard limits: minimum 1 KES, maximum 70,000 KES per transaction) before sending to M-Pesa
- **FR-016**: System MUST handle errors gracefully and return success (ResultCode: 0) to M-Pesa for both IPN and STK Push callbacks even when validation fails or database operations fail, logging errors internally for investigation and manual recovery to prevent M-Pesa retry attempts
- **FR-017**: System MUST store customer name information (first name, middle name, last name) from IPN notifications when available
- **FR-018**: System MUST store customer phone number (MSISDN) from IPN notifications normalized to international format (254XXXXXXXXX) for matching and reference
- **FR-019**: System MUST map M-Pesa transaction types to internal reason type classifications

**Transaction Type Mapping**:
- M-Pesa Daraja API `TransactionType` values must be mapped to `MpesaStatementReasonType` enum:
  - `"Pay Bill"` → `PayBill_STK`
  - `"CustomerPayBillOnline"` → `Paybill_MobileApp`
  - `"Buy Goods"` → `PayBill_STK` (or appropriate based on business context)
  - Unknown/unmapped transaction types → `Unmapped`
- Mapping function should be similar to existing `mapReasonType` in `MpesaPaymentsService`
- Default to `Unmapped` for any transaction type not explicitly mapped
- **FR-020**: System MUST make IPN confirmation endpoint publicly accessible without API key authentication (M-Pesa requires this), and MUST implement security measures: IP whitelist validation (restrict to Safaricom's known IP address ranges in production). For development/testing, localhost and common development IPs (127.0.0.1, ::1, 192.168.*.*, 10.*.*.*, 172.16-31.*.*) must be allowed. Official IP ranges must be obtained from Safaricom's official documentation or technical support
- **FR-021**: System MUST make STK Push callback endpoint publicly accessible without API key authentication (M-Pesa requires this), and MUST implement security measures: IP whitelist validation (restrict to Safaricom's known IP address ranges in production). For development/testing, localhost and common development IPs (127.0.0.1, ::1, 192.168.*.*, 10.*.*.*, 172.16-31.*.*) must be allowed. Official IP ranges must be obtained from Safaricom's official documentation or technical support
- **FR-022**: System MUST support matching STK Push requests to IPN transactions within a 24-hour time window (calculated from STK Push initiation timestamp, with 5-minute buffer for clock skew). All time calculations MUST use UTC to avoid timezone issues. System MUST log when match is attempted but fails due to time window expiration.
- **FR-023**: System MUST validate IPN transactions that don't match any STK Push request using the same validation logic as XLS statement processing
- **FR-024**: System MUST check `policy_payments` table by `transactionReference` to prevent duplicate payment records (idempotent behavior)
- **FR-025**: System MUST handle IPN processing when matching STK Push requests: If IPN matches PENDING STK Push, create records in both tables and update STK Push status; If IPN matches COMPLETED STK Push, create only `MpesaPaymentReportItem` (skip `policy_payments` to prevent duplicate)
- **FR-026**: System MUST determine transaction direction for IPN transactions: All IPN notifications represent payments received (paidIn). Transaction direction determination documented for future reference (if refunds/withdrawals needed, handle via separate transaction type or negative amounts)
- **FR-027**: System MUST create policies with `PENDING_ACTIVATION` status and NULL `startDate` and `endDate` when payment has not been completed. Dates MUST only be set when policy is activated on first payment completion
- **FR-028**: System MUST activate policies (change status from `PENDING_ACTIVATION` to `ACTIVE`) ONLY on the first payment completion. System MUST set `startDate` to payment date and `endDate` to one year from `startDate` when activating. System MUST NOT change policy status if policy is already `ACTIVE` or in any other status (e.g., `SUSPENDED`, `TERMINATED`)
- **FR-029**: System MUST handle policy activation idempotently: If IPN arrives for a policy that is already `ACTIVE` (e.g., activated by STK Push callback), system MUST NOT attempt to activate again. System MUST only activate policies with status `PENDING_ACTIVATION`
- **FR-030**: System MUST store ALL STK Push callback responses from M-Pesa (regardless of result code: success, timeout, cancelled, etc.) in the `MpesaStkPushCallbackResponse` table for audit purposes. This enables tracking of all payment attempts and supports retry logic
- **FR-031**: System MUST update placeholder payment records (with `transactionReference` starting with `PENDING-STK-` and `actualPaymentDate = null`) when payment is completed via IPN or STK Push callback, instead of creating duplicate payment records. The placeholder payment MUST be updated with the real transaction reference and payment date
- **FR-032**: System MUST use UTC for all date/time operations to ensure consistency across timezones. All timestamps stored in the database MUST be in UTC format
- **FR-033**: System MUST allow all IP addresses in development environment for M-Pesa callback endpoints (IP whitelist guard must bypass validation when `NODE_ENV = development`). In production, IP whitelist validation MUST be enforced
- **FR-034**: System MUST skip `x-correlation-id` header requirement for M-Pesa public callback endpoints (`/api/public/mpesa/confirmation` and `/api/public/mpesa/stk-push/callback`). System MUST automatically generate a correlation ID for these requests if not provided for request tracing

### Payment Record Creation Flow

**Dual-Table Creation**: Payment records MUST be created in both `MpesaPaymentReportItem` and `policy_payments` tables, except in specific scenarios outlined below.

**IPN Processing Scenarios**:

1. **IPN matches COMPLETED STK Push request**:
   - Create record in `MpesaPaymentReportItem` only
   - Skip `policy_payments` to prevent duplicate payment tracking (STK Push callback already created payment record)
   - Link IPN to STK Push request

2. **IPN matches PENDING STK Push request**:
   - Create records in both `MpesaPaymentReportItem` and `policy_payments`
   - Update STK Push request status (link established)
   - Later STK Push callback handled idempotently (see deferred decision for status mismatch scenario)

3. **IPN doesn't match any STK Push request**:
   - Validate using same logic as XLS statement processing
   - Create records in both `MpesaPaymentReportItem` and `policy_payments` (after validation)

**STK Push Callback Processing**:
- When STK Push callback is received (regardless of result code): Store callback response in `MpesaStkPushCallbackResponse` table for audit
- When STK Push callback indicates COMPLETED: 
  - Check for existing placeholder payment (`transactionReference` starts with `PENDING-STK-` and `actualPaymentDate = null`) for the same policy
  - If placeholder exists: Update placeholder with real transaction reference and payment date
  - If no placeholder exists: Create records in both `MpesaPaymentReportItem` and `policy_payments`
- When STK Push callback indicates failure/timeout/cancelled: Only store callback response, do not create payment records

**Deduplication**:
- Check `policy_payments` table by `transactionReference` before creating records
- If `transactionReference` already exists in `policy_payments`, handle idempotently (update existing records)
- Check for placeholder payments (`transactionReference` starts with `PENDING-STK-` and `actualPaymentDate = null`) before creating new payment records
- Update placeholder payments instead of creating duplicates when payment is completed

**Transaction Direction**:
- All IPN transactions are payments received (paidIn)
- `MpesaPaymentReportItem` has `paidIn` and `withdrawn` fields (populated from XLS processing)
- IPN records set `paidIn` appropriately (all IPN transactions are incoming payments)

### Key Entities *(include if feature involves data)*

- **Payment Record**: Represents a single M-Pesa transaction with transaction reference, timestamps, amounts, customer information, account reference, and data source (IPN or STATEMENT). Can be linked to a STK Push request and may or may not be linked to a statement upload.

- **STK Push Request**: Represents an agent-initiated payment request with customer phone number, amount, account reference, status tracking, and linkage to resulting payment transaction. Tracks the lifecycle from initiation through completion or failure.

- **Payment Source**: Classification indicating whether a payment record originated from real-time IPN notification or manual statement upload, enabling data quality tracking and deduplication logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System processes 95% of IPN notifications within 2 seconds of receipt, creating payment records immediately
- **SC-002**: System successfully links 90% of STK Push-initiated payments to their corresponding IPN transactions automatically within 24 hours (from STK Push initiation). System MUST alert (log WARN level, track as metric) when STK Push is COMPLETED but no IPN received within 24 hours of completion. Check for missing IPN hourly via periodic job.
- **SC-003**: Statement upload deduplication prevents 100% of duplicate records when IPN data already exists for transactions
- **SC-004**: System handles IPN notification processing with 99.9% success rate (excluding invalid payloads from M-Pesa)
- **SC-005**: Agents can initiate STK Push requests and receive status updates within 30 seconds of customer action
- **SC-006**: System provides accurate gap-filling statistics showing matched IPN records and newly created statement records. Accuracy defined as: statistics exactly match actual database records created/skipped, with validation equation `matchedIpnRecords + gapsFilled + errors = totalItems`
- **SC-007**: Payment records are available for querying and reporting within 5 seconds of IPN notification receipt
- **SC-008**: System maintains data integrity with zero duplicate payment records when both IPN and statement data exist for the same transaction

## Configuration Requirements

### Required Environment Variables

The following environment variables MUST be configured for M-Pesa Daraja API integration:

**Required Variables:**
- `MPESA_CONSUMER_KEY` (string, required) - M-Pesa Daraja API consumer key
- `MPESA_CONSUMER_SECRET` (string, required) - M-Pesa Daraja API consumer secret
- `MPESA_BUSINESS_SHORT_CODE` (string, required, format: 6 digits) - Business short code
- `MPESA_PASSKEY` (string, required) - M-Pesa passkey
- `MPESA_STK_PUSH_CALLBACK_URL` (string, required) - Publicly accessible HTTPS URL for STK Push callbacks
- `MPESA_IPN_CONFIRMATION_URL` (string, required) - Publicly accessible HTTPS URL for IPN confirmation

**Optional Variables:**
- `MPESA_ENVIRONMENT` (string, optional, default: 'sandbox') - Environment: 'sandbox' | 'production'
- `MPESA_BASE_URL` (string, optional) - Base URL (auto-derived from environment if not provided)
  - Sandbox: `https://sandbox.safaricom.co.ke/mpesa`
  - Production: `https://api.safaricom.co.ke/mpesa`
- `MPESA_ALLOWED_IP_RANGES` (string, optional for dev, required for production) - Comma-separated CIDR blocks for IP whitelist

**Configuration Validation:**
- All required variables MUST be present at application startup (startup fails if missing)
- URL formats MUST be validated (HTTPS, valid domain) at startup
- Example values documented in `.env.example` file

**STK Push Timeout Configuration:**
- `MPESA_STK_PUSH_TIMEOUT_MINUTES` (number, optional, default: 5) - STK Push request timeout in minutes
- `MPESA_STK_PUSH_EXPIRATION_CHECK_INTERVAL_MINUTES` (number, optional, default: 2) - Interval for checking expired STK Push requests

## Logging Requirements

### Error Logging

**Format**: Structured JSON logs with the following fields:
- Error message and stack trace
- Correlation ID (for request tracing)
- Transaction details (TransID, amount, accountReference, phoneNumber)
- Timestamp
- Error type (validation, database, network, API)
- Full request payload (for troubleshooting)
- Full response payload (for troubleshooting)

**Error Categories:**
- `ValidationError` - Validation failures
- `DatabaseError` - Database operation failures
- `NetworkError` - Network/API communication failures
- `ApiError` - M-Pesa API errors

**Recovery Procedures** (general guidance):
- **Validation errors**: Review and fix data, then reprocess
- **Database errors**: Check constraints, fix data, then retry
- **Network errors**: Usually transient; monitor and retry if needed
- **API errors**: Review M-Pesa response, contact support if needed

**Logging Level**: ERROR level for all error scenarios

### Success Operation Logging

**Format**: Structured JSON logs with the following fields:
- Event type (IPN_PROCESSED, STK_PUSH_INITIATED, STK_PUSH_LINKED)
- Correlation ID
- Transaction ID / Request ID
- Key details (amount, accountReference, phoneNumber)
- Timestamp
- Processing time (for IPN processing only, for SC-001 monitoring)

**Logging Level**: INFO level for successful operations

**Separate Events**: STK Push linking logged as separate event from IPN processing

### Correlation ID Requirements

**Generation**: 
- Check if M-Pesa provides correlation ID in request headers
- **For M-Pesa public callbacks** (`/api/public/mpesa/confirmation` and `/api/public/mpesa/stk-push/callback`): Skip `x-correlation-id` header requirement (M-Pesa doesn't send this header), automatically generate correlation ID if not provided
- For other routes: If not provided, generate unique correlation ID (UUID format) in middleware/controller
- Same logic applies to all routes (automatic generation if missing)

**Usage**:
- Include correlation ID in all log entries
- Include correlation ID in error responses (for client tracing)
- Pass correlation ID between services (IPN service → STK Push service)
- Format: `correlationId: <uuid>` in logs

**Storage**: Correlation IDs NOT stored in database records

### Metrics and Monitoring

**Basic Metrics** (logged, not exposed via endpoint):
- IPN notifications received (counter)
- IPN notifications processed successfully (counter)
- STK Push requests initiated (counter)
- STK Push requests completed (counter)
- STK Push to IPN matches found (counter)
- IPN processing time histogram (buckets: <1s, <2s, <5s, <10s, >10s) - for SC-001 monitoring
- Security violations (counter)
- Retry exhaustion events (counter)
- Unmatched IPN count (distinguish: no match attempted vs match attempted but failed)
- Missing IPN count (STK Push completed but no IPN within 24 hours)
- Queue depth (for performance monitoring)

## Error Response Formats

### Public Callback Endpoints (IPN, STK Push Callback)

**Format**: M-Pesa format
```json
{
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

**HTTP Status Code**: Always 200 OK (even on validation/processing errors, per FR-016)

**ResultCode Values**:
- `0` - Success (always returned to prevent M-Pesa retries)
- Other codes documented in M-Pesa API documentation (not used by system, always returns 0)

**Note**: FR-016 overrides FR-014 for callbacks - always return success (ResultCode: 0) to prevent M-Pesa retries, log errors internally

### Internal Endpoints (STK Push Initiation)

**Format**: Standard MicroBima error response format (from `StandardErrorResponseDto`)
```json
{
  "error": {
    "code": "ERROR_CODE",
    "status": 422,
    "message": "Human-readable error message",
    "details": {
      "field_name": "Field-specific error message"
    },
    "correlationId": "req-12345-67890",
    "timestamp": "2025-01-27T14:30:45.123Z",
    "path": "/api/internal/mpesa/stk-push/initiate"
  }
}
```

**HTTP Status Codes**:
- `201 Created` - STK Push request created successfully
- `400 Bad Request` - Malformed request payload
- `401 Unauthorized` - Missing or invalid Bearer token
- `422 Unprocessable Entity` - Validation error (invalid phone number, amount out of range, account reference not found, etc.)
- `429 Too Many Requests` - Rate limit exceeded (M-Pesa API rate limiting)
- `500 Internal Server Error` - Server error

**Error Codes**: Use existing error codes from `ErrorCodes` enum (VALIDATION_ERROR, NOT_FOUND, etc.)

## HTTP Status Codes

### Public Callback Endpoints

- **200 OK**: Always returned (even on errors, per FR-016)

### Internal Endpoints

- **201 Created**: STK Push request created successfully
- **400 Bad Request**: Malformed request payload
- **401 Unauthorized**: Missing or invalid Bearer token
- **422 Unprocessable Entity**: Validation error
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

**Note**: Status codes are documented in both `spec.md` and `contracts/mpesa-ipn-stk-push-api.yaml` for consistency. When updating status codes, ensure both files are updated.

## Glossary

### Ambiguous Terms

**"Appropriate error responses"** (FR-014):
- For public callbacks: M-Pesa format (ResultCode, ResultDesc), but FR-016 overrides to always return success
- For internal endpoints: Standard error response format with status code

**"Manual recovery"** (FR-016):
- Process: Operations team reviews error logs, identifies failed transactions, takes corrective action (retry, fix data, contact support)
- Information needed: Correlation ID, transaction details, error type, timestamp
- Tools: Error logs with searchable correlation IDs
- Reference: See logging requirements (CHK007, CHK025) for detailed logging format

## Assumptions

### Verified Facts

**OAuth Token Expiry**: OAuth tokens expire after 3600 seconds (1 hour) - from M-Pesa authorization documentation

**Error Response Strategy**: System returns success (ResultCode: 0) to prevent M-Pesa retries - from spec clarifications

**Signature Verification**: Signature verification not available (no documentation available) - from research.md

### Assumptions (To Be Verified)

**Note**: These assumptions require verification from M-Pesa official documentation. Access to M-Pesa documentation portal will be used to verify these assumptions.

- **Callback delivery**: M-Pesa will attempt to deliver callbacks; delivery is not guaranteed (may be delayed or lost)
- **STK Push timeout**: STK Push requests expire after ~5 minutes if customer doesn't complete (needs verification)
- **IPN timing**: IPN may arrive before or after STK Push callback (needs verification)
- **Idempotency**: M-Pesa may send duplicate callbacks; system handles idempotently (needs verification)
- **Rate limits**: M-Pesa API rate limiting behavior (needs research)
- **Availability**: M-Pesa API availability and SLA (needs research)

**Data Availability Assumptions**:
- Account references in IPN/STK Push are assumed to match existing policy payment account numbers
- Unmatched references: If account reference doesn't match any policy, payment record is created but remains unlinked (handled in edge cases)
- Validation: STK Push initiation validates account reference exists; IPN processing does not validate (creates record anyway, uses same validation logic as XLS statement processing when no STK Push match)

**Infrastructure Dependencies**:
- Database: PostgreSQL database (via Prisma ORM) - required for all operations
- Configuration service: ConfigurationService (NestJS) - required for M-Pesa API credentials and settings
- Logging: NestJS Logger - required for error logging and observability
- External services: M-Pesa Daraja API - required for STK Push initiation

## Performance Requirements

### High-Load Scenarios

**Concurrent IPN Processing**: System MUST handle at least 10 concurrent IPN notifications

**Queue Behavior**: If system is overloaded, requests MUST be queued (not rejected)

**Degradation**: Under high load, processing time may exceed 2 seconds, but system MUST not crash

**Monitoring**: Alert if concurrent request count exceeds threshold (e.g., 20 concurrent)

### Performance Degradation

**Under Load**: System MUST queue incoming requests rather than reject

**Processing Priority**: Process requests in order (FIFO)

**Timeout Warning**: If request is queued for more than 30 seconds, log warning

**Response**: Still return success to M-Pesa even if processing is delayed

**Monitoring**: Alert when queue depth exceeds threshold (e.g., 50 queued requests)

**Metrics**: Track queue depth as a metric for monitoring

## Security Requirements

### IP Whitelist Validation

**IP Whitelist Failure Response**:
- Return success (ResultCode: 0) to M-Pesa to prevent retries
- Log security violation as ERROR level with: IP address, timestamp, endpoint, request payload (sanitized)
- Alert security team (if monitoring system configured)
- Do NOT process the request
- Track security violations as a metric counter

**Response**: Return standard success response to M-Pesa (don't reveal security check failed)

### Security-Related Error Handling

**Internal Endpoints** (STK Push initiation):
- Log full security error details (IP, reason, timestamp)
- Return generic error: "Unauthorized" (403 Forbidden) with additional context
- Do NOT expose why security check failed
- Track security-related errors as metrics

**Public Callbacks** (IPN, STK Push callback):
- Log full security error details
- Return success (ResultCode: 0) to M-Pesa (don't reveal security check)
- Do NOT process the request

## Deferred Decisions

### STK Push Callback Status Mismatch (TODO)

**Scenario**: If IPN arrives and matches a PENDING STK Push request, creates payment records in both `MpesaPaymentReportItem` and `policy_payments`, updates STK Push status. Later, STK Push callback arrives with FAILED or CANCELLED status.

**Question**: How should the system handle this scenario?

**Options to Consider**:
1. Reverse the payment record creation (delete/void the payment)
2. Mark payment record with a flag indicating status mismatch
3. Log warning and require manual review
4. Other approach

**Status**: Decision deferred, tracked in both `spec.md` and `tasks.md`

**Impact**: This edge case needs resolution before production deployment

### Data Protection Requirements (Deferred)

**Note**: Data protection requirements (encryption at rest, masking in logs, access controls, data retention) are deferred for later implementation after core functionality is working.

**Current State**:
- HTTPS in transit: Required (TLS 1.2+)
- Encryption at rest: Not required now
- Masking in logs: Not required now
- Access control: Not implemented yet
- Data retention: Not implemented yet

**Status**: Tracked for future implementation
