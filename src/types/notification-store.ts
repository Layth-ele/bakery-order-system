/**
 * 🎯 NOTIFICATION STORE TYPES
 * 
 * Pure TypeScript contracts for notification storage.
 * NO implementation details - just the contracts!
 * 
 * Pattern: Repository Pattern
 * 
 * Benefits:
 * - Contexts are Firebase-agnostic (only use this interface)
 * - Easy to create mock implementations for testing
 * - Easy to swap storage (Firebase → Supabase → PostgreSQL)
 * - Clear API surface area
 * 
 * Version: 4.0 - Moved from /interfaces to /types
 * Created: January 15, 2026
 * Updated: March 10, 2026 - Consolidated into /types directory
 */

import type { NotificationItem, NotifTarget } from './notification-canonical';

// ============================================================================
// NOTIFICATION STORE INTERFACE (The Contract)
// ============================================================================

/**
 * NotificationStore interface
 * 
 * This is the ONLY interface your app code should depend on.
 * Never import Firebase directly in contexts/components!
 * 
 * Implementation examples:
 * - FirebaseNotificationStore (production)
 * - InMemoryNotificationStore (testing)
 * - MockNotificationStore (unit tests)
 * - SupabaseNotificationStore (if migrating)
 */
export interface NotificationStore {
  /**
   * Writes a notification to storage
   * 
   * @param notification - Notification to write
   * @returns Promise that resolves when write completes
   * 
   * @example
   * await store.write(notification);
   */
  write(notification: NotificationItem): Promise<void>;
  
  /**
   * Marks a single notification as read
   * 
   * @param target - Notification target ("admin" | "user")
   * @param targetId - Target ID
   * @param id - Notification ID
   * @returns Promise that resolves when update completes
   * 
   * @example
   * await store.markRead("user", "CUST_123", "notif_abc");
   */
  markRead(target: NotifTarget, targetId: string, id: string): Promise<void>;
  
  /**
   * Marks all notifications as read for a target
   * 
   * @param target - Notification target
   * @param targetId - Target ID
   * @returns Promise that resolves when all updates complete
   * 
   * @example
   * await store.markAllRead("admin", "admin");
   */
  markAllRead(target: NotifTarget, targetId: string): Promise<void>;
  
  /**
   * Deletes a single notification
   * 
   * @param target - Notification target
   * @param targetId - Target ID
   * @param id - Notification ID
   * @returns Promise that resolves when delete completes
   * 
   * @example
   * await store.delete("user", "CUST_123", "notif_abc");
   */
  delete(target: NotifTarget, targetId: string, id: string): Promise<void>;
  
  /**
   * Clears all notifications for a target
   * 
   * @param target - Notification target
   * @param targetId - Target ID
   * @returns Promise that resolves when all deletes complete
   * 
   * @example
   * await store.clear("admin", "admin");
   */
  clear(target: NotifTarget, targetId: string): Promise<void>;
  
  /**
   * Subscribes to real-time notification updates
   * 
   * @param target - Notification target
   * @param targetId - Target ID
   * @param onChange - Callback called when notifications change
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = store.subscribe("user", "CUST_123", (notifications) => {
   *   console.log("New notifications:", notifications);
   * });
   * // Later: unsubscribe();
   */
  subscribe(
    target: NotifTarget,
    targetId: string,
    onChange: (items: NotificationItem[]) => void
  ): () => void;
}

// ============================================================================
// STORE CONFIGURATION
// ============================================================================

/**
 * Configuration options for notification store
 */
export interface NotificationStoreConfig {
  /**
   * Enable debug logging
   */
  debug?: boolean;
  
  /**
   * Retry failed operations
   */
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    delayMs: number;
  };
  
  /**
   * Cache settings
   */
  cache?: {
    enabled: boolean;
    ttlMs: number;
  };
}

// ============================================================================
// STORE FACTORY
// ============================================================================

/**
 * Store factory function type
 * Allows creating different store implementations
 * 
 * @example
 * const createStore: StoreFactory = (config) => {
 *   return new FirebaseNotificationStore(db, config);
 * };
 */
export type StoreFactory = (config?: NotificationStoreConfig) => NotificationStore;
