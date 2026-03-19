import { Logger } from '@nestjs/common';

/**
 * Base WebSocket Gateway
 *
 * Provides shared functionality for all WebSocket gateways:
 * - Subscription management (in-memory Map)
 * - Client cleanup on disconnect
 * - Logging utilities
 * - Connection tracking
 *
 * This base class enables reusability across multiple WebSocket namespaces
 * (e.g., /payment-status, /admin-dashboard, /notifications)
 */
export abstract class BaseWebSocketGateway {
  protected readonly logger: Logger;

  /**
   * Map of subscription keys to sets of socket client IDs
   * Example: 'payment-req-123' => Set(['socket-abc', 'socket-def'])
   */
  protected readonly subscriptions = new Map<string, Set<string>>();

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Add a client subscription to a specific key
   *
   * @param key - Subscription key (e.g., stkPushRequestId)
   * @param clientId - Socket client ID
   */
  protected addSubscription(key: string, clientId: string): void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    this.subscriptions.get(key)!.add(clientId);

    this.logger.debug(
      JSON.stringify({
        event: 'SUBSCRIPTION_ADDED',
        key,
        clientId,
        totalSubscribers: this.subscriptions.get(key)!.size,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Remove a client subscription from a specific key
   *
   * @param key - Subscription key
   * @param clientId - Socket client ID
   */
  protected removeSubscription(key: string, clientId: string): void {
    const clients = this.subscriptions.get(key);

    if (clients) {
      clients.delete(clientId);

      // Clean up empty subscription sets
      if (clients.size === 0) {
        this.subscriptions.delete(key);

        this.logger.debug(
          JSON.stringify({
            event: 'SUBSCRIPTION_KEY_REMOVED',
            key,
            reason: 'No more subscribers',
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        this.logger.debug(
          JSON.stringify({
            event: 'SUBSCRIPTION_REMOVED',
            key,
            clientId,
            remainingSubscribers: clients.size,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }
  }

  /**
   * Clean up all subscriptions for a specific client
   * Called when a client disconnects
   *
   * @param clientId - Socket client ID
   */
  protected cleanupClient(clientId: string): void {
    let cleanedCount = 0;

    for (const [key, clients] of this.subscriptions.entries()) {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        cleanedCount++;

        // Clean up empty subscription sets
        if (clients.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        JSON.stringify({
          event: 'CLIENT_CLEANUP',
          clientId,
          subscriptionsRemoved: cleanedCount,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  /**
   * Get the number of subscribers for a specific key
   *
   * @param key - Subscription key
   * @returns Number of subscribers
   */
  protected getSubscriberCount(key: string): number {
    return this.subscriptions.get(key)?.size || 0;
  }

  /**
   * Get all client IDs subscribed to a specific key
   *
   * @param key - Subscription key
   * @returns Set of client IDs
   */
  protected getSubscribers(key: string): Set<string> {
    return this.subscriptions.get(key) || new Set();
  }

  /**
   * Check if a key has any subscribers
   *
   * @param key - Subscription key
   * @returns True if key has subscribers
   */
  protected hasSubscribers(key: string): boolean {
    const subscribers = this.subscriptions.get(key);
    return subscribers !== undefined && subscribers.size > 0;
  }

  /**
   * Get total number of active subscriptions across all keys
   *
   * @returns Total number of subscription keys
   */
  protected getTotalSubscriptionKeys(): number {
    return this.subscriptions.size;
  }

  /**
   * Get total number of active client connections across all subscriptions
   * Note: Same client can be subscribed to multiple keys
   *
   * @returns Total number of subscriptions (not unique clients)
   */
  protected getTotalSubscriptions(): number {
    let total = 0;
    for (const clients of this.subscriptions.values()) {
      total += clients.size;
    }
    return total;
  }
}
