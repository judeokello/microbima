# Webhook Signature Verification Explained

## What Is It?

**Webhook signature verification** is a security mechanism where providers (SendGrid, Africa's Talking) cryptographically sign their webhook payloads so you can verify that:
1. The request **actually came from the provider** (not a malicious actor)
2. The payload **wasn't tampered with** during transit

## The Problem (Why You Need It)

Your webhook endpoints are **public** (no authentication):
```
POST https://api.microbima.com/webhooks/messaging/sendgrid/events
POST https://api.microbima.com/webhooks/messaging/africas-talking/sms
```

**Anyone on the internet** can POST to these URLs, which means:

### Attack Scenario 1: **Fake Delivery Reports**
```bash
# Attacker sends fake "delivered" event
curl -X POST https://api.microbima.com/webhooks/messaging/sendgrid/events \
  -H "Content-Type: application/json" \
  -d '[{
    "email": "customer@example.com",
    "event": "delivered",
    "sg_message_id": "fake-id-12345",
    "timestamp": 1234567890
  }]'
```

**Impact**: 
- Your system marks a message as "delivered" when it never was
- Customer support sees incorrect delivery status
- Audit trail is corrupted

### Attack Scenario 2: **Spam Your Database**
```bash
# Attacker floods your webhook with fake events
for i in {1..10000}; do
  curl -X POST https://api.microbima.com/webhooks/messaging/sendgrid/events \
    -d "[{\"event\":\"spam\",\"sg_message_id\":\"fake-$i\"}]"
done
```

**Impact**:
- Database fills with fake provider events
- Worker processes bogus data
- Increased storage/compute costs

### Attack Scenario 3: **Trigger Business Logic Exploits**
```bash
# Attacker sends events designed to exploit your webhook handler logic
curl -X POST https://api.microbima.com/webhooks/messaging/sendgrid/events \
  -d '[{"event":"dropped","reason":"Unsubscribed"}]'
```

**Impact**:
- Depending on your webhook logic, could trigger unintended side effects
- Could mark legitimate customer communications as unsubscribed/bounced

---

## How Signature Verification Works

### SendGrid Signature Verification

**How SendGrid Signs Requests**:
1. SendGrid generates a signature using HMAC-SHA256
2. Signature includes the webhook signing key (secret you configure in SendGrid)
3. SendGrid sends signature in HTTP header: `X-Twilio-Email-Event-Webhook-Signature`
4. Also sends timestamp in header: `X-Twilio-Email-Event-Webhook-Timestamp`

**How You Verify**:
```typescript
import crypto from 'crypto';

function verifySendGridSignature(
  payload: string,         // Raw request body
  signature: string,       // From X-Twilio-Email-Event-Webhook-Signature header
  timestamp: string,       // From X-Twilio-Email-Event-Webhook-Timestamp header
  signingKey: string       // Your SENDGRID_WEBHOOK_SIGNING_KEY
): boolean {
  // 1. Concatenate timestamp + payload
  const signedPayload = timestamp + payload;
  
  // 2. Generate expected signature using your signing key
  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(signedPayload)
    .digest('base64');
  
  // 3. Compare signatures (constant-time comparison to prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Usage in Controller**:
```typescript
@Post('webhooks/messaging/sendgrid/events')
async handleSendGridWebhook(@Req() req: Request) {
  const signature = req.headers['x-twilio-email-event-webhook-signature'];
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
  const rawBody = req.body; // Must be raw string, not parsed JSON!
  
  if (!this.verifySendGridSignature(rawBody, signature, timestamp, signingKey)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  
  // Process verified payload...
}
```

### Africa's Talking Signature Verification

**How Africa's Talking Signs Requests**:
Per https://developers.africastalking.com/docs/sms/notifications:
- Africa's Talking includes verification details in delivery notifications
- Exact mechanism depends on their current implementation (check latest docs)

**Typical Pattern** (you'll need to verify from docs):
```typescript
// Usually sent as query parameter or header
const providedHash = req.query.hash || req.headers['x-at-signature'];
const expectedHash = crypto
  .createHmac('sha256', apiKey)
  .update(rawPayload)
  .digest('hex');

if (providedHash !== expectedHash) {
  throw new UnauthorizedException('Invalid signature');
}
```

---

## Your Current Implementation (Intentionally Deferred)

### What You Decided (C1 High-Risk Item)

**Your Response**: 
> "I have left the public webhooks this way deliberately. I will deal with these in a separate spec"

**Translation**:
- You're **aware** of the security risk
- You're **intentionally accepting** it for now to ship faster
- You'll **harden later** in a dedicated security spec

### Current Protection (Minimal)

**What You Have Now**:
1. ⚠️ Public webhooks (no signature verification)
2. ⏳ Rate limiting (will add with T037)
3. ✅ Idempotency (prevents duplicate event processing)
4. ✅ Payload storage (audit trail for forensics)

**Risk Level**: **Medium**
- **Acceptable for development/staging** (low-value target)
- **Must fix before production** with real customer data

---

## Future Spec: Webhook Security Hardening

When you create the separate security spec, include:

### 1. Signature Verification
- SendGrid: HMAC-SHA256 verification
- Africa's Talking: Hash validation per their docs
- Reject unsigned/invalid requests with `401 Unauthorized`

### 2. Additional Protections
- **Timestamp validation**: Reject events older than 5 minutes (prevent replay attacks)
- **IP whitelisting**: If providers publish IP ranges, only accept from those
- **Request size limits**: Cap max payload size (prevent memory exhaustion)
- **Correlation with sent messages**: Only accept events for message IDs you actually sent

### 3. Implementation Priority
```
High:   Signature verification (prevents fake events)
Medium: Timestamp validation (prevents replays)
Medium: IP whitelisting (if provider supports)
Low:    Advanced forensics/monitoring
```

---

## Recommended Approach for Your Project

### Today (Get Messaging Working)

1. **Accept the risk** - no signature verification yet
2. **Add rate limiting** (T037) - basic abuse protection
3. **Monitor Sentry** - watch for suspicious webhook patterns
4. **Limit blast radius**:
   - Don't expose webhooks until messaging is tested
   - Use staging/dev subdomain for initial testing
   - Only promote to production after security hardening

### Before Production Launch

1. **Create separate spec**: "Webhook Security Hardening"
2. **Implement signature verification** for both providers
3. **Add timestamp validation**
4. **Test thoroughly** with replay attacks, tampered payloads
5. **Deploy to staging first**, observe for 1-2 weeks

### After Kong Deployment

1. **Keep both layers**:
   - Kong: Coarse rate limiting (infrastructure)
   - NestJS: Signature verification (business logic)
2. **Why both**:
   - Kong can't verify signatures (doesn't know your signing keys)
   - NestJS can't stop DDoS floods efficiently
   - Different concerns, complementary protection

---

## Summary Table

| Protection Layer | Now (No Kong) | After Kong | Purpose |
|------------------|---------------|------------|---------|
| **Signature Verification** | ❌ Deferred | ✅ Must Add | Authenticity |
| **Rate Limiting (App)** | ⏳ T037 | ✅ Keep | Per-endpoint control |
| **Rate Limiting (Kong)** | N/A | ✅ Add | Infrastructure DDoS protection |
| **Idempotency** | ✅ Done | ✅ Keep | Duplicate prevention |

---

## Action Items

### Immediate (T037):
```bash
pnpm -C apps/api add @nestjs/throttler
```
Configure webhook rate limits in code (single place).

### Before Production:
Create spec: "002-webhook-security-hardening" with:
- Signature verification (both providers)
- Timestamp validation
- IP whitelisting research
- Security testing plan

### After Kong:
- Add Kong rate limiting (infrastructure)
- Keep NestJS throttler (application)
- No changes to your API code needed!

---

## Key Takeaway

**Single Place to Configure?**
- **Yes today**: Just NestJS code
- **Yes after Kong**: Kong config (infrastructure) + NestJS code (application)
- **Different concerns**: You're configuring different aspects (coarse vs fine-grained)
- **Analogy**: Like having both a building security guard (Kong) AND door locks on individual rooms (NestJS) - different layers, both valuable
