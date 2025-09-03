# MicroBima Development Quick Reference

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8.15.0+
- Docker (for local Supabase)

### Setup
```bash
# Install dependencies
pnpm install

# Start local Supabase
pnpm supabase:start

# Run database migrations
pnpm --filter @microbima/api db:migrate

# Start development server
pnpm dev
```

## 📁 Project Structure

```
microbima/
├── apps/
│   ├── api/              # NestJS backend API
│   ├── web-admin/        # Next.js admin dashboard
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── sdk/              # Generated API client
│   ├── ui/               # Shared UI components
│   └── common-config/    # Shared configuration
├── infra/                # Infrastructure configs
└── docs/                 # Documentation
```

## 🏗️ Architecture Layers

### 1. Database Layer (Prisma)
- **Location**: `apps/api/prisma/schema.prisma`
- **Purpose**: Database schema and models
- **Naming**: `snake_case` tables, `camelCase` columns

### 2. Entity Layer (Domain Objects)
- **Location**: `apps/api/src/entities/`
- **Purpose**: Internal business logic and domain objects
- **Naming**: `PascalCase` classes, `camelCase` properties

### 3. DTO Layer (API Contracts)
- **Location**: `apps/api/src/dto/`
- **Purpose**: External API request/response contracts
- **Naming**: `PascalCase` + `Dto` suffix

### 4. Service Layer (Business Logic)
- **Location**: `apps/api/src/services/`
- **Purpose**: Business logic coordination and data access
- **Naming**: `PascalCase` + `Service` suffix

### 5. Controller Layer (HTTP Handlers)
- **Location**: `apps/api/src/controllers/`
- **Purpose**: HTTP request handling
- **Naming**: `PascalCase` + `Controller` suffix

## 📝 Naming Conventions

### Database/Prisma
```typescript
// Table names: snake_case
model Customer { }

// Column names: camelCase
firstName: string
dateOfBirth: DateTime
createdAt: DateTime

// Enum values: SCREAMING_SNAKE_CASE
enum CustomerStatus {
  PENDING_KYC
  ACTIVE
  SUSPENDED
}
```

### Entity Classes
```typescript
// Class names: PascalCase
export class Customer { }

// Properties: camelCase
firstName: string
dateOfBirth: Date

// Methods: camelCase
isEligibleForInsurance(): boolean
validateBeforeSave(): ValidationResult

// Constants: SCREAMING_SNAKE_CASE
const MAX_AGE = 65;
```

### DTOs
```typescript
// Class names: PascalCase + Dto
export class PrincipalMemberDto { }

// Properties: camelCase (external naming)
firstName: string
surName: string  // Note: external naming
```

## 🔄 Data Flow Patterns

### Creating a New Feature

1. **Update Prisma Schema** (if needed)
```typescript
// apps/api/prisma/schema.prisma
model NewFeature {
  id: String @id @default(cuid())
  name: String
  createdAt: DateTime @default(now())
}
```

2. **Create Entity Class**
```typescript
// apps/api/src/entities/new-feature.entity.ts
export class NewFeature {
  id: string;
  name: string;
  createdAt: Date;

  // Business logic
  isValid(): boolean {
    return this.name.length > 0;
  }

  // Validation
  validateBeforeSave(): ValidationResult {
    if (!this.isValid()) {
      return { valid: false, errors: ['Name is required'] };
    }
    return { valid: true };
  }
}
```

3. **Create DTOs**
```typescript
// apps/api/src/dto/new-feature/create-new-feature-request.dto.ts
export class CreateNewFeatureRequestDto {
  @ApiProperty({ description: 'Feature name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

// apps/api/src/dto/new-feature/create-new-feature-response.dto.ts
export class CreateNewFeatureResponseDto extends ApiResponseDto<{
  id: string;
  name: string;
}> {}
```

4. **Create Service**
```typescript
// apps/api/src/services/new-feature.service.ts
@Injectable()
export class NewFeatureService {
  constructor(private prisma: PrismaService) {}

  async create(feature: NewFeature): Promise<NewFeature> {
    const validation = feature.validateBeforeSave();
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    const data = await this.prisma.newFeature.create({
      data: feature.toPrismaData()
    });

    return new NewFeature(data);
  }
}
```

5. **Create Controller**
```typescript
// apps/api/src/controllers/new-feature.controller.ts
@Controller('api/new-feature')
export class NewFeatureController {
  constructor(private newFeatureService: NewFeatureService) {}

  @Post()
  @ApiOperation({ summary: 'Create new feature' })
  @ApiResponse({ 
    status: 201, 
    type: CreateNewFeatureResponseDto 
  })
  async create(
    @Body() createDto: CreateNewFeatureRequestDto
  ): Promise<CreateNewFeatureResponseDto> {
    // Implementation
  }
}
```

## 🧪 Testing Patterns

### Entity Tests
```typescript
describe('Customer', () => {
  it('should calculate full name correctly', () => {
    const customer = new Customer({
      firstName: 'John',
      lastName: 'Doe'
    });
    
    expect(customer.fullName).toBe('John Doe');
  });

  it('should validate before save', () => {
    const customer = new Customer({
      firstName: '', // Invalid
      lastName: 'Doe'
    });
    
    const validation = customer.validateBeforeSave();
    expect(validation.valid).toBe(false);
  });
});
```

### Service Tests
```typescript
describe('CustomerService', () => {
  it('should create customer successfully', async () => {
    const customer = new Customer({
      firstName: 'John',
      lastName: 'Doe'
    });
    
    const result = await customerService.create(customer);
    expect(result.id).toBeDefined();
  });
});
```

## 🚨 Error Handling

### Standard Error Response
```typescript
{
  status: 400,
  correlationId: "req-12345",
  error: "Validation Error",
  message: "Required field 'firstName' is missing",
  details: {
    field: "firstName",
    value: ""
  }
}
```

### Standard Success Response
```typescript
{
  status: 201,
  correlationId: "req-12345",
  message: "Customer created successfully",
  data: {
    id: "cust-123",
    firstName: "John",
    lastName: "Doe"
  }
}
```

## 🔧 Common Commands

### Development
```bash
# Start all services
pnpm dev

# Start specific app
pnpm --filter @microbima/api dev

# Build all
pnpm build

# Run tests
pnpm test
```

### Database
```bash
# Generate Prisma client
pnpm --filter @microbima/api db:generate

# Run migrations
pnpm --filter @microbima/api db:migrate

# Reset database
pnpm --filter @microbima/api db:reset

# Seed database
pnpm --filter @microbima/api db:seed
```

### Code Quality
```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check
```

## 📚 Additional Resources

- [Architecture Decisions](../architecture/decisions/)
- [Coding Standards](../development/coding-standards.md)
- [API Documentation](http://localhost:3000/api/internal/docs)
- [Prisma Studio](http://localhost:54323)

## 🤝 Contributing

1. Follow the established patterns
2. Write tests for new features
3. Update documentation
4. Use conventional commits
5. Create PRs for review
