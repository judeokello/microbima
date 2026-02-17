# Messaging Implementation Configuration Guide

## ✅ Status: External Integrations

### 1. SendGrid (@sendgrid/mail) - ✅ **CONFIGURED**

**Package Installed**: `@sendgrid/mail@8.1.6`

**What's Configured**:
- Full SendGrid SDK integration in `SendGridEmailService`
- Automatic initialization with API key
- Error handling and logging
- Message ID extraction from responses

**Required Environment Variables**:
```bash
# Add to your .env file:
SENDGRID_API_KEY=SG.your_api_key_here_from_sendgrid_dashboard
SENDGRID_FROM_EMAIL=verified-sender@yourdomain.com  # Must be verified in SendGrid
```

**How to Get SendGrid Credentials**:
1. Sign up at https://sendgrid.com (free tier available)
2. Navigate to **Settings > API Keys** > **Create API Key**
3. Grant "Full Access" or at minimum "Mail Send" permission
4. Copy the API key (only shown once!)
5. Verify your sender email in **Settings > Sender Authentication**

**Documentation**: https://deepwiki.com/sendgrid/sendgrid-nodejs

---

### 2. Africa's Talking (Direct API) - ✅ **CONFIGURED**

**Package Installed**: Uses `axios` (already in dependencies) - No dedicated SDK needed

**What's Configured**:
- Direct HTTP integration with Africa's Talking Bulk SMS API
- URL-encoded form data submission
- Response parsing for message IDs and costs
- Status code handling (101=Sent, 102=Queued)

**Required Environment Variables**:
```bash
# Add to your .env file:
AFRICAS_TALKING_API_KEY=your_api_key_from_dashboard
AFRICAS_TALKING_USERNAME=your_app_username  # Usually your app name
AFRICAS_TALKING_SENDER_ID=YOUR_SENDER_ID    # Optional - approved sender ID
```

**How to Get Africa's Talking Credentials**:
1. Sign up at https://africastalking.com
2. Create an application in your dashboard
3. Get your **API Key** from Settings
4. Your **Username** is your application name (e.g., "sandbox" for testing)
5. Request and get approved a **Sender ID** for production (optional for testing)

**API Documentation**:
- Sending SMS: https://developers.africastalking.com/docs/sms/sending/bulk
- Delivery Reports: https://developers.africastalking.com/docs/sms/notifications

---

### 3. Supabase Storage - ✅ **ALREADY CONFIGURED**

**Status**: ✅ **Your project already has Supabase configured and working!**

**Existing Setup**:
- `SupabaseService` already initialized in `apps/api/src/services/supabase.service.ts`
- Currently used for auth and database operations
- Can be used for storage via `supabaseService.getClient().storage`

**Required Environment Variables** (likely already set):
```bash
# Already in your .env (check these exist):
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_MESSAGING_ATTACHMENTS_BUCKET=messaging-attachments  # New bucket name
```

**What You Need to Do**:
1. **Create a new Storage bucket** in your Supabase dashboard:
   - Go to Storage > Create bucket
   - Name it: `messaging-attachments`
   - Set to **Private** (not public)
   - Enable RLS policies if needed (service role bypasses RLS)

2. **No code changes needed** - the `MessagingAttachmentService` already has `SupabaseService` injected and ready to use

**Storage Operations Available**:
```typescript
const client = this.supabaseService.getClient();

// Upload file
await client.storage
  .from('messaging-attachments')
  .upload(`${deliveryId}/filename.pdf`, fileBuffer);

// Download file
const { data } = await client.storage
  .from('messaging-attachments')
  .download(`${deliveryId}/filename.pdf`);

// Delete file
await client.storage
  .from('messaging-attachments')
  .remove([`${deliveryId}/filename.pdf`]);
```

---

## ⚠️ Status: Rate Limiting Middleware

### Current Status: **NOT CONFIGURED**

**What Exists**:
- Config placeholder in `ConfigurationService` (windowMs/max)
- **No actual middleware** applied

**What's Needed**:
Install `@nestjs/throttler` and configure it for webhook endpoints:

```bash
pnpm -C apps/api add @nestjs/throttler
```

**Implementation Needed** (T037):
1. Add `ThrottlerModule` to `app.module.ts`
2. Apply `@Throttle()` decorator to webhook controllers
3. Configure:
   - **Per-IP limit**: 60 requests/minute
   - **Global limit**: 1000 requests/minute

**Priority**: Medium - Can be added after core messaging works

---

## 🔒 Webhook Signature Verification

### Africa's Talking Signature - **DOCUMENTED**

**Documentation**: https://developers.africastalking.com/docs/sms/notifications

**What's Provided**:
According to the docs, Africa's Talking includes a verification hash in delivery notifications.

**Implementation Status**: ⏳ **Deferred**
- Per your decision (C1), this is intentionally left for a separate spec
- Webhooks currently accept payloads without verification
- Rate limiting (when added) provides basic abuse protection

**When to Implement**:
- Create a separate spec for webhook security hardening
- Include signature verification for both SendGrid and Africa's Talking
- Add IP whitelisting if providers support it

---

## 📋 Manual Validation Steps (Quickstart)

### What is `quickstart.md`?

It's a **step-by-step manual testing guide** at:
```
/specs/001-customer-messaging/quickstart.md
```

**Purpose**: Verify the messaging implementation works end-to-end in your development environment

**Key Test Scenarios**:
1. **Seed Configuration** - Create templates, routes, system settings
2. **Enqueue Messages** - Trigger policy purchase, verify async queueing
3. **Worker Processing** - Watch deliveries transition PENDING → PROCESSING → SENT
4. **Language Fallback** - Request `sw` template, fallback to `en`
5. **Webhooks** - Send test payloads, verify idempotency
6. **Resend** - Test SMS and email resend with attachment handling
7. **Render Failures** - Missing placeholders create FAILED deliveries with Sentry reports

**When to Use It**:
- After completing implementation (T032-T038)
- Before deploying to staging
- To verify your env vars are correct
- To demonstrate the feature to stakeholders

---

## 🎯 Summary: What You Need to Do Next

### Immediate Actions:

1. **Add SendGrid env vars** to your `.env`:
   ```bash
   SENDGRID_API_KEY=SG.xxx
   SENDGRID_FROM_EMAIL=verified@yourdomain.com
   ```

2. **Add Africa's Talking env vars**:
   ```bash
   AFRICAS_TALKING_API_KEY=xxx
   AFRICAS_TALKING_USERNAME=sandbox  # or your app name
   AFRICAS_TALKING_SENDER_ID=YOURAPP # optional
   ```

3. **Create Supabase Storage bucket**:
   - Go to Supabase dashboard > Storage
   - Create `messaging-attachments` (private)
   - Add env var: `SUPABASE_MESSAGING_ATTACHMENTS_BUCKET=messaging-attachments`

### Later (After Core Works):

4. **Install rate limiting** (T037):
   ```bash
   pnpm -C apps/api add @nestjs/throttler
   ```

5. **Run manual validation** using `quickstart.md` steps

6. **Webhook signature verification** - Create separate spec as discussed

---

## ❓ Your Questions Answered

**Q: "Do I need to configure anything in SendGrid?"**
- Yes: Get API key + verify your sender email in SendGrid dashboard
- The code is already configured to use it

**Q: "Where do I configure Africa's Talking API key?"**
- In your `.env` file as `AFRICAS_TALKING_API_KEY`
- ConfigurationService already reads it via `this.config.messaging.africasTalkingApiKey`

**Q: "Is there Supabase-specific setup needed?"**
- ✅ Supabase client is already working in your project!
- Just create the `messaging-attachments` storage bucket
- No code changes needed

**Q: "Do we have rate limiting middleware?"**
- ❌ Not yet installed/configured
- Need to add `@nestjs/throttler` for webhook protection (T037)
- Config placeholders exist but aren't used

**Q: "Is Africa's Talking signature verification enough?"**
- Yes, the docs provide it
- BUT you decided to defer this to a separate spec (good call)
- Current priority: Get core messaging working first

**Q: "What are the quickstart steps?"**
- A manual testing guide in `specs/001-customer-messaging/quickstart.md`
- Use it to verify everything works after implementation
- Covers: seeding, enqueueing, worker, webhooks, resend, failures

---

## 🚀 Ready to Continue?

With this configuration knowledge, we can now:
1. **Build** and verify the current implementation compiles
2. **Complete remaining tasks** (T032-T038): attachments, webhooks, rate limiting
3. **Test locally** using quickstart.md once env vars are set

**Next Step**: Would you like me to continue implementing the remaining tasks (attachments service, webhook controllers, rate limiting)?
