# WebSocket Real-Time Payment Status Updates

## Overview

This feature provides real-time payment status updates for STK Push payments using WebSocket connections. Agents receive instant notifications when payment status changes (via M-Pesa callbacks, query jobs, or expiration jobs) without requiring page refreshes.

## Architecture

### Components

1. **Backend WebSocket Gateway** (`/payment-status` namespace)
   - Handles client connections and authentication
   - Manages subscriptions to payment requests
   - Emits status updates to subscribed clients

2. **Base WebSocket Gateway** (shared functionality)
   - Subscription management (in-memory Map)
   - Client cleanup on disconnect
   - Logging utilities

3. **STK Push Service Integration**
   - Emits WebSocket events on status changes
   - Triggered by: callbacks, query jobs, expiration jobs

4. **Frontend Custom Hook** (`usePaymentStatus`)
   - Connects to WebSocket gateway
   - Handles authentication, reconnection, and subscriptions
   - Provides status updates via callbacks

5. **Payment Page UI**
   - Real-time status display (processing, completed, failed, etc.)
   - Contextual action buttons
   - Connection indicator and elapsed timer

### Data Flow

```
┌─────────────────┐         WebSocket         ┌──────────────────┐
│   Frontend      │◄──────────────────────────►│   NestJS API     │
│  (Next.js)      │     Status Updates         │   (Gateway)      │
└─────────────────┘                            └──────────────────┘
         │                                              │
         │ 1. Initiate STK Push                        │
         ├──────────────────────────────────────────►  │
         │                                              │
         │ 2. Connect WebSocket (stkPushRequestId)     │
         ├──────────────────────────────────────────►  │
         │                                              │
         │                                              │ 3. M-Pesa Callback
         │                                              │◄──────────────────
         │                                              │
         │ 4. Emit status update via WebSocket         │
         │◄─────────────────────────────────────────── │
```

## Backend Implementation

### Files Created

- `apps/api/src/gateways/base-websocket.gateway.ts` - Base gateway with shared functionality
- `apps/api/src/gateways/payment-status.gateway.ts` - Payment status WebSocket gateway

### Files Modified

- `apps/api/src/services/mpesa-stk-push.service.ts` - Added WebSocket emit calls
- `apps/api/src/app.module.ts` - Registered PaymentStatusGateway
- `apps/api/.env` - Added AGENT_REGISTRATION_URL
- `apps/api/env.example` - Added AGENT_REGISTRATION_URL

### WebSocket Gateway Configuration

**Namespace**: `/payment-status`

**CORS**: Allows connections from `AGENT_REGISTRATION_URL` (configured in .env)

**Authentication**: JWT token required (sent during handshake)

**Events Handled**:
- `connection` - Client connects, authenticate via JWT
- `disconnect` - Client disconnects, cleanup subscriptions
- `subscribe-payment` - Subscribe to specific `stkPushRequestId`
- `unsubscribe-payment` - Unsubscribe from updates

**Events Emitted**:
- `subscribed` - Confirmation of subscription
- `payment-status-update` - Real-time status updates

### PaymentStatusUpdate Interface

```typescript
interface PaymentStatusUpdate {
  stkPushRequestId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  resultCode?: string;
  resultDesc?: string;
  timestamp: string;
  message: string; // User-friendly message
}
```

### When WebSocket Events Are Emitted

1. **M-Pesa Callback** (`handleStkPushCallback`)
   - After updating request status in database
   - For all status changes (COMPLETED, FAILED, CANCELLED)

2. **Query Job** (`queryStkPushRequests`)
   - After query discovers status change
   - Only if status changed from PENDING

3. **Expiration Job** (`markExpiredStkPushRequests`)
   - After marking requests as EXPIRED
   - For each expired request

## Frontend Implementation

### Files Created

- `apps/agent-registration/src/hooks/usePaymentStatus.ts` - Custom hook for WebSocket connection

### Files Modified

- `apps/agent-registration/src/app/(main)/register/payment/page.tsx` - Added real-time UI states
- `apps/agent-registration/.env.local` - Added `NEXT_PUBLIC_SOCKET_API_ORIGIN`

### usePaymentStatus Hook

**Purpose**: Connects to WebSocket and provides real-time payment status updates

**Parameters**:
```typescript
{
  stkPushRequestId: string | null;
  onStatusUpdate?: (update: PaymentStatusUpdate) => void;
  onComplete?: (update: PaymentStatusUpdate) => void;
  onError?: (update: PaymentStatusUpdate) => void;
}
```

**Returns**:
```typescript
{
  status: PaymentStatusUpdate | null;
  isConnected: boolean;
  disconnect: () => void;
}
```

**Features**:
- Auto-connect when `stkPushRequestId` is provided
- Auto-reconnect on connection loss (5 attempts, 1s delay)
- Subscribe to payment updates on connect
- Unsubscribe and disconnect on unmount
- Send JWT token during handshake

### UI States

1. **Processing** (`paymentStatus === 'processing'`)
   - Animated spinner
   - Connection indicator (green = connected, orange = reconnecting)
   - Elapsed timer
   - Instructional text for customer

2. **Completed** (`paymentStatus === 'completed'`)
   - Success checkmark
   - Transaction details
   - Action buttons: Dashboard, Register Another Customer

3. **Failed/Cancelled** (`paymentStatus === 'failed' | 'cancelled'`)
   - Error icon
   - Error message
   - Action buttons: Try Again, Dashboard, Register Another Customer

4. **Expired** (`paymentStatus === 'expired'`)
   - Clock icon
   - Timeout message
   - Action buttons: Try Again, Dashboard, Register Another Customer

### Action Handlers

1. **Try Again** (`handleTryAgain`)
   - Resets payment state
   - Re-initiates STK push with same customer data
   - Generates new `stkPushRequestId`

2. **Register Another Customer** (`handleRegisterAnother`)
   - Clears localStorage (customer, beneficiary, IDs)
   - Navigates to `/register/customer`

3. **Dashboard** (inline)
   - Navigates to `/dashboard`

## Configuration

### Backend Environment Variables

```bash
# apps/api/.env
AGENT_REGISTRATION_URL=http://localhost:3000  # Frontend URL for CORS
JWT_SECRET=<existing-value>                    # For JWT authentication
```

### Frontend Environment Variables

```bash
# apps/agent-registration/.env.local
NEXT_PUBLIC_SOCKET_API_ORIGIN=http://localhost:3001  # Internal API origin (without /api) for Socket.IO
```

## Testing

### Manual Testing Scenarios

1. **Happy Path**: Customer completes payment within 30s
2. **Cancellation**: Customer cancels M-Pesa prompt
3. **Timeout**: Customer ignores prompt, query job discovers status
4. **Network Issues**: Callback lost, query job recovers payment
5. **Reconnection**: Agent's internet drops and reconnects
6. **Try Again**: Payment fails, agent retries
7. **Register Another**: Agent starts new registration
8. **Dashboard Navigation**: Agent navigates to dashboard

### Testing Locally

1. Start backend: `cd apps/api && pnpm start:dev`
2. Start frontend: `cd apps/agent-registration && pnpm dev`
3. Navigate to payment page: http://localhost:3000/register/payment
4. Initiate STK push and observe real-time updates

### Debugging

**Backend Logs** (structured JSON):
```json
{"event":"WEBSOCKET_CLIENT_CONNECTED","clientId":"abc123","userId":"user-456","timestamp":"..."}
{"event":"WEBSOCKET_SUBSCRIBED","stkPushRequestId":"req-789","clientId":"abc123","timestamp":"..."}
{"event":"WEBSOCKET_STATUS_EMITTED","stkPushRequestId":"req-789","status":"COMPLETED","subscriberCount":1,"timestamp":"..."}
```

**Frontend Logs** (console):
```
[usePaymentStatus] Connecting to WebSocket: {...}
[usePaymentStatus] WebSocket connected: socket-abc123
[usePaymentStatus] Subscribed to payment: req-789
[usePaymentStatus] Status update received: {...}
```

**Common Issues**:

1. **WebSocket not connecting**
   - Check NEXT_PUBLIC_SOCKET_API_ORIGIN is set correctly (build-time on Fly)
   - Check AGENT_REGISTRATION_URL in backend .env
   - Check JWT token is available in localStorage

2. **No status updates received**
   - Check client is subscribed (look for "Subscribed to payment" log)
   - Check backend is emitting events (look for "WEBSOCKET_STATUS_EMITTED" log)
   - Check stkPushRequestId matches between frontend and backend

3. **Authentication failed**
   - Check JWT_SECRET matches between environments
   - Check token is not expired
   - Check token is sent in handshake (`auth.token`)

## Monitoring

### Metrics to Track

- WebSocket connections (active count)
- Subscription count per payment
- Status update emissions
- Authentication failures
- Reconnection attempts

### Logs to Monitor

- `WEBSOCKET_CLIENT_CONNECTED` - New connections
- `WEBSOCKET_AUTH_FAILED` - Authentication failures
- `WEBSOCKET_SUBSCRIBED` - Subscription events
- `WEBSOCKET_STATUS_EMITTED` - Status updates sent
- `WEBSOCKET_NO_SUBSCRIBERS` - Updates with no listeners

## Scaling Considerations

### Current Implementation (Single Instance)

- In-memory Map for subscriptions
- Works for single API container
- No Redis required

### Future Scaling (Multiple Instances)

When deploying with multiple API containers, add Redis adapter:

```typescript
// apps/api/src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.REDIS_URL) {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    const io = app.get(Server);
    io.adapter(createAdapter(pubClient, subClient));
  }

  await app.listen(3001);
}
```

**Environment Variable**:
```bash
REDIS_URL=redis://localhost:6379  # Production only
```

## Future Enhancements

1. **Admin Dashboard WebSocket** (`/admin-dashboard` namespace)
   - Real-time metrics and analytics
   - Multiple admin users watching same data

2. **Notification WebSocket** (`/notifications` namespace)
   - General alerts and notifications
   - User-specific notifications

3. **Rate Limiting**
   - Per-client rate limits
   - Batch updates for high-frequency events

4. **Persistent Subscriptions**
   - Store subscriptions in Redis
   - Survive server restarts

## References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [M-Pesa STK Push Documentation](./mpesa_documentation/mpesa_express_stkpush.md)
- [M-Pesa Query Implementation](./mpesa_express_query_implementation.md)
