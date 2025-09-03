# ADR 001: Entity-DTO Mapping Strategy

## Status
Accepted

## Context
We need to establish a clear strategy for mapping between:
- **Prisma Models** (database representation)
- **Entity Classes** (internal domain objects)
- **DTOs** (external API contracts)

## Decision
We will use a **hybrid approach** with the following rules:

### Prisma Models → Entity Classes
- **Full Mapping**: All Prisma fields must be represented in Entity classes
- **Same data types**: Maintain type consistency
- **Business logic**: Add computed properties and business methods

### Entity Classes → DTOs
- **Selective Mapping**: Not all entity fields exposed in DTOs
- **Different Naming**: Use external naming conventions (e.g., `lastName` → `surName`)
- **Type Transformation**: Convert internal types to external types (e.g., `Date` → `string`)

### DTOs → External API
- **Exact Match**: What customers see matches DTO structure
- **Validation**: Enforce validation rules via class-validator
- **Documentation**: Auto-generate Swagger docs from DTOs

## Consequences

### Positive
- Clear separation of concerns
- Type safety throughout the stack
- Consistent external API contracts
- Maintainable business logic

### Negative
- More code to maintain
- Need for mapping classes
- Potential for sync issues

### Mitigation
- Automated tests for mapping
- Clear documentation
- Regular sync reviews
