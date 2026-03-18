# M-Pesa Express Query API Implementation

## Overview

This document describes the implementation of the M-Pesa Express Query API feature, which actively queries M-Pesa for the status of pending STK Push requests. This feature improves reliability by recovering transaction statuses when callbacks are lost or delayed.

## Problem Statement

M-Pesa STK Push relies on callbacks to notify our system of transaction outcomes. However, callbacks can be:
- Lost in transit due to network issues
- Delayed beyond acceptable timeframes
- Blocked by firewalls or network restrictions

Without the Query API, these scenarios result in:
- Transactions stuck in `PENDING` status for 5+ minutes
- Poor user experience (customers wait unnecessarily)
- Manual reconciliation required

## Solution Architecture

### Query Strategy

The implementation uses a **proactive query approach** with the following timing:

1. **STK Push Prompt Timeout**: M-Pesa prompts timeout after ~30 seconds
2. **First Query**: 40 seconds after initiation (30s timeout + 10s buffer)
3. **Second Query**: 70 seconds after initiation (40s + 30s retry delay)
4. **Third Query**: 100 seconds after initiation (70s + 30s retry delay)
5. **Expiration**: 2 minutes after initiation (if still pending after 3 queries)

### Rationale for 40-Second First Query

- M-Pesa prompts disappear after ~30 seconds if customer doesn't respond
- By 30 seconds, M-Pesa has determined the outcome (success, timeout, cancelled, etc.)
- Waiting 40 seconds ensures we don't race with M-Pesa's own timeout processing
- This avoids conflicts and ensures M-Pesa has a definitive status to return

### Components

#### 1. Database Schema

Added three fields to `MpesaStkPushRequest`:

```prisma
model MpesaStkPushRequest {
  // ... existing fields ...
  queryAttemptCount Int       @default(0)  // Number of query attempts
  lastQueryAt       DateTime?              // When last queried
  nextQueryAt       DateTime?              // When to query next (null = no more queries)
  
  @@index([status, nextQueryAt, queryAttemptCount]) // For efficient query worker lookups
}
```

#### 2. Configuration

Environment variables (all optional with sensible defaults):

```bash
# Enable/disable query feature
MPESA_STK_PUSH_QUERY_ENABLED=true

# Worker runs every 15 seconds checking for requests to query
MPESA_STK_PUSH_WORKER_QUERY_INTERVAL_SECONDS=15

# First query 40 seconds after initiation
MPESA_STK_PUSH_FIRST_QUERY_DELAY_SECONDS=40

# Retry every 30 seconds
MPESA_STK_PUSH_QUERY_RETRY_DELAY_SECONDS=30

# Maximum 3 query attempts
MPESA_STK_PUSH_MAX_QUERY_ATTEMPTS=3
```

#### 3. Query Worker (Cron Job)

**Location**: `MpesaStkPushService.queryStkPushRequests()`

**Schedule**: Every 15 seconds (configurable)

**Logic**:
1. Check if feature enabled (`MPESA_STK_PUSH_QUERY_ENABLED`)
2. Acquire execution lock (prevent concurrent runs)
3. Find `PENDING` requests where:
   - `nextQueryAt <= NOW`
   - `queryAttemptCount < 3`
   - Limit to 100 requests per run
4. For each request:
   - Call M-Pesa Query API
   - Parse `ResultCode` and map to status
   - Update request with results
   - If `ResultCode = 0`: Process payment (create records, activate policy)
   - If still pending: Schedule next query
   - If failed/cancelled: Mark as terminal status
5. Release execution lock

#### 4. Daraja API Integration

**Location**: `MpesaDarajaApiService.queryStkPushStatus()`

**Endpoint**: `POST {baseUrl}/stkpushquery/v1/query`

**Request**:
```json
{
  "BusinessShortCode": "174379",
  "Password": "base64(shortcode+passkey+timestamp)",
  "Timestamp": "20260318210000",
  "CheckoutRequestID": "ws_CO_..."
}
```

**Response**:
```json
{
  "MerchantRequestID": "...",
  "CheckoutRequestID": "ws_CO_...",
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully."
}
```

**Note**: Query API does NOT return `CallbackMetadata` (amount, receipt number, etc.). We use stored data from the original STK Push request.

#### 5. Idempotency

**Callback Handler** (`handleStkPushCallback`):
- Checks if request status is `PENDING` before processing
- If not `PENDING`, logs duplicate and returns success (idempotent)
- Sets `nextQueryAt = null` when callback received (stops further queries)

**Query Worker**:
- Only queries `PENDING` requests
- Updates status atomically
- If callback arrives during query, callback's idempotency check prevents duplicate processing

#### 6. Expiration Job Updates

**Location**: `MpesaStkPushService.markExpiredStkPushRequests()`

**Updated Logic**:
Only expires requests where:
- `status = PENDING` (critical - never expire completed/failed/cancelled)
- `initiatedAt < cutoff time`
- AND (`nextQueryAt IS NULL` OR `queryAttemptCount >= 3`)

This ensures:
- Only truly unresolved requests are expired
- Requests with terminal statuses remain unchanged
- Query-exhausted requests are properly expired

## Flow Diagrams

### Scenario A: Normal Callback (No Query Needed)

```
T+0s:   STK Push initiated → PENDING, nextQueryAt = T+40s
T+5s:   Customer completes payment
T+6s:   Callback arrives → COMPLETED, nextQueryAt = null
T+40s:  Query worker runs → Skips (status not PENDING)
```

### Scenario B: Lost Callback, Query Recovers

```
T+0s:   STK Push initiated → PENDING, nextQueryAt = T+40s
T+5s:   Customer completes payment
T+6s:   Callback sent but lost in transit
T+40s:  Query #1 → ResultCode 0 → COMPLETED, payment processed ✅
```

### Scenario C: Customer Timeout

```
T+0s:   STK Push initiated → PENDING, nextQueryAt = T+40s
T+30s:  Prompt times out (customer didn't respond)
T+35s:  Callback arrives → FAILED (ResultCode 1037), nextQueryAt = null
T+40s:  Query worker runs → Skips (status not PENDING)
```

### Scenario D: Query Exhaustion → Expiration

```
T+0s:   STK Push initiated → PENDING, nextQueryAt = T+40s
T+40s:  Query #1 → Still pending, queryAttemptCount = 1, nextQueryAt = T+70s
T+70s:  Query #2 → Still pending, queryAttemptCount = 2, nextQueryAt = T+100s
T+100s: Query #3 → Still pending, queryAttemptCount = 3, nextQueryAt = null
T+120s: Expiration job → EXPIRED ✅
```

## Deployment Strategy

### Feature Flag

The query feature is controlled by `MPESA_STK_PUSH_QUERY_ENABLED`:
- `false` (default): Feature disabled, no queries performed
- `true`: Feature enabled, queries run as configured

### Rollout Plan

1. **Deploy to Staging**:
   ```bash
   # Deploy code with feature disabled
   fly deploy -a microbima-api-staging
   
   # Enable feature
   fly secrets set MPESA_STK_PUSH_QUERY_ENABLED=true -a microbima-api-staging
   ```

2. **Monitor for 24-48 hours**:
   - Check logs for `STK_PUSH_QUERY_*` events
   - Verify query success rate
   - Monitor API call volume to M-Pesa
   - Check for any errors or issues

3. **Deploy to Production**:
   ```bash
   # Deploy code with feature disabled
   fly deploy -a microbima-api-production
   
   # Enable feature after monitoring
   fly secrets set MPESA_STK_PUSH_QUERY_ENABLED=true -a microbima-api-production
   ```

### Rollback

If issues occur:
```bash
# Disable feature immediately (no redeployment needed)
fly secrets set MPESA_STK_PUSH_QUERY_ENABLED=false -a <app-name>
```

## Monitoring & Observability

### Key Log Events

- `STK_PUSH_QUERY_JOB_STARTED`: Worker execution started
- `STK_PUSH_QUERY_REQUEST`: Query API called
- `STK_PUSH_QUERY_RESULT`: Query response received
- `STK_PUSH_QUERY_PAYMENT_PROCESSED`: Payment processed from query
- `STK_PUSH_QUERY_ERROR`: Query failed
- `STK_PUSH_QUERY_JOB_SKIPPED`: Concurrent execution prevented
- `STK_PUSH_CALLBACK_DUPLICATE`: Callback received for non-pending request

### Metrics to Track

1. **Query Success Rate**: Percentage of queries returning definitive status
2. **Recovery Rate**: Percentage of transactions recovered by query vs callback
3. **Query Latency**: Time from initiation to status recovery
4. **API Call Volume**: Number of query API calls per hour
5. **Expiration Rate**: Percentage of requests reaching expiration

### Sentry Integration

All query errors are captured in Sentry with tags:
- `operation: 'queryStkPushStatus'`
- `checkoutRequestId`
- `attempt` number

## Performance Considerations

### Batch Size Limit

Query worker processes maximum 100 requests per run to:
- Prevent long-running jobs
- Avoid worker overlap
- Maintain responsiveness

### Execution Lock

The `isQueryJobRunning` flag prevents concurrent worker executions:
- If previous run still processing, new run is skipped
- Logged as `STK_PUSH_QUERY_JOB_SKIPPED`
- Ensures predictable resource usage

### Database Indexes

Composite index on `(status, nextQueryAt, queryAttemptCount)` ensures:
- Fast lookup of requests needing query
- Efficient filtering by status
- Optimal query performance

## Testing

### Manual Testing

1. **Normal Flow**:
   - Initiate STK Push
   - Complete payment on phone
   - Verify callback received
   - Confirm query worker skips (status not PENDING)

2. **Lost Callback**:
   - Initiate STK Push
   - Complete payment on phone
   - Block callback (firewall rule or network)
   - Wait 40 seconds
   - Verify query recovers status
   - Verify payment processed

3. **Customer Timeout**:
   - Initiate STK Push
   - Don't respond to prompt
   - Wait 40 seconds
   - Verify callback or query marks as FAILED

4. **Query Exhaustion**:
   - Initiate STK Push
   - Don't respond to prompt
   - Block callback
   - Wait for 3 queries (40s, 70s, 100s)
   - Wait for expiration (120s)
   - Verify status = EXPIRED

### Integration Tests

See `apps/api/src/services/__tests__/mpesa-stk-push.service.spec.ts` for:
- Query worker unit tests
- Idempotency tests
- Expiration logic tests

## Troubleshooting

### Issue: Queries not running

**Check**:
1. Is `MPESA_STK_PUSH_QUERY_ENABLED=true`?
2. Are there PENDING requests with `nextQueryAt <= NOW`?
3. Check logs for `STK_PUSH_QUERY_JOB_SKIPPED` (worker overlap)

### Issue: Queries failing

**Check**:
1. M-Pesa API credentials correct?
2. Network connectivity to M-Pesa?
3. Check Sentry for error details
4. Verify `CheckoutRequestID` is valid

### Issue: Duplicate payment processing

**Check**:
1. Idempotency check in callback handler working?
2. Database transaction isolation level?
3. Check logs for `STK_PUSH_CALLBACK_DUPLICATE` events

## Future Enhancements

1. **Adaptive Query Timing**: Adjust query intervals based on historical callback latency
2. **Query Result Caching**: Cache query results to avoid redundant API calls
3. **Webhook Retry**: Implement webhook retry mechanism for failed callbacks
4. **Dashboard**: Real-time monitoring dashboard for query metrics

## References

- [M-Pesa Express STK Push Documentation](./mpesa_documentation/mpesa_express_stkpush.md)
- [M-Pesa Express Query API Documentation](./mpesa_documentation/mpesa_express_query.md)
- [Error Handling Guide](./development/error-handling-guide.md)
