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

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST receive and process Instant Payment Notification (IPN) payloads from M-Pesa Daraja API in real-time
- **FR-002**: System MUST create payment records immediately upon receiving IPN notifications with transaction details, customer information, and account references
- **FR-003**: System MUST handle duplicate IPN notifications idempotently by updating existing records instead of creating duplicates
- **FR-004**: System MUST link IPN transactions to STK Push requests automatically when account reference, normalized phone number (international format 254XXXXXXXXX), exact amount match (0.00 tolerance), and time window match
- **FR-005**: System MUST allow agents to initiate STK Push payment requests with customer phone number, amount, and policy account reference, and MUST retry failed M-Pesa API calls up to 3 times with exponential backoff (1s, 2s, 4s delays) before marking the request as failed
- **FR-006**: System MUST track STK Push request status (pending, completed, failed, cancelled, expired) and update status based on M-Pesa callbacks
- **FR-007**: System MUST store STK Push request details including checkout request ID, merchant request ID, result codes, and timestamps
- **FR-008**: System MUST process STK Push callback notifications from M-Pesa and update request status accordingly
- **FR-009**: System MUST check for existing IPN records before creating payment records from statement uploads
- **FR-010**: System MUST skip creating duplicate records when statement transactions match existing IPN records
- **FR-011**: System MUST create payment records from statement uploads only for transactions not found in IPN data (gap filling)
- **FR-012**: System MUST mark payment records with their data source (IPN or STATEMENT) to distinguish origin
- **FR-013**: System MUST provide statistics on statement uploads including total items, matched IPN records, and gaps filled
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
- **FR-022**: System MUST support matching STK Push requests to IPN transactions within a 24-hour time window

### Key Entities *(include if feature involves data)*

- **Payment Record**: Represents a single M-Pesa transaction with transaction reference, timestamps, amounts, customer information, account reference, and data source (IPN or STATEMENT). Can be linked to a STK Push request and may or may not be linked to a statement upload.

- **STK Push Request**: Represents an agent-initiated payment request with customer phone number, amount, account reference, status tracking, and linkage to resulting payment transaction. Tracks the lifecycle from initiation through completion or failure.

- **Payment Source**: Classification indicating whether a payment record originated from real-time IPN notification or manual statement upload, enabling data quality tracking and deduplication logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: System processes 95% of IPN notifications within 2 seconds of receipt, creating payment records immediately
- **SC-002**: System successfully links 90% of STK Push-initiated payments to their corresponding IPN transactions automatically within 24 hours
- **SC-003**: Statement upload deduplication prevents 100% of duplicate records when IPN data already exists for transactions
- **SC-004**: System handles IPN notification processing with 99.9% success rate (excluding invalid payloads from M-Pesa)
- **SC-005**: Agents can initiate STK Push requests and receive status updates within 30 seconds of customer action
- **SC-006**: System provides accurate gap-filling statistics showing matched IPN records and newly created statement records
- **SC-007**: Payment records are available for querying and reporting within 5 seconds of IPN notification receipt
- **SC-008**: System maintains data integrity with zero duplicate payment records when both IPN and statement data exist for the same transaction
