# Research: M-Pesa Daraja IPN and STK Push Integration

**Feature**: M-Pesa Daraja IPN and STK Push Integration  
**Date**: 2025-01-27  
**Status**: Complete

## Research Tasks

### 1. M-Pesa Daraja API Integration Patterns

**Task**: Research M-Pesa Daraja API integration patterns for IPN and STK Push

**Decision**: Use standard REST API integration with OAuth 2.0 authentication, following M-Pesa Daraja API documentation patterns.

**Rationale**: 
- M-Pesa Daraja API uses OAuth 2.0 for authentication (access tokens)
- STK Push uses `/stkpush/v1/processrequest` endpoint
- IPN uses confirmation callback endpoint pattern
- Standard HTTP POST requests with JSON payloads
- Follows existing NestJS HTTP client patterns in the codebase

**Alternatives Considered**:
- GraphQL API: Not available for M-Pesa Daraja API
- WebSocket: Not supported by M-Pesa for callbacks
- Message Queue: Overkill for direct API integration

**References**:
- M-Pesa Daraja API documentation
- Existing authorization.txt documentation in `dev_docs/mpesa_documentation/`

### 2. Security Mechanisms for Public Callback Endpoints

**Task**: Research security mechanisms for public callback endpoints that cannot use API key authentication

**Decision**: Implement both IP whitelist validation and signature verification (pending Safaricom documentation confirmation).

**Rationale**:
- Industry best practice for payment gateway callbacks
- Defense in depth approach (multiple security layers)
- IP whitelisting prevents unauthorized access from non-M-Pesa sources
- Signature verification ensures request authenticity even if IP is spoofed

**Alternatives Considered**:
- IP whitelist only: Less secure, vulnerable to IP spoofing
- Signature verification only: More complex, requires shared secret management
- URL obscurity: Not secure, easily discovered

**Implementation Notes**:
- Official Safaricom IP address ranges must be obtained from Safaricom documentation or support
- Signature verification algorithm and shared secret mechanism must be confirmed with Safaricom
- Tracked as external dependency in `tasks.md`

**References**:
- Web search results confirming IP whitelisting and signature verification as best practices
- Industry standards for payment gateway security

### 3. Phone Number Normalization Strategy

**Task**: Research phone number normalization for matching between STK Push and IPN transactions

**Decision**: Normalize to international format (254XXXXXXXXX) - strip leading zeros, ensure country code.

**Rationale**:
- M-Pesa Daraja API uses international format (254XXXXXXXXX) in IPN payloads
- Consistent format enables reliable matching
- Strips leading zeros and ensures country code presence
- Matches existing phone number handling patterns in the codebase

**Alternatives Considered**:
- Local format (07XXXXXXXX): Inconsistent with M-Pesa API format
- Store both formats: Unnecessary complexity, storage overhead
- No normalization: Matching failures due to format inconsistencies

**Implementation**:
- Normalize phone numbers on input (STK Push initiation)
- Normalize phone numbers from IPN payloads (MSISDN field)
- Store normalized format in database
- Use normalized format for all matching operations

### 4. Amount Matching Tolerance

**Task**: Research amount matching tolerance for linking STK Push requests to IPN transactions

**Decision**: Exact match only (0.00 tolerance).

**Rationale**:
- M-Pesa transactions are exact amounts (no rounding differences in practice)
- Exact matching prevents false positives
- Simplifies matching logic
- Aligns with specification clarification

**Alternatives Considered**:
- ±0.01 KES tolerance: Unnecessary, M-Pesa doesn't have rounding differences
- ±0.10 KES tolerance: Too permissive, could cause false matches
- Percentage-based tolerance: Complex, unnecessary for exact amounts

### 5. Error Response Strategy for M-Pesa Callbacks

**Task**: Research error response strategy for M-Pesa callback endpoints

**Decision**: Return success (ResultCode: 0) to M-Pesa even on validation/database failures, log errors internally.

**Rationale**:
- Prevents M-Pesa from retrying failed notifications
- Avoids duplicate processing attempts
- Enables manual investigation and recovery
- Industry standard practice for payment gateway callbacks

**Alternatives Considered**:
- Return error to trigger retries: Causes duplicate processing, data integrity issues
- Conditional error responses: Complex logic, still risks duplicates
- Queue for retry: Over-engineered, manual recovery is sufficient

### 6. Retry Strategy for M-Pesa API Calls

**Task**: Research retry strategy for failed M-Pesa Daraja API calls

**Decision**: Retry up to 3 times with exponential backoff (1s, 2s, 4s delays).

**Rationale**:
- Handles transient network errors
- Exponential backoff prevents overwhelming M-Pesa API
- 3 retries balances reliability with performance
- Standard pattern for external API integrations

**Alternatives Considered**:
- No retry: Too fragile, fails on transient errors
- Infinite retry: Could cause system overload
- Fixed delay retry: Less efficient than exponential backoff

### 7. Database Schema Design for IPN and STK Push

**Task**: Research database schema design patterns for payment transaction tracking

**Decision**: Extend existing `MpesaPaymentReportItem` model, create new `MpesaStkPushRequest` model, add enums for source and status.

**Rationale**:
- Reuses existing payment record structure
- Maintains consistency with current data model
- Enables deduplication logic (IPN vs STATEMENT source)
- Tracks STK Push lifecycle separately from payment records
- Follows Prisma schema patterns in codebase

**Alternatives Considered**:
- Separate tables for IPN and statement records: Duplication, harder to query
- Single table with type discriminator: Less flexible, harder to extend
- Event sourcing: Over-engineered for current requirements

**Schema Decisions**:
- Make `mpesaPaymentReportUploadId` nullable (IPN records don't have uploads)
- Add `source` enum to distinguish IPN vs STATEMENT records
- Add customer name fields (firstName, middleName, lastName) from IPN
- Add `msisdn` field for phone number storage
- Create `MpesaStkPushRequest` model for STK Push lifecycle tracking
- Link STK Push requests to payment records via foreign key

### 8. Statement Upload Deduplication Strategy

**Task**: Research deduplication strategy for statement uploads against IPN records

**Decision**: Check for existing IPN records by transaction reference and source before creating statement records.

**Rationale**:
- Prevents duplicate payment records
- IPN is primary source (real-time, more accurate)
- Statement uploads fill gaps only
- Simple query-based deduplication
- Maintains data integrity

**Alternatives Considered**:
- Merge records: Complex, loses source tracking
- Delete IPN records on statement match: Wrong priority (IPN is primary)
- Flag duplicates: Doesn't prevent creation, adds complexity

**Implementation**:
- Query: `findFirst({ where: { transactionReference, source: 'IPN' } })`
- If IPN record exists: Skip statement record creation, increment match counter
- If no IPN record: Create statement record with `source = 'STATEMENT'`
- Return statistics: total items, matched IPN records, gaps filled

## External Dependencies

### Safaricom Documentation Required

1. **IP Address Ranges**
   - Production environment IP ranges
   - Sandbox environment IP ranges
   - IP range update notification process

2. **Signature Verification**
   - Algorithm (HMAC-SHA256, etc.)
   - Shared secret/key mechanism
   - Signature format and location in callback payload
   - Signature generation/verification process

**Status**: Tracked in `tasks.md` as blocking dependencies  
**Contact**: apisupport@safaricom.co.ke or Safaricom Developer Portal support

## Technology Choices

### NestJS HTTP Client
- **Decision**: Use `@nestjs/axios` or native `fetch` API
- **Rationale**: NestJS standard, supports interceptors, error handling
- **Status**: To be determined during implementation (check existing patterns)

### Date/Time Handling
- **Decision**: Use UTC for all date operations, parse M-Pesa TransTime format (YYYYMMDDHHmmss)
- **Rationale**: Constitution requirement, prevents timezone bugs
- **Implementation**: Use `Date.UTC()` and UTC methods for all date operations

### Phone Number Normalization Library
- **Decision**: Implement custom normalization function
- **Rationale**: Simple requirement (strip leading zeros, ensure country code), no need for external library
- **Implementation**: Regex-based normalization to 254XXXXXXXXX format

## Open Questions Resolved

All critical questions resolved through specification clarifications:
- ✅ Security mechanisms (IP whitelist + signature verification)
- ✅ Amount matching tolerance (exact match)
- ✅ Phone number normalization (international format)
- ✅ Error response strategy (return success, log internally)
- ✅ Retry strategy (3 retries with exponential backoff)
- ✅ Amount limits (M-Pesa standard: 1-70,000 KES)
- ✅ Database failure handling (return success, log for recovery)

## Next Steps

1. Obtain Safaricom IP address ranges and signature verification details
2. Proceed with Phase 1 design (data model, contracts, quickstart)
3. Implement schema changes
4. Implement services and controllers
5. Add security middleware
6. Update statement upload service

