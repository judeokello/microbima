# Rate Limiting Strategy: Kong vs NestJS Throttler

## Current Situation

You're **pausing Kong** as the API gateway for now, which means:
- No centralized API layer between clients and your NestJS API
- Need application-level rate limiting for webhook protection

## Strategy: Progressive Approach

### Phase 1: **NestJS Throttler Only** (Current - No Kong)

**When**: Now, while Kong is paused  
**Where**: Application-level protection in NestJS  
**What**: Use `@nestjs/throttler` for webhook endpoints

**Configuration Location**: Single place in code
```typescript
// apps/api/src/app.module.ts
ThrottlerModule.forRoot([
  {
    name: 'webhook-per-ip',
    ttl: 60000,  // 60 seconds
    limit: 60,   // 60 requests per IP per minute
  },
  {
    name: 'webhook-global',
    ttl: 60000,
    limit: 1000, // 1000 requests globally per minute
  }
])
```

**Pros**:
- ✅ Simple to configure and change (one place: your code)
- ✅ Works immediately without external dependencies
- ✅ Protects webhooks from abuse at application level

**Cons**:
- ⚠️ Per-instance limits (if you scale to multiple API instances)
- ⚠️ Less efficient than gateway-level filtering

---

### Phase 2: **Kong + NestJS (Hybrid)** (Future - When Kong Ready)

**When**: After you deploy Kong as entry point  
**Where**: Two-tier protection  
**What**: Kong handles bulk traffic, NestJS adds endpoint-specific rules

#### Layer 1: Kong (Entry Point - Coarse Protection)
```yaml
# Kong configuration (kong.yaml or Admin API)
plugins:
  - name: rate-limiting
    config:
      minute: 1000        # Global cap across all endpoints
      policy: redis       # Shared state across Kong nodes
      fault_tolerant: true
```

**Purpose**: 
- Protect against DDoS and bulk abuse
- Reject bad actors before they reach your API
- Shared across all Kong instances

#### Layer 2: NestJS Throttler (Application - Fine-Grained)
```typescript
// Keep existing @nestjs/throttler configuration
// Provides endpoint-specific limits + per-IP tracking
```

**Purpose**:
- Fine-grained control per endpoint
- Endpoint-specific limits (webhooks vs admin APIs)
- Per-IP tracking for legitimate traffic patterns

---

## Your Questions Answered

### Q1: "Will I need to remember to change limits in two places?"

**Answer**: **It depends on your strategy:**

#### Option A: **Kong-Only Rate Limiting** (Recommended for simplicity)
- Remove `@nestjs/throttler` after Kong is deployed
- Manage all rate limiting in Kong configuration
- **Change in one place**: Kong config files or Admin API
- **Benefit**: Single source of truth, easier to manage

#### Option B: **Two-Tier Protection** (Recommended for defense-in-depth)
- Keep both Kong (coarse) + NestJS (fine-grained)
- **Kong**: High-level limits (e.g., 1000/min globally)
- **NestJS**: Endpoint-specific limits (e.g., webhooks 60/min/IP)
- **Change management**: 
  - Kong limits: Rarely changed (broad protection)
  - NestJS limits: Adjusted per endpoint as needed
- **Benefit**: Defense-in-depth, endpoint-specific control

#### My Recommendation: **Option B (Two-Tier)**

**Why**:
1. Kong provides **infrastructure-level protection** (stops DDoS before hitting app)
2. NestJS provides **business-logic protection** (e.g., "this webhook specifically should be 60/min/IP")
3. Different concerns, different layers:
   - Kong: "Is this traffic legitimate at scale?"
   - NestJS: "Is this specific endpoint being abused?"

**Configuration Pattern**:
```typescript
// Kong (infrastructure concern - changes rarely)
Global limit: 1000 req/min across ALL endpoints

// NestJS (business concern - changes per endpoint)
Webhook endpoints: 60 req/min per IP
Admin endpoints: 100 req/min per user
Public endpoints: 30 req/min per IP
```

---

## Transition Plan: Now → Kong Deployment

### Step 1: **Current (No Kong)** ← **YOU ARE HERE**
```
Internet → NestJS API (with @nestjs/throttler on webhooks)
```

**Action**: 
```bash
pnpm -C apps/api add @nestjs/throttler
```
Configure webhook controllers with decorators.

### Step 2: **Deploy Kong** (Future)
```
Internet → Kong Gateway → NestJS API (keep @nestjs/throttler)
```

**Action**:
1. Deploy Kong in front of your API
2. Configure Kong rate limiting (broad limits)
3. **Keep NestJS throttler** (no code changes needed!)
4. Kong handles coarse filtering, NestJS handles fine-grained

**Zero Config Changes to Your API**:
- Your NestJS code stays the same
- Kong sits in front transparently
- Both layers work together

### Step 3: **Optimize** (Optional Later)
```
Internet → Kong Gateway → NestJS API (throttler removed if desired)
```

**Action** (only if you want single-tier):
- Remove `@nestjs/throttler` dependency
- Manage all limits in Kong
- Simpler but less granular control

---

## Decision Matrix

| Scenario | Use Kong? | Use NestJS Throttler? | Config Changes Where? |
|----------|-----------|----------------------|----------------------|
| **Now** (no Kong) | ❌ No | ✅ **Yes** | Code only |
| **After Kong** (recommended) | ✅ Yes | ✅ **Yes** | Kong (coarse) + Code (fine) |
| **After Kong** (simplified) | ✅ Yes | ❌ No | Kong only |

## My Recommendation for Your Project

**Today**: 
```bash
pnpm -C apps/api add @nestjs/throttler
```
Configure webhooks with 60/min/IP, 1000/min global.

**After Kong Deployment**:
- **Keep both layers** (no changes needed to your API)
- Kong handles infrastructure-level protection
- NestJS handles endpoint-specific business rules
- **Benefits**:
  - Defense-in-depth security
  - Endpoint-specific tuning without Kong config changes
  - API remains portable (works with or without Kong)

**Configuration Management**:
- **Kong limits**: Managed via IaC (terraform/kubernetes) - infrastructure team
- **NestJS limits**: Managed via code - development team
- **Rarely conflict** because they serve different purposes

---

## Summary

**Single Place to Configure**: **Yes, initially** (just NestJS code)

**After Kong**: Two places, but **by design**:
- Kong = infrastructure concern (DDoS, bulk abuse)
- NestJS = application concern (per-endpoint business rules)

**Best Practice**: Keep both after Kong is deployed. This is standard for production systems (e.g., AWS API Gateway + Lambda throttling, CloudFlare + app-level limits).
