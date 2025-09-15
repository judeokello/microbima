# MicroBima Customer Onboarding Development Plan

## **Customer Onboarding Core Module Implementation**

### **1. Overview**
The Customer Onboarding module is a core component of the MicroBima microinsurance platform that enables external customers to onboard through public APIs, which invoke internal APIs and SDKs. This system provides flexible onboarding flows for individuals, groups, and corporate customers with comprehensive KYC verification and policy setup.

### **2. Goals and Objectives**
- **Enable External API Access** for partner integrations and customer onboarding
- **Implement Flexible Onboarding Flows** for individual, group, and corporate customers
- **Establish Dual API Architecture** with internal APIs for portals and public APIs for partners
- **Deploy Early to Fly.io** with proper networking and security
- **Generate Type-Safe SDK** from OpenAPI specifications for consistent client access

### **3. Scope of MVP**

#### **3.1 Core Features**

##### **External Customer Onboarding via Public API**
- [ ] **Public API Gateway** through Kong with OIDC authentication
- [ ] **Customer Creation Endpoint** for individual customers
- [ ] **Onboarding Status Tracking** with step-by-step progress
- [ ] **KYC Verification Integration** with automated and manual processes
- [ ] **Dependant/Beneficiary Management** during onboarding
- [ ] **Address and Contact Information** collection and validation

##### **Internal API Integration**
- [ ] **NestJS Backend** with dual API layers (internal/public)
- [ ] **Prisma ORM Integration** with PostgreSQL database
- [ ] **Role-Based Access Control** for different user types
- [ ] **Audit Logging** for all customer operations
- [ ] **Webhook Support** for partner integrations

##### **SDK Generation and Integration**
- [ ] **OpenAPI Specification** for customer onboarding endpoints
- [ ] **TypeScript SDK Generation** using openapi-typescript-codegen
- [ ] **Client-Side Type Safety** with generated types and services
- [ ] **Authentication Integration** with JWT tokens

### **4. Technical Architecture**

#### **4.1 Backend Structure**
- [ ] **NestJS Application** with modular architecture
- [ ] **Customer Module** with controller, service, and DTOs
- [ ] **Policy Module** for plan selection and management
- [ ] **Payment Module** for premium setup and billing
- [ ] **KYC Module** for verification workflows
- [ ] **Shared Guards and Interceptors** for security and validation

#### **4.2 Database Schema**
- [ ] **Customer Table** with personal information and status
- [ ] **Address Table** for customer location data
- [ ] **Dependant Table** for family members and beneficiaries
- [ ] **Onboarding Progress Table** for step tracking
- [ ] **KYC Verification Table** for verification status and documents
- [ ] **Audit Log Table** for change tracking

#### **4.3 API Design**
- [ ] **Internal API Routes** (`/api/internal/*`) for portal access
- [ ] **Public API Routes** (`/api/v1/*`) for partner access
- [ ] **OpenAPI Documentation** with Swagger UI
- [ ] **Request/Response Validation** using DTOs and Zod
- [ ] **Error Handling** with consistent error responses

### **5. Development Phases**

#### **5.1 Phase 1: Foundation & Infrastructure Setup (Week 1)**

##### **5.1.1 Initialize Monorepo Structure**
- [x] **5.1.1.1** Create directory structure (`apps/*`, `packages/*`, `infra/*`)
- [x] **5.1.1.2** Set up root package.json and pnpm-workspace.yaml
- [x] **5.1.1.3** Configure TypeScript base configuration
- [x] **5.1.1.4** Set up .gitignore and development tools

##### **5.1.2 Fly.io Infrastructure Setup**
- [x] **5.1.2.1** Install Fly CLI and authenticate
- [x] **5.1.2.2** Create Fly apps for each service (internal-api, public-api, web-admin)
- [x] **5.1.2.3** Set up private networking for internal services
- [x] **5.1.2.4** Configure environment variables and secrets

##### **5.1.3 Database Setup**
- [x] **5.1.3.1** Create Supabase project and PostgreSQL database
- [x] **5.1.3.2** Configure database connection strings
- [x] **5.1.3.3** Set up Prisma ORM with initial schema

#### **5.2 Phase 2: Backend API Foundation (Week 2)**

##### **5.2.1 NestJS Backend Setup**
- [x] **5.2.1.1** Initialize NestJS application in `apps/api`
- [x] **5.2.1.2** Install and configure required dependencies
- [x] **5.2.1.3** Set up application configuration and environment
- [x] **5.2.1.4** Configure Swagger documentation

##### **5.2.2 Customer Onboarding Module Structure**
- [x] **5.2.2.1** Create Prisma Service for database operations
- [x] **5.2.2.2** Create DTOs for principal-member endpoints
- [x] **5.2.2.3** Create Entity classes for internal use
- [x] **5.2.2.4** Create Mappers for DTO ↔ Entity conversion
- [x] **5.2.2.5** Implement API Key Authentication middleware
- [x] **5.2.2.6** Implement Correlation ID middleware
  - [x] **5.2.2.6.1** Basic correlation ID extraction and validation
  - [x] **5.2.2.6.2** Correlation ID decorator for easy access
  - [x] **5.2.2.6.3** TypeScript type definitions
  - [x] **5.2.2.6.4** Basic request tracing endpoint (MVP - Post Phase 2)
  - [ ] **5.2.2.6.5** Enhanced internal system tracing (Post-MVP)
- [x] **5.2.2.7** Create Global Exception Filter with Sentry integration
  - [x] **5.2.2.7.1** Global exception filter implementation
  - [x] **5.2.2.7.2** Consistent error response format
  - [x] **5.2.2.7.3** Correlation ID inclusion in error responses
  - [x] **5.2.2.7.4** Request context logging
  - [x] **5.2.2.7.5** External integrations service for async calls
  - [x] **5.2.2.7.6** Proper Sentry SDK integration (Deferred to 5.2.4.1)
- [x] **5.2.2.8** Implement Customer Service with business logic
  - [x] **5.2.2.8.1** Create PartnerApiKey entity and database schema
  - [x] **5.2.2.8.2** Update API key validation middleware to use database
  - [x] **5.2.2.8.3** Implement Customer Service with partner scoping
- [x] **5.2.2.9** Implement Customer Controller with CRUD endpoints
  - [x] **5.2.2.9.1** Implement Customer Controller with CRUD operations
- [x] **5.2.2.10** Update database schema and run migrations

##### **5.2.2.11: Partner Management API**
- [x] **5.2.2.11.1** Partner Management Service (consolidated)
  - [x] **5.2.2.11.1.1** Partner operations (create, get, update)
  - [x] **5.2.2.11.1.2** API Key operations (generate, validate, deactivate)
  - [x] **5.2.2.11.1.3** Business logic and validation
- [x] **5.2.2.11.2** Internal API Controller
  - [x] **5.2.2.11.2.1** Partner Management Controller (internal)
  - [x] **5.2.2.11.2.2** Create partner endpoint
  - [x] **5.2.2.11.2.3** Generate API key endpoint
- [x] **5.2.2.11.3** Public API Controller
  - [x] **5.2.2.11.3.1** Partner Management Controller (public)
  - [x] **5.2.2.11.3.2** Generate API key endpoint (with auth)
  - [x] **5.2.2.11.3.3** Rate limiting handled by Kong
- [x] **5.2.2.11.4** API Key Management Infrastructure
  - [x] **5.2.2.11.4.1** API key generation utilities (crypto, validation)
  - [x] **5.2.2.11.4.2** Standard response format with correlation IDs
  - [ ] **5.2.2.11.4.3** Internal API rate limiting (Post-MVP)

##### **5.2.4 Deployment Preparation (Post-CRUD Implementation)**
- [ ] **5.2.4.1** Implement proper Sentry integration using official SDK
  - [ ] **5.2.4.1.1** Install @sentry/nestjs package
  - [ ] **5.2.4.1.2** Create instrument.ts file for Sentry initialization
  - [ ] **5.2.4.1.3** Add SentryModule to app.module.ts
  - [ ] **5.2.4.1.4** Update GlobalExceptionFilter with @SentryExceptionCaptured decorator
  - [ ] **5.2.4.1.5** Configure source maps for readable stack traces
- [ ] **5.2.4.2** Deploy staging environment to Fly.io
  - [ ] **5.2.4.2.1** Configure staging environment variables
  - [ ] **5.2.4.2.2** Deploy internal-api to staging
  - [ ] **5.2.4.2.3** Deploy public-api to staging
  - [ ] **5.2.4.2.4** Configure staging database
  - [ ] **5.2.4.2.5** Run database migrations on staging
  - [ ] **5.2.4.2.6** Test CRUD endpoints on staging
- [ ] **5.2.4.3** Deploy production environment to Fly.io
  - [ ] **5.2.4.3.1** Configure production environment variables
  - [ ] **5.2.4.3.2** Deploy internal-api to production
  - [ ] **5.2.4.3.3** Deploy public-api to production
  - [ ] **5.2.4.3.4** Configure production database
  - [ ] **5.2.4.3.5** Run database migrations on production
  - [ ] **5.2.4.3.6** Test CRUD endpoints on production
- [ ] **5.2.4.4** Post-deployment validation
  - [ ] **5.2.4.4.1** Verify Sentry error reporting in staging/production
  - [ ] **5.2.4.4.2** Test correlation ID tracking across environments
  - [ ] **5.2.4.4.3** Validate API key authentication in production
  - [ ] **5.2.4.4.4** Monitor application performance and logs

##### **5.2.3 Database Models and Migrations**
- [x] **5.2.3.1** Define Prisma schema for customer entities
- [x] **5.2.3.2** Create database migrations
- [x] **5.2.3.3** Set up seed data for development
- [x] **5.2.3.4** Configure Prisma client and service

#### **5.3 Phase 3: SDK Infrastructure Setup (Week 3) - Foundation Complete When Checked**

##### **5.3.1 OpenAPI Specification Foundation**
- [ ] **5.3.1.1** Define customer onboarding API endpoints
- [ ] **5.3.1.2** Create request/response schemas
- [ ] **5.3.1.3** Document authentication and authorization
- [ ] **5.3.1.4** Generate initial OpenAPI specification file
- [ ] **5.3.1.5** Set up OpenAPI validation in CI pipeline

##### **5.3.2 SDK Package Infrastructure**
- [ ] **5.3.2.1** Create `packages/sdk` structure
- [ ] **5.3.2.2** Configure package.json and TypeScript
- [ ] **5.3.2.3** Set up SDK generation scripts
- [ ] **5.3.2.4** Implement authentication helpers
- [ ] **5.3.2.5** Configure build and publish workflows

##### **5.3.3 Initial SDK Generation**
- [ ] **5.3.3.1** Generate initial TypeScript client from OpenAPI
- [ ] **5.3.3.2** Build and package SDK for distribution
- [ ] **5.3.3.3** Test basic SDK integration in sample applications
- [ ] **5.3.3.4** Document SDK usage and examples
- [ ] **5.3.3.5** Set up automated SDK generation on OpenAPI changes

**Note: This phase establishes SDK infrastructure. Ongoing SDK generation and testing happens throughout Phases 5-8 as features are built.**

#### **5.4 Phase 4: API Gateway Infrastructure Setup (Week 4) - Foundation Complete When Checked**

##### **5.4.1 Kong Gateway Foundation**
- [ ] **5.4.1.1** Set up Kong API gateway for public API exposure
- [ ] **5.4.1.2** Configure OIDC authentication plugin
- [ ] **5.4.1.3** Set up rate limiting and CORS policies
- [ ] **5.4.1.4** Configure basic routing to internal API services
- [ ] **5.4.1.5** Set up Kong health checks and monitoring

##### **5.4.2 API Security Infrastructure**
- [ ] **5.4.2.1** Implement internal vs public API separation
- [ ] **5.4.2.2** Set up JWT authentication for internal APIs
- [ ] **5.4.2.3** Configure OIDC authentication for public APIs
- [ ] **5.4.2.4** Implement basic request validation and sanitization
- [ ] **5.4.2.5** Set up API key management for partners

##### **5.4.3 API Documentation Infrastructure**
- [ ] **5.4.3.1** Set up Swagger UI for both API layers
- [ ] **5.4.3.2** Create basic API testing suite framework
- [ ] **5.4.3.3** Document API architecture and security model
- [ ] **5.4.3.4** Set up basic API monitoring and logging
- [ ] **5.4.3.5** Configure API analytics and usage tracking

**Note: This phase establishes API gateway infrastructure. Actual endpoint implementation, testing, and security validation happens throughout Phases 5-8 as features are built.**

---

## **Ongoing Work Throughout Development (Phases 5-8)**

### **5.4.4 Ongoing API Gateway Work (Throughout Phases 5-8)**
- [ ] **5.4.4.1** Implement and test each API endpoint through Kong
- [ ] **5.4.4.2** Validate OIDC authentication for each public endpoint
- [ ] **5.4.4.3** Test rate limiting and CORS for each endpoint
- [ ] **5.4.4.4** Monitor API performance and security metrics
- [ ] **5.4.4.5** Update Kong routing as new endpoints are added

### **5.3.4 Ongoing SDK Work (Throughout Phases 5-8)**
- [ ] **5.3.4.1** Regenerate SDK after each OpenAPI spec update
- [ ] **5.3.4.2** Test SDK integration with each new feature
- [ ] **5.3.4.3** Validate type safety for new endpoints
- [ ] **5.3.4.4** Update SDK documentation for new features
- [ ] **5.3.4.5** Test SDK performance with new endpoints

---

#### **5.5 Phase 5: Database Schema & Prisma Models (Week 5)**

##### **5.5.1 Customer Data Model**
- [ ] **5.5.1.1** Implement customer table with all required fields
- [ ] **5.5.1.2** Create address and dependant tables
- [ ] **5.5.1.3** Set up relationships and constraints
- [ ] **5.5.1.4** Configure indexes for performance
- [ ] **5.5.1.5** Update OpenAPI spec with new data models (triggers 5.3.4.1)
- [ ] **5.5.1.6** Test Kong routing to new endpoints (triggers 5.4.4.1)

##### **5.5.1.7 Address Management (Post-MVP Enhancement)**
- [ ] **5.5.1.7.1** Add address fields to principal member DTO
- [ ] **5.5.1.7.2** Implement address validation and storage
- [ ] **5.5.1.7.3** Update customer creation flow to handle addresses
- [ ] **5.5.1.7.4** Add address update endpoints
- [ ] **5.5.1.7.5** Update OpenAPI spec with address endpoints (triggers 5.3.4.1)
- [ ] **5.5.1.7.6** Test Kong routing for address endpoints (triggers 5.4.4.1)

##### **5.5.2 Onboarding Progress Tracking**
- [ ] **5.5.2.1** Implement onboarding progress table
- [ ] **5.5.2.2** Set up step completion tracking
- [ ] **5.5.2.3** Configure status transitions and validation
- [ ] **5.5.2.4** Create progress calculation logic
- [ ] **5.5.2.5** Update OpenAPI spec with progress endpoints (triggers 5.3.4.1)
- [ ] **5.5.2.6** Test Kong authentication for progress endpoints (triggers 5.4.4.2)

##### **5.5.3 KYC and Verification System**
- [ ] **5.5.3.1** Set up KYC verification table
- [ ] **5.5.3.2** Implement document storage and validation
- [ ] **5.5.3.3** Configure verification workflow states
- [ ] **5.5.3.4** Set up audit logging for verification actions
- [ ] **5.5.3.5** Update OpenAPI spec with KYC endpoints (triggers 5.3.4.1)
- [ ] **5.5.3.6** Test Kong rate limiting for KYC endpoints (triggers 5.4.4.3)

#### **5.6 Phase 6: Fly.io Deployment Configuration (Week 6)**

##### **5.6.1 Application Deployment**
- [x] **5.6.1.1** Create Dockerfiles for each application
- [x] **5.6.1.2** Configure Fly.io deployment files
- [x] **5.6.1.3** Set up environment variables and secrets
- [x] **5.6.1.4** Configure health checks and monitoring

##### **5.6.2 Networking and Security**
- [x] **5.6.2.1** Set up private networking between services
- [x] **5.6.2.2** Configure SSL certificates and HTTPS
- [x] **5.6.2.3** Set up firewall rules and access controls
- [x] **5.6.2.4** Configure backup and disaster recovery

##### **5.6.3 Environment Management**
- [x] **5.6.3.1** Set up development, staging, and production environments
- [x] **5.6.3.2** Configure environment-specific configurations
- [ ] **5.6.3.3** Set up CI/CD pipelines for automated deployment
- [x] **5.6.3.4** Configure monitoring and alerting

#### **5.7 Phase 7: Testing & Validation (Week 7)**

##### **5.7.1 API Testing**
- [ ] **5.7.1.1** Create unit tests for all services
- [ ] **5.7.1.2** Implement integration tests for API endpoints
- [ ] **5.7.1.3** Set up end-to-end testing for onboarding flows
- [ ] **5.7.1.4** Configure test coverage reporting

##### **5.7.2 SDK Testing**
- [ ] **5.7.2.1** Test SDK generation and build process
- [ ] **5.7.2.2** Validate type safety and error handling
- [ ] **5.7.2.3** Test authentication and authorization flows
- [ ] **5.7.2.4** Verify API contract compliance

##### **5.7.3 Performance and Security Testing**
- [ ] **5.7.3.1** Load test API endpoints
- [ ] **5.7.3.2** Security audit of authentication and authorization
- [ ] **5.7.3.3** Validate rate limiting and CORS policies
- [ ] **5.7.3.4** Test error handling and edge cases

#### **5.8 Phase 8: Monitoring & Analytics (Week 8)**

##### **5.8.1 Application Monitoring**
- [ ] **5.8.1.1** Set up PostHog for product analytics
- [ ] **5.8.1.2** Configure event tracking for onboarding flows
- [ ] **5.8.1.3** Set up error monitoring with Sentry
- [ ] **5.8.1.4** Implement performance monitoring

##### **5.8.2 Business Intelligence**
- [ ] **5.8.2.1** Set up Metabase for BI dashboards
- [ ] **5.8.2.2** Create onboarding funnel analytics
- [ ] **5.8.2.3** Set up conversion tracking and reporting
- [ ] **5.8.2.4** Configure automated reporting

##### **5.8.3 Operational Monitoring**
- [ ] **5.8.3.1** Set up API usage monitoring
- [ ] **5.8.3.2** Configure alerting for system issues
- [ ] **5.8.3.3** Implement log aggregation and analysis
- [ ] **5.8.3.4** Set up health check monitoring

### **6. User Roles and Permissions**

#### **External Customers (Public API)**
- [ ] Can create customer accounts via public API
- [ ] Can view onboarding progress and status
- [ ] Can update personal information during onboarding
- [ ] Can manage dependants and beneficiaries

#### **Internal Users (Internal API)**
- [ ] **Customer Service Representatives** can view and manage customer accounts
- [ ] **KYC Officers** can verify customer documents and information
- [ ] **Underwriters** can review and approve customer applications
- [ ] **System Administrators** can manage system configuration

#### **Partner Applications (Public API)**
- [ ] Can onboard customers on behalf of their users
- [ ] Can access customer data within defined scopes
- [ ] Can receive webhook notifications for status changes
- [ ] Can access usage analytics and reporting

### **7. Tech Stack**

#### **Backend**
- [ ] **NestJS** with TypeScript for API development
- [ ] **Prisma ORM** with PostgreSQL database
- [ ] **JWT Authentication** for internal APIs
- [ ] **OIDC Authentication** for public APIs

#### **API Gateway**
- [ ] **Kong** for public API exposure and security
- [ ] **Rate Limiting** and CORS policies
- [ ] **OIDC Plugin** for authentication
- [ ] **Request/Response Transformation**

#### **Infrastructure**
- [ ] **Fly.io** for containerized deployment
- [ ] **Private Networking** for internal services
- [ ] **SSL/TLS** encryption for all communications
- [ ] **Environment Management** with secrets

#### **SDK and Client Tools**
- [ ] **OpenAPI Specification** for API contracts
- [ ] **TypeScript SDK Generation** with openapi-typescript-codegen
- [ ] **Generated Types** for type-safe client development
- [ ] **Authentication Helpers** for client integration

### **8. Success Metrics**

#### **Technical Metrics**
- [ ] **API Response Time** < 200ms for 95% of requests
- [ ] **SDK Generation** completes in < 30 seconds
- [ ] **Test Coverage** > 80% for all modules
- [ ] **Zero Critical Security Vulnerabilities**

#### **Business Metrics**
- [ ] **Customer Onboarding Success Rate** > 90%
- [ ] **KYC Verification Time** < 24 hours
- [ ] **API Uptime** > 99.9%
- [ ] **Partner Integration Time** < 1 week

### **9. Future Considerations**

#### **Post-MVP Enhancements**
- [ ] **Automated KYC Verification** using AI and machine learning
- [ ] **Real-time Notifications** for onboarding status updates
- [ ] **Advanced Analytics** for onboarding optimization
- [ ] **Multi-language Support** for international markets

#### **Scalability Improvements**
- [ ] **Microservices Architecture** for better scalability
- [ ] **Event-Driven Architecture** for real-time processing
- [ ] **Caching Layer** for improved performance
- [ ] **CDN Integration** for global content delivery

### **10. Conclusion**

This development plan provides a comprehensive roadmap for implementing the MicroBima Customer Onboarding module with external API access, early Fly.io deployment, and generated SDK integration. The phased approach ensures systematic development while maintaining quality and security standards.

**Next Steps:**
1. Begin with Phase 1 (Foundation & Infrastructure Setup)
2. Set up Fly.io accounts and infrastructure
3. Initialize the monorepo structure
4. Configure development environment and tools

**Estimated Timeline:** 8 weeks for complete MVP implementation
**Team Requirements:** 2-3 developers, 1 DevOps engineer, 1 QA engineer

---

## **Development Flow Summary**

### **Infrastructure Phases (3-4): "Set It Up"**
- **Phase 3**: SDK infrastructure ready for generation
- **Phase 4**: API gateway ready for routing
- **Checkboxes**: Mark complete when infrastructure is functional

### **Implementation Phases (5-8): "Build and Test"**
- **Phase 5**: Build database and business logic
- **Phase 6**: Deploy and configure infrastructure
- **Phase 7**: Test everything together
- **Phase 8**: Monitor and optimize

### **Ongoing Integration Points**
- Every new feature triggers SDK regeneration (5.3.4.x)
- Every new endpoint tests Kong routing (5.4.4.x)
- Infrastructure phases provide the foundation for implementation phases
- Implementation phases validate and enhance the infrastructure

**Key Insight**: Phases 3-4 are "one-time setup" but their ongoing work continues throughout Phases 5-8 as features are built and tested.
