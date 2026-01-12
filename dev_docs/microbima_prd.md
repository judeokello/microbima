# MicroBima Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** January 2025  
**Status:** Active

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Vision & Goals](#vision--goals)
3. [Personas & Roles](#personas--roles)
4. [Core Features](#core-features)
5. [Technology Stack](#technology-stack)
6. [System Architecture](#system-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Component Interactions](#component-interactions)
9. [Roadmap](#roadmap)

---

## Executive Summary

MicroBima is a modern, API-first micro-insurance core platform designed for flexible products, fast customer onboarding, and robust partner integrations. The platform digitizes micro-insurance operations for individuals and groups across Africa, providing role-specific portals for customers, brokers/agents, providers, and partners.

**Key Value Propositions:**
- Flexible premium schedules (daily, weekly, monthly, quarterly, annually, custom)
- Multiple payment rails (M-Pesa STK Push, Paybill, bank transfers)
- Comprehensive partner API integration
- Real-time payment tracking via M-Pesa IPN
- Postpaid and prepaid scheme support
- Automated policy lifecycle management

---

## Vision & Goals

### Vision
Digitize micro-insurance operations for individuals and groups in Africa, making insurance accessible and affordable through flexible products, efficient operations, and seamless integrations.

### Goals
- Deliver role-specific portals (customers, brokers/agents, providers, partners)
- Support flexible premium schedules and payment frequencies
- Expose safe Public APIs for partners while isolating Internal APIs for portals
- Enable fast onboarding with comprehensive KYC and validation
- Provide developer-friendly onboarding, documentation, and SDKs
- Support both prepaid and postpaid insurance schemes
- Real-time payment processing and policy activation

---

## Personas & Roles

### Customers
- Buy and manage insurance policies
- View dependants, beneficiaries, and coverage details
- Track payments and policy status
- Access through mobile app or web portal

### Brokers/Agents (Brand Ambassadors)
- Onboard customers through registration wizard
- View commissions and earnings
- Manage customer registrations and missing requirements
- Track registration statistics and performance

### Providers/Hospitals
- Verify customer coverage
- Submit and manage claims
- Access patient eligibility information

### Partners (Insurtechs)
- Integrate via Public APIs for policy operations
- Onboard customers programmatically
- Access real-time policy and payment data

### Internal Roles
- **Operations**: Manage daily operations and customer support
- **Finance**: Process payments, reconcile transactions, manage commissions
- **Admin**: System administration and configuration
- **Underwriters**: Manage products, packages, schemes, and pricing
- **Product/Engineering**: Platform development and maintenance

---

## Core Features

### 1. Customer Onboarding

**Individual Customers:**
- Multi-step registration wizard (customer info, beneficiary, spouse, children)
- KYC validation (ID verification, phone verification)
- Dependant and beneficiary management
- Package and scheme assignment (mandatory)
- Policy creation with flexible payment options

**Group/Corporate Customers:**
- Group registration with negotiated rates
- Member roster import (CSV/API)
- Group-level invoices and statements
- Bulk policy management

**Partners (Public API):**
- Programmatic customer onboarding
- Webhook notifications for enrollment confirmations
- Policy auto-assignment with unique IDs

### 2. Product & Plan Management

**Products & Packages:**
- Hierarchical structure: Underwriter → Package → Scheme → Plan
- Underwriter management with logos and contact information
- Package configuration with policy/member number formats
- Scheme management (prepaid/postpaid support)
- Plan definitions (Silver/Gold tiers)

**Scheme Features:**
- Prepaid and postpaid modes
- Flexible payment frequencies (daily, weekly, monthly, quarterly, annually, custom)
- Payment account number generation (unique IDs, scheme-level account numbers)
- Scheme contact management (up to 5 contacts per scheme)
- Negotiated rates per channel (direct, broker, partner)

**Policy Configuration:**
- Versioning: Immutable plan versions
- Waiting periods and exclusions
- Provider networks and eligibility rules
- Feature flags for staged rollouts

### 3. Payments & Billing

**Payment Frequencies:**
- Daily, weekly, monthly, quarterly, annually
- Custom intervals (configurable cadence in days)
- Scheme-level frequency settings (for postpaid)
- Customer-level frequency selection (for prepaid)

**Payment Rails:**
- **M-Pesa STK Push**: Agent-initiated payment requests
- **M-Pesa Paybill**: Customer-initiated payments
- **M-Pesa IPN**: Real-time payment notifications (primary data source)
- **Statement Upload**: Gap filling for missing IPN records
- Bank transfers and card payments (planned)

**Payment Processing:**
- Real-time payment tracking via M-Pesa IPN
- Automatic payment matching to policies
- Policy activation on first payment
- Payment account number generation (policy-level and scheme-level)
- Statement upload with deduplication against IPN records

**Arrears Management:**
- Grace period configuration
- Policy suspension after grace window
- Policy termination after prolonged non-payment
- Automated status transitions

### 4. Policy Lifecycle Management

**Policy States:**
- **PENDING_ACTIVATION**: Policy created, awaiting first payment
- **ACTIVE**: Policy active, benefits available
- **SUSPENDED**: Payment missed, grace period expired
- **TERMINATED**: Prolonged non-payment
- **CANCELLED**: User or company initiated cancellation
- **EXPIRED**: Policy period ended

**Policy Activation:**
- Prepaid policies: Activated immediately upon creation
- Postpaid policies: Activated on first payment or manual activation
- Member number generation for principals and dependants
- Start/end date assignment
- Policy number generation

### 5. Agent Registration & Management

**Brand Ambassador Registration:**
- Multi-step customer registration wizard
- Save-on-next behavior (data persisted at each step)
- Missing requirements tracking (deferred mandatory fields)
- Partner-scoped registrations
- Registration status tracking (draft, submitted, verified, rejected)

**Agent Dashboard:**
- Registration statistics (today, yesterday, this week, last week)
- Earnings tracking per period
- Customer search and filtering
- Registration charts and analytics

**Commission Management:**
- Configurable commission rates per agent
- Payout tracking and scheduling
- Weekly/monthly/90-day hold options
- Clawback on early cancellations
- Commission statements and exports

### 6. Claims Management (Planned)

- Provider-led claim initiation
- Coverage verification
- Evidence upload and documentation
- Adjudication workflow (triage → documentation → approval/reject)
- SLA tracking (turnaround time)
- Notifications to stakeholders
- Future: Automated adjudication & fraud detection

### 7. Notifications

**Channels:**
- SMS notifications
- Email notifications
- WhatsApp (with consent)

**Triggers:**
- Payment confirmations
- Arrears reminders
- Policy activation/suspension/termination
- Claim updates
- Registration confirmations
- Missing requirement alerts

### 8. Partner Developer Portal (Planned)

- Partner onboarding and management
- API key generation and management
- OpenAPI documentation
- SDK downloads (TypeScript)
- Usage analytics and monitoring
- Sandbox environment for testing

### 9. M-Pesa Integration

**STK Push:**
- Agent-initiated payment requests
- Real-time payment prompts to customers
- Status tracking (pending, completed, failed, cancelled, expired)
- Automatic linking to IPN transactions

**IPN (Instant Payment Notification):**
- Real-time payment notifications from M-Pesa
- Primary data source for payment tracking
- Automatic policy matching and activation
- Idempotent processing (duplicate handling)

**Statement Upload:**
- Manual statement file upload (XLS format)
- Deduplication against IPN records
- Gap filling for missing transactions
- Statistics reporting (matched vs new records)

---

## Technology Stack

### Backend

**Core Framework:**
- **NestJS 11.x**: Modular, scalable Node.js framework
- **TypeScript 5.3.x**: Type-safe development
- **Prisma 6.x**: Modern ORM for database operations
- **PostgreSQL**: Primary database (Supabase hosted)

**Authentication & Authorization:**
- **Supabase Auth**: User authentication and session management
- **JWT Tokens**: Internal API authentication
- **OIDC/OAuth2**: Public API authentication (via Kong, Authentik planned)
- **API Key Authentication**: Partner API access
- **Role-Based Access Control (RBAC)**: Fine-grained permissions

**API Gateway:**
- **Kong**: API gateway for public APIs
- Rate limiting and quotas
- OIDC authentication plugin
- Request/response transformation

### Frontend

**Web Applications:**
- **Next.js 15**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS v4**: Utility-first styling
- **Shadcn UI**: Component library
- **TanStack Table**: Data tables
- **React Hook Form + Zod**: Form validation

**Mobile:**
- **React Native** (planned): Customer mobile app

### Infrastructure

**Deployment:**
- **Fly.io**: Containerized application hosting
- **Docker**: Containerization
- **GitHub Actions**: CI/CD pipelines

**Database:**
- **PostgreSQL**: Primary database (Supabase)
- **Prisma Migrations**: Schema versioning and migrations

**Monitoring & Analytics:**
- **Sentry**: Error tracking and performance monitoring
- **PostHog**: Product analytics (events, funnels, feature flags)
- **Metabase**: Business intelligence dashboards (planned)
- **OpenTelemetry**: Distributed tracing (planned)

**External Integrations:**
- **M-Pesa Daraja API**: Payment processing
- **VTiger CRM**: Customer relationship management (planned)
- **RabbitMQ**: Message queue for async operations (planned)

### Development Tools

**Package Management:**
- **pnpm 8.15.0+**: Fast, disk-efficient package manager
- **Turbo**: Monorepo build system

**Code Quality:**
- **ESLint**: Linting
- **Prettier**: Code formatting
- **TypeScript Strict Mode**: Type safety
- **Husky**: Git hooks

**Documentation:**
- **OpenAPI/Swagger**: API documentation
- **TypeScript SDK Generation**: Auto-generated client libraries

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
├──────────────┬──────────────┬──────────────┬──────────────┤
│   Mobile     │ Agent Portal │ Web Admin    │  Partner     │
│   (RN)       │ (Next.js)    │ (Next.js)    │  Integrations│
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
       │              │               │              │
       └──────────────┼───────────────┼──────────────┘
                      │               │
       ┌──────────────▼───────────────▼──────────────┐
       │           Kong API Gateway                   │
       │         (Public API Routes)                  │
       └──────────────┬───────────────────────────────┘
                      │
       ┌──────────────▼───────────────────────────────┐
       │         Internal API (NestJS)                 │
       │  ┌─────────────────────────────────────────┐ │
       │  │  Controllers → Services → Entities      │ │
       │  │  Middleware (Auth, Correlation ID)      │ │
       │  │  Filters (Exception Handling)           │ │
       │  └─────────────────────────────────────────┘ │
       └──────────────┬───────────────────────────────┘
                      │
       ┌──────────────▼───────────────────────────────┐
       │      PostgreSQL Database (Supabase)          │
       │  ┌─────────────────────────────────────────┐ │
       │  │  Prisma ORM                             │ │
       │  │  Schema & Migrations                    │ │
       │  └─────────────────────────────────────────┘ │
       └───────────────────────────────────────────────┘
                      │
       ┌──────────────▼───────────────────────────────┐
       │         External Services                     │
       │  - M-Pesa Daraja API                         │
       │  - Sentry (Monitoring)                       │
       │  - PostHog (Analytics)                       │
       │  - VTiger CRM (Planned)                      │
       └───────────────────────────────────────────────┘
```

### Monorepo Structure

```
microbima/
├── apps/
│   ├── api/                    # NestJS Backend API
│   │   ├── src/
│   │   │   ├── controllers/    # HTTP handlers
│   │   │   ├── services/       # Business logic
│   │   │   ├── entities/       # Domain objects
│   │   │   ├── dto/            # API contracts
│   │   │   ├── middleware/     # Request processing
│   │   │   └── prisma/         # Database client
│   │   └── prisma/
│   │       ├── schema.prisma   # Database schema
│   │       └── migrations/     # Database migrations
│   ├── agent-registration/     # Next.js Agent Portal
│   ├── web-admin/              # Next.js Admin Dashboard
│   └── mobile/                 # React Native (planned)
├── packages/
│   ├── sdk/                    # Generated TypeScript SDK
│   ├── ui/                     # Shared UI components
│   └── common-config/          # Shared configuration
├── infra/
│   └── fly/                    # Fly.io deployment configs
├── docs/                       # Documentation
└── dev_docs/                   # Development documentation
```

### API Architecture

**Internal APIs** (`/api/internal/*`):
- Portal access (agent-registration, web-admin)
- Supabase JWT authentication required
- Full CRUD operations
- Admin and operational endpoints

**Public APIs** (`/api/public/*` or `/api/v1/*`):
- Partner integrations
- Kong API gateway routing
- API key authentication
- OIDC/OAuth2 authentication (via Kong)
- Rate limiting and quotas

**M-Pesa Callbacks** (`/api/public/mpesa/*`):
- IPN confirmation endpoint
- STK Push callback endpoint
- Publicly accessible (IP whitelist protection)
- No authentication required (M-Pesa requirements)

---

## Deployment Architecture

### Environments

**Development:**
- Local development with Supabase local instance
- Hot reload and debugging
- Development database

**Staging:**
- Fly.io staging apps
- Separate staging database
- Pre-production validation
- Auto-deploy on push to `staging` branch

**Production:**
- Fly.io production apps
- Separate production database
- High availability configuration
- Auto-deploy on push to `master` branch

### Deployment Strategy

**Branch-Based Deployment:**
```
development → staging → production
    ↓            ↓          ↓
  Local      Fly.io      Fly.io
            Staging    Production
```

**Deployment Flow:**
1. Feature development in `development` branch
2. Merge to `staging` → Auto-deploy to staging environment
3. Verification and testing in staging
4. Merge to `master` → Auto-deploy to production environment

**Fly.io Applications:**

**Staging:**
- `maishapoa-staging-internal-api`: Internal API backend
- `microbima-staging-web-admin`: Admin dashboard
- `microbima-staging-public-api`: Kong gateway
- `maishapoa-staging-agent-registration`: Agent portal

**Production:**
- `microbima-production-internal-api`: Internal API backend
- `microbima-production-web-admin`: Admin dashboard
- `microbima-production-public-api`: Kong gateway
- Production agent-registration (planned)

**Database:**
- Separate PostgreSQL databases per environment
- Supabase hosted (staging and production)
- Prisma migrations for schema changes
- Migration workflow: Local → Staging → Production

### Networking

**Private Networking:**
- Internal API ↔ Database: Private network
- Internal API ↔ External Services: Public internet
- Kong Gateway ↔ Internal API: Private network (planned)

**Public Endpoints:**
- Kong Gateway: Public API exposure
- Internal API: M-Pesa callbacks (public with IP whitelist)
- Frontend Apps: Public web access

### Configuration Management

**Environment Variables:**
- Application configuration via environment variables
- Secrets management via Fly.io secrets
- Database connection strings per environment
- API keys and credentials per environment

**Configuration Services:**
- M-Pesa Daraja API credentials
- Supabase configuration
- Sentry DSN and configuration
- PostHog configuration
- Feature flags

---

## Component Interactions

### Request Flow (Internal API)

```
1. Client Request
   ↓
2. Kong Gateway (if public API)
   - Authentication (OIDC/API Key)
   - Rate limiting
   - Routing
   ↓
3. Internal API Middleware
   - Correlation ID extraction/generation
   - API Key validation (if public)
   - Supabase JWT validation (if internal)
   ↓
4. Controller
   - Request validation (DTOs)
   - Parameter extraction
   ↓
5. Service Layer
   - Business logic
   - Entity operations
   - External service calls
   ↓
6. Prisma Client
   - Database queries
   - Transaction management
   ↓
7. PostgreSQL Database
   - Data persistence
   ↓
8. Response
   - DTO mapping
   - Error handling (Global Exception Filter)
   - Sentry error reporting
   - Correlation ID in response
```

### Payment Processing Flow

**STK Push Initiation:**
```
1. Agent initiates payment via Internal API
   ↓
2. STK Push Service creates request record
   ↓
3. M-Pesa Daraja API call (STK Push)
   ↓
4. Customer receives payment prompt
   ↓
5. M-Pesa callback → STK Push Callback endpoint
   ↓
6. Update STK Push request status
   ↓
7. M-Pesa IPN → IPN Confirmation endpoint
   ↓
8. Link IPN to STK Push request
   ↓
9. Create payment records
   ↓
10. Activate policy (if first payment)
```

**IPN Processing:**
```
1. M-Pesa sends IPN notification
   ↓
2. IPN Confirmation endpoint receives notification
   ↓
3. IPN Service processes notification
   ↓
4. Check for existing transaction (idempotency)
   ↓
5. Match to STK Push request (if applicable)
   ↓
6. Create payment records (MpesaPaymentReportItem, policy_payments)
   ↓
7. Link to policy (via account reference)
   ↓
8. Activate policy (if first payment and PENDING_ACTIVATION)
   ↓
9. Update policy payment status
```

### Customer Registration Flow

**Agent Registration:**
```
1. Agent starts registration wizard
   ↓
2. Step 1: Customer Information
   - API: POST /internal/agent-registrations
   - API: PATCH /internal/agent-registrations/:id/customer
   ↓
3. Step 2: Beneficiary
   - API: PATCH /internal/agent-registrations/:id/beneficiary
   ↓
4. Step 3: Spouse
   - API: PATCH /internal/agent-registrations/:id/spouse
   ↓
5. Step 4: Children
   - API: PATCH /internal/agent-registrations/:id/children
   ↓
6. Payment Step
   - API: PATCH /internal/agent-registrations/:id/payment
   - STK Push initiation
   ↓
7. Submit Registration
   - API: POST /internal/agent-registrations/:id/submit
   - Create customer record
   - Create policy (PENDING_ACTIVATION for postpaid)
   - Create missing requirements (if any)
```

### Policy Activation Flow

**Prepaid Scheme:**
```
1. Customer registration completed
   ↓
2. Policy created with ACTIVE status
   - Policy number generated
   - Start/end dates set
   - Payment account number assigned
   - Member numbers generated
   ↓
3. Policy immediately available
```

**Postpaid Scheme:**
```
1. Customer registration completed
   ↓
2. Policy created with PENDING_ACTIVATION status
   - No policy number initially
   - No dates set
   - No payment account number
   ↓
3. First payment received (IPN or STK Push)
   ↓
4. Policy activation triggered
   - Generate policy number
   - Set start/end dates
   - Generate member numbers
   - Update status to ACTIVE
   ↓
5. Policy now active
```

---

## Roadmap

### MVP (Completed/In Progress)

✅ **Core Infrastructure**
- Monorepo setup and structure
- Database schema and migrations
- Internal API foundation
- Authentication and authorization

✅ **Customer Onboarding**
- Individual customer registration
- Agent registration wizard
- Dependant and beneficiary management
- Package and scheme assignment

✅ **Product Management**
- Underwriter, package, scheme, plan management
- Prepaid and postpaid scheme support
- Payment account number generation
- Scheme contact management

✅ **Payment Processing**
- M-Pesa STK Push integration
- M-Pesa IPN integration
- Statement upload with deduplication
- Policy activation on payment

✅ **Agent Management**
- Brand ambassador registration
- Registration dashboard and statistics
- Missing requirements tracking
- Commission tracking (foundation)

### v1.0 (Planned)

- **Claims Management**
  - Provider-led claim initiation
  - Adjudication workflow
  - Evidence upload
  - SLA tracking

- **Group/Corporate Onboarding**
  - Group registration
  - Member roster import
  - Bulk operations

- **Commission System**
  - Automated commission calculations
  - Payout scheduling
  - Commission statements

- **Partner Developer Portal**
  - API documentation portal
  - SDK downloads
  - Usage analytics
  - Sandbox environment

- **Advanced Analytics**
  - Metabase BI dashboards
  - Custom reporting
  - Performance metrics

### Future Enhancements

- **VTiger CRM Integration**
  - Customer synchronization
  - Task creation for missing requirements
  - User management sync

- **Automated Adjudication**
  - AI-powered claim assessment
  - Fraud detection
  - Risk scoring

- **Mobile Applications**
  - React Native customer app
  - Provider mobile app
  - Agent mobile app

- **Advanced Features**
  - Multi-currency support
  - Multi-language support
  - Advanced reporting and analytics
  - Real-time notifications (push, SMS, WhatsApp)

---

**End of Document**




