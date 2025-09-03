# Microbima – Project Rules for AI (Cursor)


## Monorepo shape
- Single-root monorepo.
- Apps live in `apps/*` (e.g., `web-admin`, `mobile`, `api`).
- Shared code in `packages/*` (e.g., `sdk`, `ui`, `core`).
- Infra in `infra/*`.


## Source of truth for API contracts
- OpenAPI spec at `openapi/microbima.yaml` (or backend URL like `http://localhost:8000/openapi.json`).
- Always import request/response types from `@microbima/sdk`.
- Never use server-only/DB (Prisma) types in client code.


## Generated SDK
- Generate TS client + types with `openapi-typescript-codegen`.
- Output to `packages/sdk/src/gen`.
- Public entrypoint is `packages/sdk/src/index.ts`.
- Treat `src/gen` as **generated – do not edit**.


## Preferred imports
```ts
import { PoliciesService, type Policy } from "@microbima/sdk";
```

## Naming Conventions

### Database/Prisma Level
- **Table names**: `snake_case` (e.g., `customers`, `partner_customers`)
- **Column names**: `camelCase` (e.g., `firstName`, `dateOfBirth`, `createdAt`)
- **Enum values**: `SCREAMING_SNAKE_CASE` (e.g., `PENDING_KYC`, `ACTIVE`)

### Entity Classes (Internal Domain)
- **Class names**: `PascalCase` (e.g., `Customer`, `PrincipalMember`)
- **Property names**: `camelCase` (e.g., `firstName`, `dateOfBirth`)
- **Method names**: `camelCase` (e.g., `isEligible()`, `calculateAge()`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_AGE`, `MIN_PREMIUM`)

### DTOs (External API)
- **Class names**: `PascalCase` + `Dto` suffix (e.g., `PrincipalMemberDto`)
- **Property names**: `camelCase` (e.g., `firstName`, `lastName` - consistent naming)

## Synchronization Strategy
- **Hybrid approach**: Manual mapping for complex cases, auto-generated for simple cases
- **Prisma Models → Entity Classes**: All fields must be represented
- **Entity Classes → DTOs**: Selective mapping with different naming
- **DTOs → External API**: Exact match for customer-facing contracts

## Entity Design Patterns

### Entity Properties
- **Option A (Full Mapping)**: Include ALL Prisma fields in entities
- **Consistency**: All data available for business logic
- **Type safety**: No missing fields, complete type coverage

### Business Logic Methods
- **Include in entities**: Domain-specific operations that belong to the entity
- **Examples**: `get fullName()`, `get age()`, `isEligibleForInsurance()`, `canAddDependant()`
- **Purpose**: Encapsulation, reusability, testability, domain modeling

### Validation Methods
- **Server-side validation**: Methods that validate before database save
- **Examples**: `validateBeforeSave()`, `validateBusinessRules()`
- **Purpose**: Prevent invalid data from reaching database, enforce business rules

### Database Operations
- **❌ DON'T put in entities**: Database-specific logic (save, update, find)
- **✅ DO put in services**: Use service layer for database operations
- **Purpose**: Single responsibility, testability, dependency inversion