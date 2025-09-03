# ADR 002: Naming Conventions

## Status
Accepted

## Context
We need consistent naming conventions across different layers of our application to ensure maintainability and clarity.

## Decision
We will use the following naming conventions:

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
- **Property names**: `camelCase` (e.g., `firstName`, `surName` - external naming)

## Consequences

### Positive
- Consistent codebase
- Clear distinction between layers
- Easy to understand and maintain
- Follows TypeScript/JavaScript conventions

### Negative
- Need to remember different conventions
- Potential for confusion between layers

### Mitigation
- Clear documentation
- Code examples
- Linting rules
