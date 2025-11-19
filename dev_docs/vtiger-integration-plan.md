# VTiger CRM Integration Plan

## Overview
This plan implements comprehensive bidirectional integration between MicroBima and VTiger CRM, enabling automated customer synchronization, task management, user linking, payment tracking, and custom field mapping.

## Architecture Components

### 1. Infrastructure Setup

#### 1.1 RabbitMQ Queue System
- **Purpose**: Handle async operations, retries, and failed sync management
- **Queues Needed**:
  - `vtiger.customer.create` - Customer creation sync
  - `vtiger.customer.update` - Customer update sync
  - `vtiger.task.create` - Task creation
  - `vtiger.user.create` - User creation sync
  - `vtiger.user.update` - User status update sync
  - `vtiger.user.password-reset` - Password reset sync
  - `vtiger.payment.summary` - Weekly payment summaries
  - `vtiger.note.create` - Note creation for changes
  - `vtiger.lead.convert` - Handle lead conversion from VTiger
- **Configuration**: Add RabbitMQ connection settings to `ConfigurationService`
- **Location**: `apps/api/src/config/configuration.service.ts`

#### 1.2 VTiger API Client
- **Purpose**: Centralized VTiger REST API client
- **Features**:
  - Authentication (username + access key)
  - CRUD operations for Contacts, Users, Tasks, Notes
  - Custom field support
  - Error handling and retry logic
- **Location**: `apps/api/src/services/vtiger/vtiger-api.client.ts`

#### 1.3 VTiger Configuration
- **Environment Variables**:
  - `VTIGER_URL` - Base URL (maishapoa.co.ke/vcrm)
  - `VTIGER_USERNAME` - API username
  - `VTIGER_ACCESS_KEY` - API access key
  - `VTIGER_ENABLED` - Feature flag
  - `RABBITMQ_URL` - RabbitMQ connection string
- **Location**: `apps/api/src/config/configuration.service.ts`

### 2. Database Schema Changes

#### 2.1 Customer VTiger Sync Fields
- Add to `Customer` model:
  - `vtigerContactId` (String?, unique) - VTiger contact ID
  - `vtigerSyncStatus` (enum: PENDING, SYNCED, FAILED, SYNCING)
  - `vtigerLastSyncedAt` (DateTime?)
  - `vtigerSyncError` (String?) - Last sync error message
- **Migration**: `add_vtiger_customer_sync_fields`

#### 2.2 User VTiger Sync Fields
- Add to `BrandAmbassador` model:
  - `vtigerUserId` (String?) - VTiger user ID (null = not in CRM)
  - `vtigerSyncStatus` (enum: PENDING, SYNCED, FAILED)
  - `createVtigerUser` (Boolean, default: true) - Checkbox state for new users
- **Migration**: `add_vtiger_user_sync_fields`

#### 2.3 VTiger Sync Queue Table
- New model `VtigerSyncQueue`:
  - `id` (UUID)
  - `entityType` (enum: CUSTOMER, USER, TASK, PAYMENT_SUMMARY, NOTE)
  - `entityId` (String) - Reference to entity
  - `operation` (enum: CREATE, UPDATE, DELETE)
  - `status` (enum: PENDING, PROCESSING, COMPLETED, FAILED)
  - `retryCount` (Int, default: 0)
  - `maxRetries` (Int, default: 3)
  - `payload` (JSON) - Operation data
  - `errorMessage` (String?)
  - `processedAt` (DateTime?)
  - `createdAt`, `updatedAt`
- **Migration**: `create_vtiger_sync_queue`

#### 2.4 VTiger Custom Field Mapping
- New model `VtigerCustomFieldMapping`:
  - `id` (Int)
  - `microbimaField` (String) - Field path in MicroBima
  - `vtigerFieldName` (String) - Custom field name in VTiger
  - `vtigerModule` (String, default: 'Contacts')
  - `isActive` (Boolean, default: true)
  - `fieldType` (enum: TEXT, NUMBER, DATE, BOOLEAN)
- **Migration**: `create_vtiger_custom_field_mapping`

#### 2.5 Customer Care Role
- Add `customer_care` role to Supabase user metadata roles array
- Update role constants in `apps/agent-registration/src/lib/supabase.ts`
- Add role to `ROLES` enum

### 3. Core Services

#### 3.1 VTiger Service (`vtiger.service.ts`)
- **Responsibilities**:
  - Customer sync (create/update)
  - User sync (create/update/status)
  - Task creation
  - Note creation
  - Payment summary generation
  - Custom field mapping
  - Password management
- **Methods**:
  - `syncCustomerToVtiger(customerId, operation)` - Sync customer to VTiger
  - `syncUserToVtiger(userId, createVtigerUser, password?)` - Create new user or sync existing
  - `syncExistingUserToVtiger(userId, password)` - Sync existing user (manual trigger)
  - `updateUserStatusInVtiger(vtigerUserId, isActive)` - Enable/disable user
  - `resetUserPasswordInVtiger(vtigerUserId, newPassword)` - Reset password in VTiger
  - `checkUserExistsInVtiger(userId)` - Check if user has VTiger account (checks vtigerUserId field)
  - `createTaskInVtiger(taskData)` - Create task for missing requirements
  - `createNoteInVtiger(contactId, noteContent)` - Create note for customer changes
  - `sendWeeklyPaymentSummary(customerId, weekStart, weekEnd)` - Send payment summary
  - `handleLeadConversion(leadId, customerData)` - Handle lead conversion from VTiger
- **Location**: `apps/api/src/services/vtiger/vtiger.service.ts`

#### 3.2 VTiger Queue Consumer (`vtiger-queue.consumer.ts`)
- **Purpose**: Process queued VTiger operations
- **Features**:
  - Retry logic with exponential backoff
  - Dead letter queue for failed operations
  - Status tracking in database
- **Location**: `apps/api/src/services/vtiger/vtiger-queue.consumer.ts`

#### 3.3 VTiger Queue Producer (`vtiger-queue.producer.ts`)
- **Purpose**: Queue VTiger operations
- **Features**:
  - Queue operation with payload
  - Priority handling
  - Correlation ID tracking
- **Location**: `apps/api/src/services/vtiger/vtiger-queue.producer.ts`

### 4. Integration Points

#### 4.1 Customer Creation Hook
- **Location**: `apps/api/src/services/customer.service.ts`
- **Trigger**: After successful customer creation
- **Action**: Queue customer sync to VTiger
- **Fields Synced**: firstName, middleName, lastName, idNumber, email, phoneNumber, dateOfBirth, gender
- **Custom Fields**: Map additional fields via `VtigerCustomFieldMapping`

#### 4.2 Customer Update Hook
- **Location**: `apps/api/src/services/customer.service.ts`
- **Trigger**: When customer data changes
- **Action**: Queue customer update sync to VTiger
- **Note**: Create VTiger note for significant changes (e.g., dependant added)

#### 4.3 Dependant Addition Hook
- **Location**: `apps/api/src/services/customer.service.ts`
- **Trigger**: When dependant is added to customer
- **Action**: Create note in VTiger contact: "Dependant [name] added on [date]"

#### 4.4 Payment Recording Hook
- **Location**: `apps/api/src/services/policy.service.ts`
- **Trigger**: When payment is recorded
- **Action**: Update VTiger contact with payment info (via custom field or note)
- **Weekly Summary**: Scheduled job to generate weekly payment summaries

#### 4.5 Missing Requirements Hook
- **Location**: `apps/api/src/services/missing-requirement.service.ts`
- **Trigger**: When missing requirement is created
- **Action**: Create task in VTiger assigned to customer_care role users
- **Task Details**: Customer name, requirement type, field path, due date

#### 4.6 User Creation Hook
- **Location**: `apps/api/src/services/partner-management.service.ts` (or new user service)
- **Trigger**: When user is created with `createVtigerUser = true`
- **Action**: Create user in VTiger with same email/password
- **Link**: Store VTiger user ID in BrandAmbassador record

#### 4.7 User Status Change Hook
- **Location**: User management service (where `isActive` is updated)
- **Trigger**: When user `isActive` status changes
- **Action**: Update user status in VTiger (if `vtigerUserId` exists)
- **Queue**: `vtiger.user.update` queue
- **Behavior**: 
  - If disabled in MicroBima → Disable in VTiger
  - If enabled in MicroBima → Enable in VTiger

#### 4.8 Password Reset Hook
- **Location**: Password reset service
- **Trigger**: When password is reset for user with VTiger account
- **Action**: Reset password in both MicroBima (Supabase) and VTiger
- **Queue**: `vtiger.user.password-reset` queue
- **Behavior**: Same password set in both systems simultaneously

### 5. VTiger Webhook Handler

#### 5.1 Lead Conversion Webhook
- **Endpoint**: `POST /api/internal/vtiger/webhooks/lead-convert`
- **Purpose**: Handle lead conversion from VTiger
- **Action**: Create customer in MicroBima when lead is converted to contact
- **Location**: `apps/api/src/controllers/internal/vtiger-webhook.controller.ts`

### 6. Scheduled Jobs

#### 6.1 Weekly Payment Summary Job
- **Frequency**: Weekly (e.g., Monday mornings)
- **Purpose**: Generate and send payment summaries to VTiger
- **Data**: Total payments, payment count, average payment, date range
- **Location**: `apps/api/src/jobs/vtiger-payment-summary.job.ts`

#### 6.2 Sync Retry Job
- **Frequency**: Every 5 minutes
- **Purpose**: Retry failed sync operations
- **Logic**: Process items in `VtigerSyncQueue` with status FAILED and retryCount < maxRetries
- **Location**: `apps/api/src/jobs/vtiger-sync-retry.job.ts`

### 7. User Management Endpoints

#### 7.1 Sync Existing User to VTiger
- **Endpoint**: `POST /api/internal/vtiger/users/:userId/sync`
- **Purpose**: Manually sync existing user to VTiger
- **Request**: 
  ```json
  {
    "password": "new-password" // Optional - generates if not provided
  }
  ```
- **Response**: VTiger user ID and sync status
- **Action**: 
  1. Generate new password if not provided
  2. Reset password in Supabase (MicroBima)
  3. Create user in VTiger with new password
  4. Store `vtigerUserId` in BrandAmbassador record
- **Location**: `apps/api/src/controllers/internal/vtiger-user.controller.ts`
- **Use Case**: For existing users who don't have VTiger accounts yet

#### 7.2 Update User Status in VTiger
- **Endpoint**: `PATCH /api/internal/vtiger/users/:userId/status`
- **Purpose**: Sync user active/inactive status to VTiger
- **Request**:
  ```json
  {
    "isActive": true/false
  }
  ```
- **Action**: Update VTiger user status based on MicroBima user status
- **Location**: `apps/api/src/controllers/internal/vtiger-user.controller.ts`
- **Use Case**: When user is disabled/enabled in Manage Agents page

#### 7.3 Reset User Password (Both Systems)
- **Endpoint**: `POST /api/internal/vtiger/users/:userId/reset-password`
- **Purpose**: Reset password in both MicroBima and VTiger
- **Request**:
  ```json
  {
    "newPassword": "password" // Optional - generates if not provided
  }
  ```
- **Action**: Reset password in Supabase and VTiger simultaneously
- **Location**: `apps/api/src/controllers/internal/vtiger-user.controller.ts`
- **Use Case**: When syncing existing user or manual password reset

### 8. UI Components

#### 8.1 User Creation Form Enhancement
- **Location**: `apps/agent-registration/src/app/(main)/admin/ba-management/_components/create-ba-dialog.tsx`
- **Change**: Add checkbox "Create VTiger User" (checked by default)
- **Action**: Pass `createVtigerUser` flag to API

#### 8.2 User Management Page Enhancement
- **Location**: `apps/agent-registration/src/app/(main)/admin/ba-management/` (agent list/table component)
- **Features**:
  - Display VTiger sync status badge (Synced/Not Synced) based on `vtigerUserId` field
    - If `vtigerUserId` is null → Show "Not Synced" badge and "Sync to VTiger" button
    - If `vtigerUserId` is not null → Show "Synced" badge and VTiger user link
  - Add "Sync to VTiger" button for users where `vtigerUserId` is null
  - Button triggers password reset in both systems and creates user in VTiger
  - Show VTiger user link if synced
  - Display sync status in user list/table
- **API Endpoint**: `POST /api/internal/vtiger/users/:userId/sync` - Sync existing user to VTiger
- **Password Behavior**: 
  - If password provided → Use that password for both systems
  - If password not provided → Generate secure random password and reset in both systems

#### 8.3 User Status Sync
- **Location**: User disable/enable functionality in Manage Agents page
- **Trigger**: When user `isActive` status changes
- **Action**: 
  - If disabled: Disable user in VTiger (set status to Inactive)
  - If enabled: Enable user in VTiger (set status to Active)
- **API Endpoint**: `PATCH /api/internal/vtiger/users/:userId/status` - Update VTiger user status
- **Automatic**: Happens automatically when user status changes in MicroBima

#### 8.4 Password Reset Integration
- **Location**: Password reset functionality
- **Feature**: When password is reset for user with VTiger account:
  - Reset password in MicroBima (Supabase)
  - Reset password in VTiger via API
  - Both systems use same password
- **API Endpoint**: `POST /api/internal/vtiger/users/:userId/reset-password` - Reset password in both systems
- **Use Case**: When syncing existing user to VTiger, password must be set/reset in both systems

#### 8.5 VTiger Link in Customer View
- **Location**: Customer detail pages
- **Feature**: Display VTiger contact link if synced
- **Format**: Link to `https://maishapoa.co.ke/vcrm/index.php?module=Contacts&view=Detail&record={vtigerContactId}`

#### 8.6 VTiger Sync Status Display
- **Location**: Customer detail pages
- **Feature**: Show sync status, last synced time, errors
- **UI**: Status badge with tooltip

### 9. VTiger Setup Instructions

#### 9.1 API Access Setup
1. Log into VTiger at maishapoa.co.ke/vcrm
2. Go to Settings > Users & Access Control > Users
3. Create API user or use existing admin user
4. Go to user profile > Access Key tab
5. Generate Access Key (copy and store securely)
6. Note username (usually email)

#### 9.2 Custom Fields Setup
1. Go to Settings > Custom Fields > Contacts
2. Create custom fields:
   - `cf_microbima_customer_id` (Text) - Store MicroBima customer ID
   - `cf_id_number` (Text) - ID number
   - `cf_weekly_payment_total` (Number) - Weekly payment summary
   - `cf_last_payment_date` (Date) - Last payment date
   - `cf_payment_count` (Number) - Total payment count
3. Note field names for mapping configuration

#### 9.3 User Role Setup
1. Create "Customer Care" role in VTiger
2. Assign users to this role
3. Note role ID for task assignment

### 10. Error Handling & Monitoring

#### 10.1 Sync Failure Handling
- Queue operations don't block main flow
- Failed operations stored in `VtigerSyncQueue`
- Automatic retry with exponential backoff
- Manual retry endpoint for admin users

#### 10.2 Monitoring
- Log all VTiger API calls with correlation IDs
- Track sync success/failure rates
- Alert on high failure rates
- Dashboard for sync queue status

### 11. Testing Strategy

#### 11.1 Unit Tests
- VTiger API client methods
- Queue producer/consumer
- Service methods

#### 11.2 Integration Tests
- End-to-end customer sync
- Task creation flow
- User creation sync
- Payment summary generation

#### 11.3 Manual Testing Checklist
- [ ] Customer creation syncs to VTiger
- [ ] Customer updates sync to VTiger
- [ ] Dependant addition creates note
- [ ] Missing requirement creates task
- [ ] New user creation creates VTiger user (with checkbox)
- [ ] Existing user sync to VTiger (manual button)
- [ ] User sync detects missing VTiger account (null vtigerUserId)
- [ ] Password reset syncs to both systems
- [ ] User disable syncs to VTiger
- [ ] User enable syncs to VTiger
- [ ] Weekly payment summary sent
- [ ] Lead conversion creates customer
- [ ] Failed syncs retry automatically
- [ ] Custom fields map correctly
- [ ] VTiger sync status displays correctly in UI

## Implementation Order

1. **Phase 1: Foundation** (Week 1)
   - RabbitMQ setup and configuration
   - VTiger API client implementation
   - Database schema migrations
   - Basic queue infrastructure

2. **Phase 2: Customer Sync** (Week 2)
   - Customer creation sync
   - Customer update sync
   - Custom field mapping
   - Sync status tracking

3. **Phase 3: Task & User Management** (Week 3)
   - Missing requirement task creation
   - User creation sync (new users)
   - Existing user sync (manual button)
   - Customer care role setup
   - Task assignment logic

4. **Phase 4: Payment & Notes** (Week 4)
   - Payment tracking
   - Weekly payment summary
   - Note creation for changes
   - Dependant addition notes

5. **Phase 5: Bidirectional Sync** (Week 5)
   - Lead conversion webhook
   - VTiger → MicroBima customer creation
   - Link generation in VTiger
   - Sync conflict resolution

6. **Phase 6: Polish & Monitoring** (Week 6)
   - UI enhancements
   - Error handling improvements
   - Monitoring dashboard
   - Documentation
   - Testing

## Files to Create/Modify

### New Files
- `apps/api/src/services/vtiger/vtiger-api.client.ts`
- `apps/api/src/services/vtiger/vtiger.service.ts`
- `apps/api/src/services/vtiger/vtiger-queue.producer.ts`
- `apps/api/src/services/vtiger/vtiger-queue.consumer.ts`
- `apps/api/src/controllers/internal/vtiger-webhook.controller.ts`
- `apps/api/src/controllers/internal/vtiger-user.controller.ts` - User sync endpoints
- `apps/api/src/jobs/vtiger-payment-summary.job.ts`
- `apps/api/src/jobs/vtiger-sync-retry.job.ts`
- `apps/api/prisma/migrations/XXXXXX_add_vtiger_customer_sync_fields/migration.sql`
- `apps/api/prisma/migrations/XXXXXX_add_vtiger_user_sync_fields/migration.sql`
- `apps/api/prisma/migrations/XXXXXX_create_vtiger_sync_queue/migration.sql`
- `apps/api/prisma/migrations/XXXXXX_create_vtiger_custom_field_mapping/migration.sql`

### Modified Files
- `apps/api/src/services/customer.service.ts` - Add sync hooks
- `apps/api/src/services/missing-requirement.service.ts` - Add task creation
- `apps/api/src/services/policy.service.ts` - Add payment sync
- `apps/api/src/services/partner-management.service.ts` - Add user status sync hooks, password reset integration
- `apps/api/src/config/configuration.service.ts` - Add VTiger config
- `apps/api/prisma/schema.prisma` - Add VTiger models
- `apps/api/src/app.module.ts` - Register VTiger services
- `apps/agent-registration/src/app/(main)/admin/ba-management/_components/create-ba-dialog.tsx` - Add checkbox
- `apps/agent-registration/src/app/(main)/admin/ba-management/_components/edit-ba-dialog.tsx` - Add VTiger sync button and status display
- `apps/agent-registration/src/app/(main)/admin/ba-management/page.tsx` - Add VTiger sync status column and sync button
- `apps/agent-registration/src/lib/supabase.ts` - Add customer_care role
- `apps/agent-registration/src/lib/api.ts` - Add VTiger user sync API functions

## Dependencies to Add

```json
{
  "amqplib": "^0.10.3",
  "@nestjs/bull": "^10.0.1",
  "bull": "^4.11.5"
}
```

## Key Requirements Summary

### User Sync Detection
- **Detection Mechanism**: Check `vtigerUserId` field in `BrandAmbassador` table
  - If `vtigerUserId` is `null` → User does NOT exist in VTiger CRM
  - If `vtigerUserId` is NOT `null` → User exists in VTiger CRM
- **UI Behavior**: 
  - Show "Sync to VTiger" button only when `vtigerUserId` is null
  - Show "Synced" badge and VTiger link when `vtigerUserId` is not null

### Password Management
- **When syncing existing user to VTiger**:
  - Password must be set/reset in BOTH MicroBima (Supabase) and VTiger
  - If password provided → Use that password for both systems
  - If password not provided → Generate secure random password and reset in both systems
- **Password Reset**: When password is reset for user with VTiger account, update both systems simultaneously

### User Status Sync
- **Automatic Sync**: When user is disabled/enabled in MicroBima Manage Agents page:
  - If disabled → Disable user in VTiger (set status to Inactive)
  - If enabled → Enable user in VTiger (set status to Active)
- **Only sync if user exists**: Check `vtigerUserId` is not null before syncing status

### Existing Users
- **Manual Sync Button**: For existing users who don't have VTiger accounts:
  - Button appears in agent management page when `vtigerUserId` is null
  - Clicking button triggers sync process:
    1. Generate/reset password
    2. Reset password in Supabase
    3. Create user in VTiger with same password
    4. Store `vtigerUserId` in BrandAmbassador record

## Notes

- All VTiger operations should be async and non-blocking
- Use correlation IDs for tracing across systems
- Implement idempotency for sync operations
- Store VTiger IDs for bidirectional linking
- Custom fields must be created in VTiger before mapping
- Weekly payment summaries should be configurable (day/time)
- Task assignment should support multi-select of customer_care users
- Failed syncs should be retryable manually via admin UI
- **User Sync Detection**: Check `vtigerUserId` field in BrandAmbassador table - if null, user doesn't exist in VTiger
- **Password Management**: When syncing existing users or resetting passwords, update both MicroBima (Supabase) and VTiger simultaneously
- **User Status Sync**: When user is disabled/enabled in MicroBima, automatically sync status to VTiger if user exists there (`vtigerUserId` is not null)
- **Manual Sync Button**: Only show "Sync to VTiger" button for users where `vtigerUserId` is null
- **Password Generation**: If password not provided during sync, generate secure random password and reset in both systems







