# ADR 003: Entity Design Patterns

## Status
Accepted

## Context
We need to establish clear patterns for entity design to ensure consistency and maintainability across our domain objects.

## Decision
We will follow these entity design patterns:

### Entity Properties
- **Full Mapping**: Include ALL Prisma fields in entities
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

## Consequences

### Positive
- Clear separation of concerns
- Testable business logic
- Maintainable codebase
- Domain-driven design principles

### Negative
- More classes to maintain
- Need to understand patterns
- Potential for over-engineering

### Mitigation
- Clear examples
- Code templates
- Regular reviews
