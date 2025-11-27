<!--
Sync Impact Report:
Version: 0.0.0 → 1.0.0 (MAJOR - Initial constitution creation)
Modified Principles: N/A (new document)
Added Sections:
  - Project Purpose
  - Core Principles (8 principles)
  - Technology Constraints
  - Security Requirements
  - Monitoring & Observability
  - Project Structure
  - Key Business Rules
  - Governance
Removed Sections: N/A (new document)
Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section aligns with principles
  ✅ spec-template.md - No direct constitution references, compatible
  ✅ tasks-template.md - No direct constitution references, compatible
Follow-up TODOs: None
-->

# MicroBima Constitution

## Project Purpose

MicroBima is a modern API-first micro-insurance platform designed for flexible products, fast onboarding, and robust partner integrations in the African market.

## Core Principles

### I. API-First Architecture

All functionality MUST be accessible via REST APIs. The Internal API (NestJS) serves as the single source of truth. Public APIs are exposed through Kong Gateway. Agent Registration portal (Next.js) and other frontend applications consume internal APIs. This ensures consistent data access patterns and enables multiple client applications to share the same backend services.

### II. Database Standards (NON-NEGOTIABLE)

**NEVER** use `npx prisma db push` for tracked databases (development, staging, production). **ALWAYS** use proper migrations: `npx prisma migrate dev --name descriptive_name` for development (creates and applies migration) or `npx prisma migrate deploy` for production (applies pending migrations only). Only use `db push` for throwaway/prototype databases that don't need migration tracking. All dates/times MUST be stored in UTC. Use UTC methods (`setUTCHours`, `Date.UTC()`) for all date operations to prevent timezone conversion bugs.

### III. Error Handling Standards

Use standardized error response format with `status` field (NOT `statusCode`). Use `ValidationException` for validation errors. Check `ErrorCodes` enum before creating new error codes. Collect ALL validation errors before throwing (pre-save validation pattern). Include correlation IDs in all error responses. This ensures consistent error handling across all endpoints and enables better debugging and monitoring.

### IV. Code Quality

Use nullish coalescing (`??`) instead of logical OR (`||`) for default values to prevent bugs where falsy values (0, '', false) are incorrectly replaced with defaults. Follow TypeScript strict mode. Run `pnpm lint` after every TypeScript/JavaScript modification. Person entities MUST use: `firstName`, `middleName`, `lastName` (in that order). These standards prevent common bugs and ensure code consistency.

### V. Development Workflow

Monorepo structure with Turbo. Feature branches from `development`. PRs to `staging` (auto-deploys to Fly.io). PRs to `production` for releases. Run tests automatically before committing. This workflow ensures code quality and enables safe, incremental deployments.

### VI. Technology Constraints

Node.js >= 18.0.0, pnpm >= 8.0.0, PostgreSQL database, NestJS 11.x for backend, Prisma 6.x for ORM, TypeScript 5.3.x. These constraints ensure compatibility and maintainability across the project.

### VII. Security

OIDC/OAuth2 authentication via Authentik. API key authentication for partner APIs. Role-based access control. Encrypted data at rest and in transit. These security measures protect sensitive customer and business data.

### VIII. Monitoring & Observability

Sentry for error tracking. Correlation IDs for request tracing. External instrumentation calls MUST be asynchronous (message queue preferred) to avoid impacting service performance. This enables effective debugging and performance monitoring without degrading user experience.

## Technology Constraints

- **Runtime**: Node.js >= 18.0.0
- **Package Manager**: pnpm >= 8.0.0
- **Database**: PostgreSQL
- **Backend Framework**: NestJS 11.x
- **ORM**: Prisma 6.x
- **Language**: TypeScript 5.3.x

## Security Requirements

- **Authentication**: OIDC/OAuth2 via Authentik
- **API Security**: API key authentication for partner APIs
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encrypted at rest and in transit
- **Audit Logging**: Comprehensive activity tracking

## Development Workflow

- **Monorepo**: Turbo-based monorepo structure
- **Branching**: Feature branches from `development`
- **Staging**: PRs to `staging` branch (auto-deploys to Fly.io)
- **Production**: PRs to `production` branch for releases
- **Testing**: Run tests automatically before committing
- **Linting**: Run `pnpm lint` after every TypeScript/JavaScript modification

## Project Structure

- `apps/api/` - NestJS Internal API
- `apps/agent-registration/` - Next.js Agent Registration Portal
- `apps/web-admin/` - Admin Dashboard
- `apps/mobile/` - React Native Mobile App
- `packages/sdk/` - Generated TypeScript SDK
- `packages/common-config/` - Shared configuration
- `docs/` - Documentation
- `infra/fly/` - Fly.io deployment configs

## Key Business Rules

- Customers can have multiple dependants and beneficiaries
- Policies support flexible payment frequencies (daily, weekly, monthly, etc.)
- Partner API keys are SHA-256 hashed
- Agent registrations track brand ambassadors and payouts
- KYC verification required before policy activation

## Governance

This constitution supersedes all other development practices and coding standards. All PRs and code reviews MUST verify compliance with these principles. Amendments to this constitution require:

1. **Documentation**: Clear rationale for the change
2. **Approval**: Team consensus or designated authority approval
3. **Migration Plan**: If the change affects existing code, a migration plan must be provided
4. **Version Update**: Constitution version must be incremented according to semantic versioning:
   - **MAJOR**: Backward incompatible governance/principle removals or redefinitions
   - **MINOR**: New principle/section added or materially expanded guidance
   - **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

Complexity introduced that violates principles MUST be justified in code reviews with explicit reasoning for why simpler alternatives were rejected.

**Version**: 1.0.0 | **Ratified**: 2025-11-27 | **Last Amended**: 2025-11-27
