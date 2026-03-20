import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Payment Status Update Interface
 * Matches the backend PaymentStatusUpdate interface
 */
export interface PaymentStatusUpdate {
  stkPushRequestId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  resultCode?: string;
  resultDesc?: string;
  timestamp: string;
  message: string;
}

/**
 * Hook Options Interface
 */
interface UsePaymentStatusOptions {
  stkPushRequestId: string | null;
  wsToken: string | null;
  onStatusUpdate?: (update: PaymentStatusUpdate) => void;
  onComplete?: (update: PaymentStatusUpdate) => void;
  onError?: (update: PaymentStatusUpdate) => void;
}

/**
 * Hook Return Interface
 */
interface UsePaymentStatusReturn {
  status: PaymentStatusUpdate | null;
  isConnected: boolean;
  disconnect: () => void;
}

/**
 * Custom hook for real-time payment status updates via WebSocket
 *
 * Connects to the payment-status WebSocket namespace and subscribes to
 * updates for a specific STK Push request. Automatically handles:
 * - Connection/disconnection
 * - Authentication via payment-scoped JWT token (wsToken)
 * - Reconnection on connection loss
 * - Subscription management
 * - Status update callbacks
 *
 * @param options - Hook configuration options
 * @returns Payment status, connection state, and disconnect function
 *
 * @example
 * ```tsx
 * const { status, isConnected } = usePaymentStatus({
 *   stkPushRequestId: 'req-123',
 *   wsToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 *   onComplete: (update) => {
 *     console.log('Payment completed!', update);
 *   },
 *   onError: (update) => {
 *     console.error('Payment failed', update);
 *   },
 * });
 * ```
 */
export function usePaymentStatus({
  stkPushRequestId,
  wsToken,
  onStatusUpdate,
  onComplete,
  onError,
}: UsePaymentStatusOptions): UsePaymentStatusReturn {
  const [status, setStatus] = useState<PaymentStatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleStatusUpdate = useCallback(
    (update: PaymentStatusUpdate) => {
      console.log('[usePaymentStatus] Status update received:', update);
      setStatus(update);

      // Call user-provided callback
      onStatusUpdate?.(update);

      // Call specific callbacks based on status
      if (update.status === 'COMPLETED') {
        onComplete?.(update);
      } else if (
        update.status === 'FAILED' ||
        update.status === 'CANCELLED' ||
        update.status === 'EXPIRED'
      ) {
        onError?.(update);
      }
    },
    [onStatusUpdate, onComplete, onError]
  );

  useEffect(() => {
    // Don't connect if no stkPushRequestId or wsToken provided
    if (!stkPushRequestId || !wsToken) {
      console.log('[usePaymentStatus] No stkPushRequestId or wsToken provided, skipping connection');
      return;
    }

    // Internal API origin (no /api) — Socket.IO connects to ${origin}/payment-status
    const apiUrl = process.env.NEXT_PUBLIC_SOCKET_API_ORIGIN || 'http://localhost:3001';

    console.log('[usePaymentStatus] Connecting to WebSocket:', {
      url: `${apiUrl}/payment-status`,
      stkPushRequestId,
    });

    // Create socket connection with payment-scoped wsToken
    const socket = io(`${apiUrl}/payment-status`, {
      auth: { token: wsToken }, // Send payment-scoped JWT token during handshake
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      reconnection: true, // Enable auto-reconnection
      reconnectionDelay: 1000, // Wait 1s before reconnecting
      reconnectionAttempts: 5, // Try 5 times before giving up
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[usePaymentStatus] WebSocket connected:', socket.id);
      setIsConnected(true);

      // Subscribe to payment updates
      socket.emit('subscribe-payment', { stkPushRequestId });
      console.log('[usePaymentStatus] Subscribed to payment:', stkPushRequestId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[usePaymentStatus] WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('subscribed', (data) => {
      console.log('[usePaymentStatus] Subscription confirmed:', data);
    });

    socket.on('payment-status-update', handleStatusUpdate);

    socket.on('connect_error', (error) => {
      console.error('[usePaymentStatus] Connection error:', error);
      setIsConnected(false);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[usePaymentStatus] Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[usePaymentStatus] Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('[usePaymentStatus] Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[usePaymentStatus] Reconnection failed after max attempts');
      setIsConnected(false);
    });

    // Cleanup on unmount or when stkPushRequestId changes
    return () => {
      console.log('[usePaymentStatus] Cleaning up WebSocket connection');

      if (socketRef.current) {
        socketRef.current.emit('unsubscribe-payment', { stkPushRequestId });
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setIsConnected(false);
    };
  }, [stkPushRequestId, wsToken, handleStatusUpdate]);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    console.log('[usePaymentStatus] Manual disconnect requested');

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return {
    status,
    isConnected,
    disconnect,
  };
}
