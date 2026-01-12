# Integration Testing Strategy for M-Pesa IPN Integration (T037)

This document outlines strategies and options for implementing integration tests for the M-Pesa IPN integration, specifically for task T037.

## Overview

Integration tests (T037) are designed to test the complete flow of M-Pesa callbacks, including:
- IPN callback endpoint with valid/invalid payloads
- STK Push callback endpoint
- IP whitelist guard
- Database record creation and linking
- Error handling and edge cases

**Key Principle**: Integration tests should **NEVER** run against staging or production databases. They require isolated, dedicated test databases.

---

## Shadow Database vs Test Database

### Shadow Database (Prisma/Supabase)

**What it is:**
- Used by Prisma during `prisma migrate dev` for schema diffing
- Temporary database created/destroyed automatically
- Purpose: Compare schema changes when generating migrations
- Configured in `supabase/config.toml` as `shadow_port = 54320`

**What it's NOT:**
- ❌ Not for running integration tests
- ❌ Not a persistent test database
- ❌ Not accessible for test code

### Test Database (What You Need)

A dedicated, persistent test database that:
- ✅ Persists during test runs (unlike shadow DB)
- ✅ Can be cleaned/reset between test runs
- ✅ Is separate from dev/staging/production
- ✅ Has the same schema as production (via migrations)

---

## Option 1: Local Development Strategy

### Approach: Dedicated Test Database in Local Supabase

Create a separate test database (e.g., `microbima_test`) alongside your development database.

#### Setup Steps

1. **Create Test Database**

   ```bash
   # Option A: Using Supabase CLI (creates new database)
   supabase start
   # Then create test database via SQL
   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "CREATE DATABASE microbima_test;"
   
   # Option B: Using Supabase Studio
   # Navigate to http://127.0.0.1:54323
   # Create new database: microbima_test
   ```

2. **Configure Environment Variable**

   Create `.env.test` or add to `.env`:
   ```bash
   # Test database configuration
   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/microbima_test
   ```

3. **Run Migrations on Test Database**

   ```bash
   # Apply all migrations to test database
   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
   ```

4. **Update Test Configuration**

   In `apps/api/tests/integration/mpesa-callbacks.e2e-spec.ts`:
   ```typescript
   beforeAll(async () => {
     if (!process.env.TEST_DATABASE_URL) {
       console.warn('⚠️ TEST_DATABASE_URL not set, skipping integration tests');
       return;
     }
     
     const module = await Test.createTestingModule({
       imports: [AppModule],
     })
     .overrideProvider(PrismaService)
     .useValue(new PrismaClient({ 
       datasources: { 
         db: { url: process.env.TEST_DATABASE_URL } 
       } 
     }))
     .overrideProvider(MpesaDarajaApiService)
     .useValue(mockMpesaApiService)
     .compile();
     
     app = module.createNestApplication();
     prisma = module.get(PrismaService);
     
     // Clean database before tests
     await prisma.cleanDatabase();
   });
   
   afterEach(async () => {
     // Clean database between tests
     await prisma.cleanDatabase();
   });
   ```

5. **Add Test Script**

   Update `apps/api/package.json`:
   ```json
   {
     "scripts": {
       "test:integration": "NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL jest --config ./test/jest-e2e.json"
     }
   }
   ```

#### Benefits

- ✅ Fast (local PostgreSQL)
- ✅ Isolated from dev database
- ✅ Can inspect data after tests (for debugging)
- ✅ No external dependencies
- ✅ Can be reset easily when needed

#### Drawbacks

- ⚠️ Requires local Supabase setup
- ⚠️ Need to remember to reset/clean database

---

## Option 2: CI/CD Strategy - Docker PostgreSQL

### Approach: Spin Up Fresh PostgreSQL Container for Each Test Run

In GitHub Actions, use Docker to create a temporary PostgreSQL database for tests.

#### Setup Steps

1. **Create GitHub Actions Workflow**

   Create `.github/workflows/integration-tests.yml`:
   ```yaml
   name: Integration Tests
   
   on:
     pull_request:
       branches: [main, develop]
     push:
       branches: [main, develop]
   
   jobs:
     integration-tests:
       runs-on: ubuntu-latest
       
       services:
         postgres:
           image: postgres:17
           env:
             POSTGRES_PASSWORD: postgres
             POSTGRES_DB: microbima_test
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
           ports:
             - 5432:5432
       
       steps:
         - name: Checkout code
           uses: actions/checkout@v4
         
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '22'
         
         - name: Install pnpm
           run: npm install -g pnpm
         
         - name: Install dependencies
           env:
             PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: 1
           run: pnpm install --frozen-lockfile
         
         - name: Generate Prisma Client
           run: cd apps/api && npx prisma generate
         
         - name: Run database migrations
           env:
             DATABASE_URL: postgresql://postgres:postgres@localhost:5432/microbima_test
           run: |
             cd apps/api
             npx prisma migrate deploy
         
         - name: Run integration tests
           env:
             NODE_ENV: test
             DATABASE_URL: postgresql://postgres:postgres@localhost:5432/microbima_test
           run: |
             cd apps/api
             pnpm test:integration
         
         - name: Cleanup (automatic)
           if: always()
           run: |
             # Docker container is automatically cleaned up
             echo "✅ Test database container cleaned up"
   ```

2. **Update Test Configuration**

   Same as Option 1, tests use `TEST_DATABASE_URL` environment variable.

#### Benefits

- ✅ Fresh database for each test run
- ✅ No external dependencies (except Docker)
- ✅ Fast setup/teardown
- ✅ Works reliably in CI
- ✅ Completely isolated from other environments
- ✅ No cleanup needed (container destroyed after tests)

#### Drawbacks

- ⚠️ Adds ~30-60 seconds to CI pipeline (database startup)
- ⚠️ Requires Docker service in GitHub Actions

---

## Option 3: CI/CD Strategy - Supabase CLI

### Approach: Use Supabase CLI to Start Local Test Instance

Similar to Option 2, but uses Supabase CLI instead of raw PostgreSQL.

#### Setup Steps

1. **Create GitHub Actions Workflow**

   ```yaml
   name: Integration Tests
   
   on:
     pull_request:
       branches: [main, develop]
   
   jobs:
     integration-tests:
       runs-on: ubuntu-latest
       
       steps:
         - name: Checkout code
           uses: actions/checkout@v4
         
         - name: Setup Supabase CLI
           uses: supabase/setup-cli@v1
           with:
             version: latest
         
         - name: Start Supabase
           run: supabase start
         
         - name: Run database migrations
           run: |
             cd apps/api
             DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
             npx prisma migrate deploy
         
         - name: Run integration tests
           env:
             NODE_ENV: test
             DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
           run: |
             cd apps/api
             pnpm test:integration
         
         - name: Stop Supabase
           if: always()
           run: supabase stop
   ```

#### Benefits

- ✅ Includes Supabase-specific features (auth, storage, etc.)
- ✅ More similar to production setup
- ✅ Official Supabase GitHub Action available

#### Drawbacks

- ⚠️ Heavier than raw PostgreSQL (longer startup time)
- ⚠️ May include services you don't need for integration tests
- ⚠️ Slightly more complex setup

---

## Option 4: Hybrid Approach (Recommended)

### Local Development: Option 1 (Dedicated Test Database)
### CI/CD: Option 2 (Docker PostgreSQL)

This gives you:
- **Local**: Fast, persistent test database for debugging
- **CI/CD**: Fresh, isolated database for each run

#### Implementation

1. **Local Development**
   - Use `TEST_DATABASE_URL` pointing to `microbima_test` database
   - Run tests: `pnpm test:integration`

2. **CI/CD**
   - Use Docker PostgreSQL service
   - Tests automatically run in GitHub Actions
   - No manual setup needed

3. **Test Script**

   Update `apps/api/package.json`:
   ```json
   {
     "scripts": {
       "test:integration": "NODE_ENV=test jest --config ./test/jest-e2e.json --testPathPattern=integration"
     }
   }
   ```

   Tests automatically use `DATABASE_URL` or `TEST_DATABASE_URL` environment variable.

---

## Option 5: Skip Integration Tests in CI (Alternative)

### Approach: Run Unit Tests Only in CI, Integration Tests Manually

Some teams choose to:
- ✅ Run unit tests (T035, T036) in CI/CD (fast, no DB needed)
- ⚠️ Run integration tests (T037) manually before merging
- ✅ Faster CI/CD pipeline
- ✅ Integration tests run only when needed

#### When This Makes Sense

- Integration tests are slow
- You want fast feedback in CI
- Integration tests are run before major releases
- Team has discipline to run integration tests manually

#### Implementation

Simply don't add integration tests to CI workflow. Keep them for local development only.

---

## Recommended Approach for This Project

Based on the current setup, I recommend **Option 4 (Hybrid Approach)**:

### Local Development
- Use dedicated test database: `microbima_test`
- Environment variable: `TEST_DATABASE_URL`
- Run with: `pnpm test:integration`
- Fast, debuggable, isolated

### CI/CD (GitHub Actions)
- Use Docker PostgreSQL service
- Fresh database for each test run
- Automated, reliable, isolated
- No manual intervention needed

### Implementation Checklist

- [ ] Create test database: `microbima_test` in local Supabase
- [ ] Add `TEST_DATABASE_URL` to `.env` (not committed)
- [ ] Create `apps/api/tests/integration/` directory
- [ ] Create `apps/api/tests/integration/mpesa-callbacks.e2e-spec.ts`
- [ ] Update `apps/api/package.json` with `test:integration` script
- [ ] Create `apps/api/test/jest-e2e.json` config file
- [ ] Add Docker PostgreSQL service to GitHub Actions workflow
- [ ] Update `.github/workflows/deploy.yml` or create new workflow
- [ ] Test locally: `pnpm test:integration`
- [ ] Test in CI: Push PR and verify tests run

---

## Test Database Cleanup Strategy

### Using PrismaService.cleanDatabase()

The existing `PrismaService` has a `cleanDatabase()` method that:
- Only works in `NODE_ENV=test`
- Truncates all tables (except `_prisma_migrations`)
- Uses CASCADE to handle foreign keys

#### Usage in Tests

```typescript
beforeAll(async () => {
  // ... setup test module
  await prisma.cleanDatabase(); // Clean before all tests
});

afterEach(async () => {
  await prisma.cleanDatabase(); // Clean after each test
});
```

### Alternative: Transaction Rollback (More Complex)

For faster tests, you could wrap each test in a transaction and rollback:

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`;
});
```

**Note**: This is more complex and may not work with all Prisma operations. The truncate approach is simpler and more reliable.

---

## Test Structure Example

```typescript
// apps/api/tests/integration/mpesa-callbacks.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as request from 'supertest';

describe('M-Pesa Callback Endpoints (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  beforeAll(async () => {
    // Skip if TEST_DATABASE_URL not set
    if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
      console.warn('⚠️ TEST_DATABASE_URL not set, skipping integration tests');
      return;
    }
    
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(PrismaService)
    .useValue(new PrismaClient({ 
      datasources: { 
        db: { url: testDbUrl } 
      } 
    }))
    // Mock external services
    .overrideProvider(MpesaDarajaApiService)
    .useValue({
      initiateStkPush: jest.fn(),
      // ... other mocked methods
    })
    .compile();
    
    app = module.createNestApplication();
    await app.init();
    
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.cleanDatabase();
  });
  
  afterEach(async () => {
    if (prisma) {
      await prisma.cleanDatabase();
    }
  });
  
  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });
  
  describe('POST /api/public/mpesa/confirmation (IPN)', () => {
    it('should process valid IPN payload and create payment record', async () => {
      // Test implementation
    });
    
    it('should handle duplicate IPN notifications idempotently', async () => {
      // Test implementation
    });
    
    // ... more tests
  });
  
  describe('POST /api/public/mpesa/stk-push-callback', () => {
    it('should process STK Push callback and update request status', async () => {
      // Test implementation
    });
    
    // ... more tests
  });
});
```

---

## Environment Variables

### Required for Integration Tests

```bash
# Test database URL (for local development)
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/microbima_test

# Node environment (enables PrismaService.cleanDatabase())
NODE_ENV=test

# Optional: Override default DATABASE_URL
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/microbima_test
```

### CI/CD Environment Variables

In GitHub Actions, these are set in the workflow file:

```yaml
env:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/microbima_test
```

---

## Security Considerations

### IP Whitelist Guard in Tests

Integration tests need to mock or bypass the IP whitelist guard:

```typescript
// Option 1: Mock the guard
.overrideGuard(IpWhitelistGuard)
.useValue({
  canActivate: jest.fn(() => true),
})

// Option 2: Use test IP ranges
// Configure test environment to allow localhost/127.0.0.1
```

### M-Pesa API Mocking

**Never call real M-Pesa APIs in tests!**

```typescript
.overrideProvider(MpesaDarajaApiService)
.useValue({
  initiateStkPush: jest.fn().mockResolvedValue({
    CheckoutRequestID: 'test-checkout-request-id',
    ResponseCode: '0',
    ResponseDescription: 'Success',
  }),
})
```

---

## Performance Considerations

### Test Execution Time

- **Unit tests (T035, T036)**: ~5-10 seconds (mocked, no DB)
- **Integration tests (T037)**: ~30-60 seconds (real DB, cleanup)

### Optimization Strategies

1. **Parallel Test Execution**: Run integration tests in parallel (if safe)
2. **Selective Testing**: Only run integration tests on critical paths
3. **Test Data Seeding**: Pre-seed common test data instead of creating per test
4. **Transaction Rollback**: Use transactions for faster cleanup (more complex)

---

## Troubleshooting

### Common Issues

1. **"TEST_DATABASE_URL not set"**
   - Solution: Set environment variable or skip tests

2. **"Database connection failed"**
   - Solution: Ensure test database exists and is accessible
   - Check Supabase is running: `supabase status`

3. **"cleanDatabase() not allowed"**
   - Solution: Ensure `NODE_ENV=test` is set

4. **"Foreign key constraint violation"**
   - Solution: Ensure `cleanDatabase()` uses `CASCADE` (already implemented)

5. **"Tests failing in CI but passing locally"**
   - Solution: Check database URL format, connection strings
   - Verify migrations run successfully in CI

---

## References

- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/integration-testing)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [GitHub Actions Services](https://docs.github.com/en/actions/using-containerized-services/about-service-containers)

---

## Summary

Integration tests (T037) require a dedicated test database that is:
- ✅ Separate from dev/staging/production
- ✅ Cleaned between test runs
- ✅ Accessible locally and in CI/CD

**Recommended approach**: Hybrid (Option 4)
- **Local**: Dedicated test database (`microbima_test`)
- **CI/CD**: Docker PostgreSQL container

This provides fast, reliable, isolated testing without touching production systems.

