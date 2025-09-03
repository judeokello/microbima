# Coding Standards

## Overview
This document outlines the coding standards and best practices for the MicroBima project.

## TypeScript Standards

### General Rules
- Use TypeScript strict mode
- Prefer `const` over `let` when possible
- Use `interface` for object shapes, `type` for unions/intersections
- Always specify return types for public methods

### Naming Conventions
See [Naming Conventions ADR](../architecture/decisions/002-naming-conventions.md)

### File Organization
```
src/
├── dto/           # External API contracts
├── entities/      # Internal domain objects
├── services/      # Business logic and data access
├── controllers/   # HTTP request handlers
├── mappers/       # DTO ↔ Entity transformations
└── common/        # Shared utilities
```

## Entity Design

### Structure
```typescript
export class Customer {
  // 1. Properties (all Prisma fields)
  id: string;
  firstName: string;
  lastName: string;
  
  // 2. Computed properties
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
  
  // 3. Business logic methods
  isEligibleForInsurance(): boolean {
    return this.age >= 18 && this.status === CustomerStatus.ACTIVE;
  }
  
  // 4. Validation methods
  validateBeforeSave(): ValidationResult {
    // Implementation
  }
}
```

### Rules
- Include ALL Prisma fields as properties
- Add computed properties for derived data
- Include business logic methods
- Include validation methods
- ❌ NO database operations in entities

## DTO Design

### Structure
```typescript
export class PrincipalMemberDto {
  @ApiProperty({ description: 'First name' })
  @IsString()
  @IsNotEmpty()
  firstName: string;
  
  @ApiProperty({ description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  surName: string; // Note: external naming
}
```

### Rules
- Use `@ApiProperty()` for Swagger documentation
- Use `@Is*()` decorators for validation
- Follow external naming conventions
- Include only fields needed for API

## Service Design

### Structure
```typescript
@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}
  
  async create(customer: Customer): Promise<Customer> {
    // Business logic
    const validation = customer.validateBeforeSave();
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // Database operation
    const data = await this.prisma.customer.create({
      data: customer.toPrismaData()
    });
    
    return new Customer(data);
  }
}
```

### Rules
- Handle database operations
- Call entity validation methods
- Transform between entities and Prisma data
- Handle business logic coordination

## Error Handling

### Standard Error Response
```typescript
{
  status: number;
  correlationId?: string;
  error: string;
  message: string;
  details?: Record<string, any>;
}
```

### Success Response
```typescript
{
  status: number;
  correlationId?: string;
  message?: string;
  data?: any;
}
```

## Testing Standards

### Unit Tests
- Test entity business logic methods
- Test validation methods
- Test service methods
- Mock external dependencies

### Integration Tests
- Test DTO validation
- Test API endpoints
- Test database operations

## Documentation

### Code Comments
- Use JSDoc for public methods
- Explain complex business logic
- Document validation rules

### API Documentation
- Use Swagger decorators
- Provide examples
- Document error responses
