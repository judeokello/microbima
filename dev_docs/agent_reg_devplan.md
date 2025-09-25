# MicroBima Agent Registration Development Plan

## **Agent Registration Core Module Implementation**

### **1. Overview**
The Agent Registration module enables Brand Ambassadors (BAs) to register customers through a multi-step wizard interface with save-on-Next behavior, deferred-mandatory fields tracked via Missing Requirements (MR), and comprehensive BA management with role-based access control.

### **2. Goals and Objectives**
- **Enable BA Customer Registration** through intuitive multi-step wizard
- **Implement Deferred-Mandatory Fields** with Missing Requirements tracking
- **Establish Role-Based Access Control** with Supabase authentication
- **Deploy BA Management System** with admin controls and partner assignment
- **Create BA Dashboard** with period-based analytics and earnings tracking

### **3. Scope of MVP**

#### **3.1 Core Features**

##### **BA Management System**
- [x] **Supabase Authentication** with user metadata for role management
- [x] **BA Registration UI** for admin-only BA creation
- [x] **BA Management Interface** with partner assignment
- [x] **Role-Based Access Control** (brand_ambassador vs registration_admin)
- [x] **Two-Step BA Creation** (Supabase user + BrandAmbassador record)

##### **Customer Registration Wizard**
- [x] **Multi-Step Wizard Interface** with save-on-Next behavior
- [x] **Customer Data Collection** (Page 1: Full customer form with all fields)
- [x] **Beneficiary Management** (Page 2: Optional with skip functionality)
- [x] **Spouse Information** (Integrated into customer step with phone number)
- [x] **Children Management** (Dynamic list with add/remove functionality)
- [x] **Payment Processing** (Review page with MPESA integration ready)

##### **Missing Requirements System**
- [ ] **MR Placeholder Creation** for expected counts
- [ ] **Deferred-Mandatory Field Tracking** per partner configuration
- [ ] **MR Resolution Interface** for admin users
- [ ] **Customer Flag Management** (hasMissingRequirements)

##### **BA Dashboard & Analytics**
- [ ] **Period-Based Cards** (Today/Yesterday/This Week/Last Week)
- [ ] **Registration Counts** and earnings per period
- [ ] **Filtered Customer Lists** with masked data
- [ ] **Earnings Tracking** with payout management

### **4. Technical Architecture**

#### **4.1 Frontend Structure (Next.js)**
- [x] **Admin Panel** (`/admin/*`) with role-based protection
- [x] **BA Registration Form** (`/admin/ba-registration`)
- [x] **BA Management Interface** (`/admin/ba-management`)
- [x] **Supabase Client Configuration** with admin API
- [x] **Customer Registration Wizard** (`/register/*`)
- [x] **BA Dashboard** (`/dashboard/*`)
- [x] **Role-Based Middleware** for route protection

#### **4.2 Backend Structure (NestJS)**
- [ ] **Agent Registration Module** (`/internal/agent-registrations/*`)
- [ ] **Missing Requirements Service** with MR logic
- [ ] **BA Authorization Guards** with role checking
- [ ] **Data Masking Serializers** for BA views
- [ ] **MPESA Integration** for payment processing

#### **4.3 Database Schema**
- [ ] **New Models**: BrandAmbassador, AgentRegistration, MissingRequirement, BAPayout
- [ ] **New Enums**: RegistrationEntityKind, RegistrationMissingStatus, BAPayoutStatus
- [ ] **Updated Models**: Customer (hasMissingRequirements), Partner (relations)
- [ ] **Deferred Requirements**: Default and Partner-specific configurations

### **5. Development Phases**

#### **5.1 Phase 1: Foundation & Authentication Setup (Week 1)**

##### **5.1.1 Supabase Integration** ✅ **COMPLETED**
- [x] **5.1.1.1** Install Supabase client and configure environment
- [x] **5.1.1.2** Create Supabase client configuration with admin API
- [x] **5.1.1.3** Set up user metadata types for multiple role management
- [x] **5.1.1.4** Configure environment variables (env.example)
- [x] **5.1.1.5** Implement role checking utilities (hasRole, hasAnyRole, hasAllRoles)

##### **5.1.2 Admin UI Foundation** ✅ **COMPLETED**
- [x] **5.1.2.1** Create admin layout and routing structure
- [x] **5.1.2.2** Implement BA registration form with multiple role selection
- [x] **5.1.2.3** Create BA management interface with table view
- [x] **5.1.2.4** Build admin dashboard with quick actions
- [x] **5.1.2.5** Implement API functions for BA operations with role support

##### **5.1.3 Role-Based Access Control** ✅ **COMPLETED**
- [x] **5.1.3.1** Implement role-based middleware for /admin routes
- [x] **5.1.3.2** Create authentication guards for Next.js
- [x] **5.1.3.3** Set up Supabase session management with useAuth hook
- [x] **5.1.3.4** Implement role checking utilities
- [x] **5.1.3.5** Create login page with role-based redirects
- [x] **5.1.3.6** Update admin layout with role-based access control

#### **5.2 Phase 2: Database Schema & Backend API (Week 2)**

##### **5.2.1 Prisma Schema Updates ✅ COMPLETED**
- [x] **5.2.1.1** Add new enums (RegistrationEntityKind, RegistrationMissingStatus, BAPayoutStatus)
- [x] **5.2.1.2** Create BrandAmbassador model with partner relations
- [x] **5.2.1.3** Create AgentRegistration model with customer relations
- [x] **5.2.1.4** Create MissingRequirement model with entity tracking
- [x] **5.2.1.5** Create BAPayout model for earnings tracking
- [x] **5.2.1.6** Create DeferredRequirement models (Default/Partner)
- [x] **5.2.1.7** Update Customer model (hasMissingRequirements field)
- [x] **5.2.1.8** Update Partner model (new relations)
- [x] **5.2.1.9** Run database migration

##### **5.2.2 Seed Data Setup ✅ COMPLETED**
- [x] **5.2.2.1** Create seed data for DeferredRequirementDefault
- [ ] **5.2.2.2** Implement partner creation with requirement inheritance
- [ ] **5.2.2.3** Set up development data for testing

##### **5.2.3 NestJS Agent Registration Module**
- [ ] **5.2.3.1** Create AgentRegistrationController with CRUD endpoints
- [ ] **5.2.3.2** Implement AgentRegistrationService with business logic
- [ ] **5.2.3.3** Create DTOs for all registration endpoints
- [ ] **5.2.3.4** Implement MissingRequirementService with MR logic
- [ ] **5.2.3.5** Create BA authorization guards
- [ ] **5.2.3.6** Implement data masking for BA views
- [ ] **5.2.3.7** Add Swagger documentation for all endpoints

#### **5.3 Phase 3: Customer Registration Wizard (Week 3)** ✅ **COMPLETED**

##### **5.3.1 Wizard Infrastructure** ✅ **COMPLETED**
- [x] **5.3.1.1** Create Stepper component with navigation
- [x] **5.3.1.2** Implement save-on-Next behavior with mock data
- [x] **5.3.1.3** Set up form state management with React Hook Form
- [x] **5.3.1.4** Create wizard routing and step navigation
- [x] **5.3.1.5** Add "Register New Customer" button to dashboard

##### **5.3.2 Registration Steps (3-Step MVP)** ✅ **COMPLETED**
- [x] **5.3.2.1** Implement StepCustomer (Full customer form with all fields)
- [x] **5.3.2.2** Implement StepBeneficiary (Optional next of kin)
- [x] **5.3.2.3** Implement StepPayment (Review + MPESA payment)
- [x] **5.3.2.4** Add spouse/children management to customer step
- [x] **5.3.2.5** Create payment summary with product details
- [x] **5.3.2.6** Implement form validation and error handling

##### **5.3.3 Form Components**
- [ ] **5.3.3.1** Create MaskedPhone component for phone display
- [ ] **5.3.3.2** Implement DateRangePicker for period selection
- [ ] **5.3.3.3** Create StatCard component for dashboard metrics
- [ ] **5.3.3.4** Build validation helpers and error handling

#### **5.4 Phase 4: BA Dashboard & Analytics (Week 4)**

##### **5.4.1 Dashboard Infrastructure**
- [ ] **5.4.1.1** Create dashboard layout with sidebar navigation
- [ ] **5.4.1.2** Implement period-based data fetching
- [ ] **5.4.1.3** Set up timezone handling (Africa/Nairobi)
- [ ] **5.4.1.4** Create responsive design for mobile/desktop

##### **5.4.2 Analytics Components**
- [ ] **5.4.2.1** Build period cards (Today/Yesterday/This Week/Last Week)
- [ ] **5.4.2.2** Implement registration count and earnings display
- [ ] **5.4.2.3** Create clickable cards for filtered lists
- [ ] **5.4.2.4** Build customer list with masked data display
- [ ] **5.4.2.5** Implement earnings tracking and payout status

##### **5.4.3 Data Visualization**
- [ ] **5.4.3.1** Create charts for registration trends
- [ ] **5.4.3.2** Implement earnings visualization
- [ ] **5.4.3.3** Build performance metrics display
- [ ] **5.4.3.4** Add export functionality for reports

#### **5.5 Phase 5: Missing Requirements Management (Week 5)**

##### **5.5.1 MR System Implementation**
- [ ] **5.5.1.1** Implement MR placeholder creation logic
- [ ] **5.5.1.2** Create MR evaluation and tracking
- [ ] **5.5.1.3** Implement customer flag management
- [ ] **5.5.1.4** Build MR resolution workflow

##### **5.5.2 Admin MR Interface**
- [ ] **5.5.2.1** Create MR queue interface for admin users
- [ ] **5.5.2.2** Implement MR resolution forms
- [ ] **5.5.2.3** Build MR status tracking and history
- [ ] **5.5.2.4** Create MR reporting and analytics

##### **5.5.3 MR Business Logic**
- [ ] **5.5.3.1** Implement deferred-mandatory field validation
- [ ] **5.5.3.2** Create partner-specific requirement inheritance
- [ ] **5.5.3.3** Build MR auto-resolution for completed data
- [ ] **5.5.3.4** Implement MR notification system

#### **5.6 Phase 6: Payment Integration & Testing (Week 6)**

##### **5.6.1 MPESA Integration**
- [ ] **5.6.1.1** Implement MPESA STK push integration
- [ ] **5.6.1.2** Create payment status tracking
- [ ] **5.6.1.3** Build payment confirmation workflow
- [ ] **5.6.1.4** Implement payment retry logic

##### **5.6.2 Testing & Validation**
- [ ] **5.6.2.1** Create unit tests for all services
- [ ] **5.6.2.2** Implement integration tests for API endpoints
- [ ] **5.6.2.3** Build end-to-end tests for wizard flow
- [ ] **5.6.2.4** Test role-based access control
- [ ] **5.6.2.5** Validate MR system functionality

##### **5.6.3 Performance & Security**
- [ ] **5.6.3.1** Implement API rate limiting
- [ ] **5.6.3.2** Add input validation and sanitization
- [ ] **5.6.3.3** Test data masking and privacy controls
- [ ] **5.6.3.4** Validate authentication and authorization

### **6. User Roles and Permissions**

#### **Brand Ambassadors (BA)**
- [x] Can access customer registration wizard
- [x] Can view own dashboard with earnings
- [ ] Can see masked customer data only
- [ ] Can track registration progress

#### **Registration Admins**
- [ ] Can create and manage Brand Ambassadors
- [ ] Can assign BAs to partners
- [ ] Can resolve Missing Requirements
- [ ] Can view full customer data
- [ ] Can access admin analytics

#### **System Administrators**
- [ ] Can manage partner configurations
- [ ] Can configure deferred requirements
- [ ] Can access system-wide analytics
- [ ] Can manage user roles and permissions

### **7. Tech Stack**

#### **Frontend**
- [x] **Next.js 15** with App Router and TypeScript
- [x] **Tailwind CSS v4** for styling
- [x] **Shadcn UI** for component library
- [x] **React Hook Form** with Zod validation
- [x] **Supabase** for authentication and user management

#### **Backend**
- [ ] **NestJS** with TypeScript for API development
- [ ] **Prisma ORM** with PostgreSQL database
- [ ] **Supabase Auth** for user authentication
- [ ] **Role-based Guards** for authorization

#### **Infrastructure**
- [ ] **Fly.io** for deployment
- [ ] **Supabase** for database and auth
- [ ] **Environment Management** with secrets

### **8. Success Metrics**

#### **Technical Metrics**
- [ ] **Wizard Completion Rate** > 90%
- [ ] **API Response Time** < 200ms for 95% of requests
- [ ] **MR Resolution Time** < 24 hours
- [ ] **Zero Critical Security Vulnerabilities**

#### **Business Metrics**
- [ ] **BA Registration Success Rate** > 95%
- [ ] **Customer Onboarding Completion** > 85%
- [ ] **MR Resolution Rate** > 90%
- [ ] **System Uptime** > 99.9%

### **9. Future Considerations**

#### **Post-MVP Enhancements**
- [ ] **Multi-Partner BA Support** (BA can work with multiple partners)
- [ ] **Advanced Analytics** with detailed reporting
- [ ] **Automated MR Resolution** using AI
- [ ] **Real-time Notifications** for status updates

#### **Scalability Improvements**
- [ ] **Microservices Architecture** for better scalability
- [ ] **Event-Driven Architecture** for real-time processing
- [ ] **Caching Layer** for improved performance
- [ ] **CDN Integration** for global content delivery

### **10. Conclusion**

This development plan provides a comprehensive roadmap for implementing the MicroBima Agent Registration module with multi-step wizard, deferred-mandatory fields, role-based access control, and comprehensive BA management.

**Next Steps:**
1. Complete Phase 1 (Foundation & Authentication Setup)
2. Implement Phase 2 (Database Schema & Backend API)
3. Build Phase 3 (Customer Registration Wizard)
4. Deploy and test all components

**Estimated Timeline:** 6 weeks for complete MVP implementation
**Team Requirements:** 2-3 developers, 1 DevOps engineer, 1 QA engineer

---

## **Development Flow Summary**

### **Foundation Phases (1-2): "Set It Up"**
- **Phase 1**: Authentication and admin UI foundation
- **Phase 2**: Database schema and backend API
- **Checkboxes**: Mark complete when infrastructure is functional

### **Implementation Phases (3-6): "Build and Test"**
- **Phase 3**: Build customer registration wizard
- **Phase 4**: Create BA dashboard and analytics
- **Phase 5**: Implement Missing Requirements system
- **Phase 6**: Add payment integration and testing

### **Key Integration Points**
- Every new feature integrates with Supabase authentication
- All BA operations respect role-based access control
- MR system tracks deferred-mandatory fields across all steps
- Dashboard provides real-time analytics for all BA activities

**Key Insight**: Phases 1-2 establish the foundation, while Phases 3-6 build the complete user experience with comprehensive testing and validation.
