# Customer-Created Messaging (Welcome / Notification)

When a **customer is created** via the API, the system enqueues an SMS and an email using the **`customer_created`** template key. Deliveries are sent asynchronously by the messaging worker (same as policy purchase).

## Code integration

- **Trigger**: `CustomerService.createCustomer()` (after successful create).
- **Enqueue**: `MessagingService.enqueue({ templateKey: 'customer_created', customerId, placeholderValues, correlationId })`.
- **Placeholders** (must match template body placeholders; keys `^[a-z0-9_]+$`):
  - `first_name`
  - `last_name`
  - `email`

## What you need to configure

### 1. Route

Create a route for template key **`customer_created`** with SMS and Email enabled, e.g.:

- **Internal API**: `PUT /api/internal/messaging/routes` (or equivalent) with:
  - `templateKey`: `customer_created`
  - `smsEnabled`: `true`
  - `emailEnabled`: `true`
- Or create the route via your admin/DB seed.

### 2. Templates

Create **SMS** and **Email** templates for **`customer_created`** (and language, e.g. `en`):

- **SMS**: body may use `{first_name}`, `{last_name}`, `{email}`.
- **Email**: subject and HTML body with the same placeholders.

Example (content is up to you):

- **SMS (en)**:  
  `Hi {first_name}, welcome. We've registered your account. Contact: {email}.`
- **Email (en)**  
  - Subject: `Welcome, {first_name}`  
  - Body: e.g. `Hello {first_name} {last_name}, your account is set up. Email: {email}.`

### 3. Worker

Ensure the **messaging worker** is running so enqueued deliveries are processed (same as for `POLICY_PURCHASED` / policy purchase).

## Summary

| Item            | Value            |
|-----------------|------------------|
| Template key    | `customer_created` |
| Placeholders    | `first_name`, `last_name`, `email` |
| Route           | Create with `smsEnabled: true`, `emailEnabled: true` |
| Trigger         | Customer creation in `CustomerService.createCustomer()` |
