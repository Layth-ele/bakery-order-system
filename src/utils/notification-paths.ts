/**
 * Canonical Notification Paths Utility
 * 
 * ✅ SINGLE SOURCE OF TRUTH for all Firestore notification paths
 * 
 * This prevents path mismatches that cause notifications to:
 * - Go missing
 * - Not sync between admin/customer
 * - Appear in wrong order
 * 
 * VERSION: 1.0 - Initial implementation
 * 
 * USAGE:
 * 
 * ```typescript
 * // ✅ CORRECT - Use these functions
 * import { getCustomerNotificationPath, getAdminNotificationPath } from '@/utils/notification-paths';
 * 
 * const path = getCustomerNotificationPath('customer123');
 * // Returns: ['notifications', 'user_customer123', 'items']
 * 
 * // ❌ WRONG - Don't hardcode paths!
 * const wrongPath = ['notifications', 'users', customerId, 'items']; // 4 segments - INVALID!
 * const alsoWrong = `notifications/${customerId}/items`; // Missing user_ prefix!
 * ```
 */

import { logger } from './logger';
/**
 * Get customer notification collection path
 * 
 * Returns 3-segment path array for Firestore collection()
 * Path structure: notifications/user_{customerId}/items
 * 
 * @param customerId - The customer ID (without user_ prefix)
 * @returns 3-segment path array ['notifications', 'user_{customerId}', 'items']
 * 
 * @example
 * ```typescript
 * const path = getCustomerNotificationPath('abc123');
 * collection(db, ...path); // collection(db, 'notifications', 'user_abc123', 'items')
 * ```
 */
export function getCustomerNotificationPath(customerId: string): [string, string, string] {
  // ✅ CRITICAL: Always use 3-segment path with user_ prefix
  // This matches the CustomerNotificationProvider listener path
  return ['notifications', `user_${customerId}`, 'items'];
}

/**
 * Get admin notification collection path
 * 
 * Returns 3-segment path array for Firestore collection()
 * Path structure: notifications/admin/items
 * 
 * @returns 3-segment path array ['notifications', 'admin', 'items']
 * 
 * @example
 * ```typescript
 * const path = getAdminNotificationPath();
 * collection(db, ...path); // collection(db, 'notifications', 'admin', 'items')
 * ```
 */
export function getAdminNotificationPath(): [string, string, string] {
  // ✅ CRITICAL: Always use 3-segment path
  // This matches the AdminNotificationProvider listener path
  return ['notifications', 'admin', 'items'];
}

/**
 * Get notification path based on target type
 * 
 * Universal helper that routes to customer or admin path based on target
 * 
 * @param target - 'admin' or 'customer'
 * @param targetId - Customer ID (required if target is 'customer', ignored if 'admin')
 * @returns 3-segment path array
 * 
 * @example
 * ```typescript
 * const adminPath = getNotificationPath('admin');
 * // Returns: ['notifications', 'admin', 'items']
 * 
 * const customerPath = getNotificationPath('customer', 'abc123');
 * // Returns: ['notifications', 'user_abc123', 'items']
 * ```
 */
export function getNotificationPath(
  target: 'admin' | 'customer',
  targetId?: string
): [string, string, string] {
  if (target === 'admin') {
    return getAdminNotificationPath();
  } else {
    if (!targetId) {
      throw new Error('❌ Customer notification path requires targetId');
    }
    return getCustomerNotificationPath(targetId);
  }
}

/**
 * Get customer notification path as string
 * 
 * 
 * @param customerId - The customer ID (without user_ prefix)
 * @returns Path string 'notifications/user_{customerId}/items'
 * 
 * @example
 * ```typescript
 * const pathString = getCustomerNotificationPathString('abc123');
 * // Returns: 'notifications/user_abc123/items'
 * logger.log('Listening on:', pathString);
 * ```
 */
export function getCustomerNotificationPathString(customerId: string): string {
  return getCustomerNotificationPath(customerId).join('/');
}

/**
 * Get admin notification path as string
 * 
 * 
 * @returns Path string 'notifications/admin/items'
 * 
 * @example
 * ```typescript
 * const pathString = getAdminNotificationPathString();
 * // Returns: 'notifications/admin/items'
 * logger.log('Listening on:', pathString);
 * ```
 */
export function getAdminNotificationPathString(): string {
  return getAdminNotificationPath().join('/');
}

/**
 * Validate notification path
 * 
 * Checks if a path array matches the canonical format
 * Returns true if valid, false if invalid
 * 
 * @param path - Path array to validate
 * @returns true if path is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const validPath = ['notifications', 'user_abc123', 'items'];
 * isValidNotificationPath(validPath); // true
 * 
 * const invalidPath = ['notifications', 'users', 'abc123', 'items'];
 * isValidNotificationPath(invalidPath); // false (4 segments!)
 * ```
 */
export function isValidNotificationPath(path: string[]): boolean {
  // Must be exactly 3 segments
  if (path.length !== 3) return false;
  
  // First segment must be 'notifications'
  if (path[0] !== 'notifications') return false;
  
  // Second segment must be 'admin' OR start with 'user_'
  const secondSegment = path[1];
  if (secondSegment !== 'admin' && !secondSegment.startsWith('user_')) {
    return false;
  }
  
  // Third segment must be 'items'
  if (path[2] !== 'items') return false;
  
  return true;
}

/**
 * Extract customer ID from notification path
 * 
 * Parses a customer notification path and returns the customer ID
 * Returns null if path is not a valid customer path
 * 
 * @param path - Path array or string
 * @returns Customer ID (without user_ prefix) or null
 * 
 * @example
 * ```typescript
 * const customerId = extractCustomerIdFromPath(['notifications', 'user_abc123', 'items']);
 * // Returns: 'abc123'
 * 
 * const alsoCustomerId = extractCustomerIdFromPath('notifications/user_abc123/items');
 * // Returns: 'abc123'
 * 
 * const adminPath = extractCustomerIdFromPath(['notifications', 'admin', 'items']);
 * // Returns: null (admin path, not customer)
 * ```
 */
export function extractCustomerIdFromPath(path: string[] | string): string | null {
  const pathArray = typeof path === 'string' ? path.split('/') : path;
  
  if (!isValidNotificationPath(pathArray)) return null;
  
  const secondSegment = pathArray[1];
  
  // Admin path - no customer ID
  if (secondSegment === 'admin') return null;
  
  // Customer path - extract ID after user_ prefix
  if (secondSegment.startsWith('user_')) {
    return secondSegment.substring(5); // Remove 'user_' prefix
  }
  
  return null;
}

/**
 * Check if path is admin notification path
 * 
 * @param path - Path array or string
 * @returns true if admin path, false otherwise
 * 
 * @example
 * ```typescript
 * isAdminNotificationPath(['notifications', 'admin', 'items']); // true
 * isAdminNotificationPath('notifications/admin/items'); // true
 * isAdminNotificationPath(['notifications', 'user_abc123', 'items']); // false
 * ```
 */
export function isAdminNotificationPath(path: string[] | string): boolean {
  const pathArray = typeof path === 'string' ? path.split('/') : path;
  return isValidNotificationPath(pathArray) && pathArray[1] === 'admin';
}

/**
 * Check if path is customer notification path
 * 
 * @param path - Path array or string
 * @returns true if customer path, false otherwise
 * 
 * @example
 * ```typescript
 * isCustomerNotificationPath(['notifications', 'user_abc123', 'items']); // true
 * isCustomerNotificationPath('notifications/user_abc123/items'); // true
 * isCustomerNotificationPath(['notifications', 'admin', 'items']); // false
 * ```
 */
export function isCustomerNotificationPath(path: string[] | string): boolean {
  const pathArray = typeof path === 'string' ? path.split('/') : path;
  return isValidNotificationPath(pathArray) && pathArray[1].startsWith('user_');
}

// ============================================================================
// LEGACY PATH MIGRATION
// ============================================================================

/**
 * Convert legacy 4-segment path to canonical 3-segment path
 * 
 * Handles old incorrect paths:
 * - ['notifications', 'users', 'abc123', 'items'] → ['notifications', 'user_abc123', 'items']
 * 
 * @param legacyPath - Old 4-segment path array
 * @returns Canonical 3-segment path array or null if cannot convert
 * 
 * @example
 * ```typescript
 * const oldPath = ['notifications', 'users', 'abc123', 'items'];
 * const newPath = migrateLegacyPath(oldPath);
 * // Returns: ['notifications', 'user_abc123', 'items']
 * ```
 */
export function migrateLegacyPath(legacyPath: string[]): [string, string, string] | null {
  // Already canonical 3-segment path
  if (legacyPath.length === 3 && isValidNotificationPath(legacyPath)) {
    return legacyPath as [string, string, string];
  }
  
  // Old 4-segment customer path: ['notifications', 'users', '{customerId}', 'items']
  if (
    legacyPath.length === 4 &&
    legacyPath[0] === 'notifications' &&
    legacyPath[1] === 'users' &&
    legacyPath[3] === 'items'
  ) {
    const customerId = legacyPath[2];
    return getCustomerNotificationPath(customerId);
  }
  
  logger.warn('⚠️ Cannot migrate unknown path format:', legacyPath);
  return null;
}

// ============================================================================
// DOCUMENTATION & EXAMPLES
// ============================================================================

/**
 * CANONICAL PATH FORMATS
 * 
 * ✅ CORRECT FORMATS:
 * 
 * Admin:
 *   - Array:  ['notifications', 'admin', 'items']
 *   - String: 'notifications/admin/items'
 *   - Firestore: collection(db, 'notifications', 'admin', 'items')
 * 
 * Customer:
 *   - Array:  ['notifications', 'user_{customerId}', 'items']
 *   - String: 'notifications/user_{customerId}/items'
 *   - Firestore: collection(db, 'notifications', 'user_abc123', 'items')
 * 
 * ❌ INVALID FORMATS (DO NOT USE):
 * 
 * - ['notifications', 'admin'] // Missing /items
 * - ['notifications', 'users', customerId, 'items'] // 4 segments!
 * - ['notifications', customerId, 'items'] // Missing user_ prefix
 * - ['notifications', 'admin', 'notifications'] // Wrong collection name
 */

/**
 * MIGRATION GUIDE
 * 
 * Step 1: Replace hardcoded paths
 * 
 * Before:
 * ```typescript
 * const path = ['notifications', 'users', customerId, 'items']; // ❌ WRONG
 * ```
 * 
 * After:
 * ```typescript
 * import { getCustomerNotificationPath } from '@/utils/notification-paths';
 * const path = getCustomerNotificationPath(customerId); // ✅ CORRECT
 * ```
 * 
 * Step 2: Update Firestore queries
 * 
 * Before:
 * ```typescript
 * const ref = collection(db, 'notifications', 'users', customerId, 'items'); // ❌ 4 segments!
 * ```
 * 
 * After:
 * ```typescript
 * import { getCustomerNotificationPath } from '@/utils/notification-paths';
 * const path = getCustomerNotificationPath(customerId);
 * const ref = collection(db, ...path); // ✅ Spreads to 3 segments
 * ```
 * 
 * 
 * Before:
 * ```typescript
 * const key = `notifications/users/${customerId}/items`; // ❌ Old format
 * ```
 * 
 * After:
 * ```typescript
 * import { getCustomerNotificationPathString } from '@/utils/notification-paths';
 * const key = getCustomerNotificationPathString(customerId); // ✅ 'notifications/user_{customerId}/items'
 * ```
 */
