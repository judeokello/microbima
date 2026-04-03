import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BaseWebSocketGateway } from './base-websocket.gateway';
import { ConfigurationService } from '../config/configuration.service';

/**
 * Payment Status Update Interface
 *
 * Represents a real-time payment status update sent to subscribed clients
 */
export interface PaymentStatusUpdate {
  stkPushRequestId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  resultCode?: string;
  resultDesc?: string;
  timestamp: string;
  message: string; // User-friendly message for UI display
}

/**
 * Payment Status WebSocket Gateway
 *
 * Provides real-time payment status updates for STK Push requests.
 * Clients subscribe to specific payment requests and receive instant
 * notifications when status changes occur (via callbacks, query jobs, or expiration).
 *
 * Namespace: /payment-status
 * Authentication: JWT token required
 * Transport: WebSocket with polling fallback
 */
@Injectable()
@WebSocketGateway({
  namespace: '/payment-status',
  cors: {
    origin: (origin, callback) => {
      const base = process.env.AGENT_REGISTRATION_URL ?? 'http://localhost:3000';
      const extra = process.env.PAYMENT_STATUS_WS_ALLOWED_ORIGINS;
      const allowedList = [base];
      if (extra) {
        for (const o of extra
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          if (!allowedList.includes(o)) {
            allowedList.push(o);
          }
        }
      }

      // In development, allow any origin for easier testing
      if (process.env.NODE_ENV === 'development' || !origin) {
        callback(null, true);
      } else if (allowedList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class PaymentStatusGateway
  extends BaseWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigurationService
  ) {
    super(PaymentStatusGateway.name);
  }

  /**
   * Handle new client connections
   *
   * Authenticates the client using JWT token from handshake.
   * Disconnects client if authentication fails.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract token from handshake auth or Authorization header
      const token =
        client.handshake.auth.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(
          JSON.stringify({
            event: 'WEBSOCKET_AUTH_FAILED',
            clientId: client.id,
            reason: 'No token provided',
            ip: client.handshake.address,
            timestamp: new Date().toISOString(),
          })
        );
        throw new UnauthorizedException('No token provided');
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.jwt.secret,
      });

      // Store user info in socket data for later use
      client.data.user = payload;

      this.logger.log(
        JSON.stringify({
          event: 'WEBSOCKET_CLIENT_CONNECTED',
          clientId: client.id,
          userId: payload.sub,
          userEmail: payload.email,
          ip: client.handshake.address,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'WEBSOCKET_AUTH_ERROR',
          clientId: client.id,
          error: error instanceof Error ? error.message : String(error),
          ip: client.handshake.address,
          timestamp: new Date().toISOString(),
        })
      );

      // Disconnect client on authentication failure
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   *
   * Cleans up all subscriptions for the disconnected client
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(
      JSON.stringify({
        event: 'WEBSOCKET_CLIENT_DISCONNECTED',
        clientId: client.id,
        userId: client.data.user?.sub,
        timestamp: new Date().toISOString(),
      })
    );

    // Clean up all subscriptions for this client
    this.cleanupClient(client.id);
  }

  /**
   * Handle subscription requests from clients
   *
   * Clients send this message to subscribe to payment status updates
   * for a specific STK Push request.
   */
  @SubscribeMessage('subscribe-payment')
  handleSubscribe(
    @MessageBody() data: { stkPushRequestId: string },
    @ConnectedSocket() client: Socket
  ): void {
    const { stkPushRequestId } = data;

    if (!stkPushRequestId) {
      this.logger.warn(
        JSON.stringify({
          event: 'WEBSOCKET_SUBSCRIBE_INVALID',
          clientId: client.id,
          userId: client.data.user?.sub,
          reason: 'Missing stkPushRequestId',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Security check: verify token's sub matches the requested stkPushRequestId
    const tokenSub = client.data.user?.sub;
    if (tokenSub !== stkPushRequestId) {
      this.logger.warn(
        JSON.stringify({
          event: 'WEBSOCKET_SUBSCRIBE_UNAUTHORIZED',
          clientId: client.id,
          tokenSub,
          requestedStkPushRequestId: stkPushRequestId,
          reason: 'Token sub does not match requested stkPushRequestId',
          timestamp: new Date().toISOString(),
        })
      );
      client.emit('subscription-error', {
        error: 'Unauthorized: token does not match payment request',
      });
      return;
    }

    // Add subscription
    this.addSubscription(stkPushRequestId, client.id);

    this.logger.log(
      JSON.stringify({
        event: 'WEBSOCKET_SUBSCRIBED',
        clientId: client.id,
        userId: client.data.user?.sub,
        stkPushRequestId,
        totalSubscribers: this.getSubscriberCount(stkPushRequestId),
        timestamp: new Date().toISOString(),
      })
    );

    // Send confirmation to client
    client.emit('subscribed', { stkPushRequestId });
  }

  /**
   * Handle unsubscription requests from clients
   *
   * Clients send this message to stop receiving updates for a specific payment
   */
  @SubscribeMessage('unsubscribe-payment')
  handleUnsubscribe(
    @MessageBody() data: { stkPushRequestId: string },
    @ConnectedSocket() client: Socket
  ): void {
    const { stkPushRequestId } = data;

    if (!stkPushRequestId) {
      return;
    }

    // Remove subscription
    this.removeSubscription(stkPushRequestId, client.id);

    this.logger.log(
      JSON.stringify({
        event: 'WEBSOCKET_UNSUBSCRIBED',
        clientId: client.id,
        userId: client.data.user?.sub,
        stkPushRequestId,
        remainingSubscribers: this.getSubscriberCount(stkPushRequestId),
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Emit payment status update to all subscribed clients
   *
   * Called by the STK Push service when payment status changes.
   * Sends update to all clients subscribed to the specific payment request.
   *
   * @param update - Payment status update to broadcast
   */
  emitPaymentStatusUpdate(update: PaymentStatusUpdate): void {
    const subscribers = this.getSubscribers(update.stkPushRequestId);

    if (subscribers.size === 0) {
      this.logger.debug(
        JSON.stringify({
          event: 'WEBSOCKET_NO_SUBSCRIBERS',
          stkPushRequestId: update.stkPushRequestId,
          status: update.status,
          message: 'No clients subscribed to this payment',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: 'WEBSOCKET_STATUS_EMITTED',
        stkPushRequestId: update.stkPushRequestId,
        status: update.status,
        subscriberCount: subscribers.size,
        timestamp: new Date().toISOString(),
      })
    );

    // Emit to all subscribed clients
    for (const clientId of subscribers) {
      this.server.to(clientId).emit('payment-status-update', update);
    }
  }
}
