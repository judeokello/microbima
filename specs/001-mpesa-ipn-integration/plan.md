# Implementation Plan: M-Pesa Daraja IPN and STK Push Integration

**Branch**: `001-mpesa-ipn-integration` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-mpesa-ipn-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Integrate M-Pesa Daraja API Instant Payment Notification (IPN) as the primary transaction data source and M-Pesa Express (STK Push) for agent-initiated payments. The system will process IPN notifications in real-time to create payment records immediately, enable agents to initiate STK Push payment requests, and use statement uploads as a secondary source for gap filling when IPN records are missing. Technical approach: Extend existing Prisma schema with new enums and models, create NestJS services for IPN and STK Push processing, implement public callback endpoints with IP whitelist security measures, and update statement upload service to deduplicate against IPN records.

## Technical Context

**Language/Version**: TypeScript 5.3.x  
**Primary Dependencies**: NestJS 11.x, Prisma 6.x, Express  
**Storage**: PostgreSQL (via Prisma ORM)  
**Testing**: Jest (NestJS testing framework)  
**Target Platform**: Node.js >= 18.0.0 (Linux server, Fly.io deployment)  
**Project Type**: Web application (monorepo with NestJS backend API)  
**Performance Goals**: 
- Process 95% of IPN notifications within 2 seconds (SC-001)
- Link 90% of STK Push-initiated payments to IPN transactions within 24 hours (SC-002)
- 99.9% IPN processing success rate (SC-004)
- Payment records available for querying within 5 seconds of receipt (SC-007)
**Constraints**: 
- Public callback endpoints cannot require API key authentication (M-Pesa requirement)
- Must implement IP whitelist validation for security (signature verification removed - no documentation available)
- Must return success (ResultCode: 0) to M-Pesa even on validation/database failures to prevent retries
- Phone numbers must be normalized to international format (254XXXXXXXXX)
- Amount matching must be exact (0.00 tolerance)
- STK Push amount limits: 1-70,000 KES per transaction
**Scale/Scope**: 
- Real-time payment processing for insurance premium collections
- Agent-initiated payment requests
- Statement upload deduplication against IPN records
- Integration with existing M-Pesa payment infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. API-First Architecture ✅
- **Compliance**: All functionality exposed via REST APIs (NestJS Internal API)
- **Endpoints**: 
  - Internal: `POST /api/internal/mpesa/stk-push/initiate` (agent-initiated STK Push)
  - Public: `POST /api/public/mpesa/confirmation` (IPN callback)
  - Public: `POST /api/public/mpesa/stk-push/callback` (STK Push callback)
- **Status**: ✅ PASS - Follows API-first architecture

### II. Database Standards ✅
- **Compliance**: Using Prisma migrations (`npx prisma migrate dev --name add_mpesa_ipn_and_stk_push`)
- **Date/Time**: All dates stored in UTC, using UTC methods for operations
- **Status**: ✅ PASS - Follows database standards

### III. Error Handling Standards ✅
- **Compliance**: 
  - Using standardized error response format with `status` field
  - Using `ValidationException` for validation errors
  - Checking `ErrorCodes` enum before creating new codes
  - Returning success to M-Pesa even on failures (prevents retries)
  - Including correlation IDs in responses
- **Status**: ✅ PASS - Follows error handling standards

### IV. Code Quality ✅
- **Compliance**: 
  - Using nullish coalescing (`??`) for default values
  - TypeScript strict mode
  - Running `pnpm lint` after modifications
  - Person entities use `firstName`, `middleName`, `lastName` (in that order)
- **Status**: ✅ PASS - Follows code quality standards

### V. Development Workflow ✅
- **Compliance**: Feature branch from `development`, PRs to `staging` for auto-deploy
- **Status**: ✅ PASS - Follows development workflow

### VI. Technology Constraints ✅
- **Compliance**: 
  - Node.js >= 18.0.0
  - pnpm >= 8.0.0
  - PostgreSQL database
  - NestJS 11.x
  - Prisma 6.x
  - TypeScript 5.3.x
- **Status**: ✅ PASS - Meets all technology constraints

### VII. Security ✅
- **Compliance**: 
- IP whitelist validation for callback endpoints (localhost/development IPs allowed for testing)
  - Public endpoints excluded from API key auth (M-Pesa requirement)
  - Internal endpoints require authentication
- **Status**: ✅ PASS - Implements required security measures

### VIII. Monitoring & Observability ✅
- **Compliance**: 
  - Correlation IDs for request tracing
  - Error logging for investigation
  - Sentry integration (existing)
  - External instrumentation calls asynchronous
- **Status**: ✅ PASS - Follows monitoring standards

**Overall Gate Status**: ✅ **PASS** - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-mpesa-ipn-integration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/
├── prisma/
│   └── schema.prisma                    # Schema updates (enums, models, migrations)
├── src/
│   ├── services/
│   │   ├── mpesa-ipn.service.ts        # NEW: IPN notification processing
│   │   ├── mpesa-stk-push.service.ts    # NEW: STK Push request handling
│   │   └── mpesa-payments.service.ts    # UPDATE: Statement deduplication logic
│   ├── controllers/
│   │   ├── public/
│   │   │   ├── mpesa-ipn.controller.ts # NEW: Public IPN callback endpoint
│   │   │   └── mpesa-stk-push.controller.ts # NEW: Public STK Push callback endpoint
│   │   └── internal/
│   │       └── mpesa-stk-push.controller.ts # NEW: Internal STK Push initiation (includes test endpoint)
│   ├── dto/
│   │   ├── mpesa-ipn/
│   │   │   └── mpesa-ipn.dto.ts         # NEW: IPN payload DTOs
│   │   └── mpesa-stk-push/
│   │       └── mpesa-stk-push.dto.ts    # NEW: STK Push DTOs
│   ├── middleware/
│   │   └── api-key-auth.middleware.ts   # UPDATE: Exclude public callback endpoints
│   ├── config/
│   │   └── configuration.service.ts     # UPDATE: Add M-Pesa Daraja API config
│   └── app.module.ts                    # UPDATE: Register new controllers/services
└── tests/
    ├── unit/
    │   ├── mpesa-ipn.service.spec.ts   # NEW: IPN service tests
    │   └── mpesa-stk-push.service.spec.ts # NEW: STK Push service tests
    └── integration/
        └── mpesa-callbacks.e2e-spec.ts # NEW: Callback endpoint tests
```

**Structure Decision**: Extending existing NestJS monorepo structure. New services and controllers follow existing patterns. Public controllers (IPN callback, STK Push callback) placed in `controllers/public/` directory for M-Pesa webhooks. Internal controllers (STK Push initiation, test endpoint) placed in `controllers/internal/` directory for authenticated agent operations. DTOs organized by feature domain. Tests mirror source structure.

## Complexity Tracking

> **No violations detected** - Implementation follows all constitution principles without requiring justification for complexity.

## Phase 0: Research Complete ✅

**Status**: Complete  
**Output**: `research.md`

All research tasks completed:
- ✅ M-Pesa Daraja API integration patterns
- ✅ Security mechanisms for public callbacks
- ✅ Phone number normalization strategy
- ✅ Amount matching tolerance
- ✅ Error response strategy
- ✅ Retry strategy
- ✅ Database schema design
- ✅ Statement upload deduplication strategy

**External Dependencies Identified**:
- Safaricom IP address ranges (tracked in `tasks.md`)
- **Note**: Signature verification removed - no Safaricom documentation available. Security relies on IP whitelist only.

## Phase 1: Design Complete ✅

**Status**: Complete  
**Outputs**: 
- `data-model.md` - Complete entity definitions, relationships, validation rules
- `contracts/mpesa-ipn-stk-push-api.yaml` - OpenAPI 3.0 specification
- `quickstart.md` - Implementation quick start guide

**Design Decisions**:
- ✅ Extended existing `MpesaPaymentReportItem` model (backward compatible)
- ✅ Created new `MpesaStkPushRequest` model for lifecycle tracking
- ✅ Added enums for source and status classification
- ✅ Defined API contracts for all endpoints
- ✅ Documented data flow and matching logic

**Next Steps**: Proceed to `/speckit.tasks` to break down implementation into tasks.
