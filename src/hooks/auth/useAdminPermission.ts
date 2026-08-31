/**
 * useAdminPermission - Simple Admin Permission Checks
 * 
 * ✅ MARCH 10, 2026: Created during guards architecture refactoring
 * - Extracted from /guards/adminGuards.tsx
 * - Pure permission checking (no side effects)
 * - No logging, no toast - just boolean checks
 * 
 * PURPOSE:
 * - Simple admin role verification
 * - Conditional rendering support
 * - Type-safe permission checks
 * 
 * USAGE:
 * ```typescript
 * // In components
 * const hasAdminPermission = useAdminPermission(user);
 * if (hasAdminPermission) {
 *   return <AdminControls />;
 * }
 * 
 * // For conditional rendering
 * {isAdmin(user) && <AdminButton />}
 * ```
 * 
 * @author Bakery Order Management System
 */

import type { User } from '../useAuth';

/**
 * Hook to check if user has admin permission
 * Pure check - no side effects, no logging
 * 
 * @param user - Current user or null
 * @returns true if user exists and has admin role
 */
export function useAdminPermission(user: User | null): boolean {
  return user?.role === 'admin';
}

/**
 * Utility function to check if user has admin role
 * Use for conditional rendering or simple checks
 * 
 * @param user - User object or null
 * @returns true if user exists and has admin role
 * 
 * @example
 * ```typescript
 * {isAdmin(user) && <AdminButton />}
 * 
 * if (isAdmin(user)) {
 *   // Show admin menu
 * }
 * ```
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

/**
 * Check if user has specific role
 * 
 * @param user - User object or null
 * @param role - Role to check for
 * @returns true if user exists and has the specified role
 * 
 * @example
 * ```typescript
 * if (hasRole(user, 'admin')) {
 *   // Admin-specific logic
 * }
 * 
 * if (hasRole(user, 'customer')) {
 *   // Customer-specific logic
 * }
 * ```
 */
export function hasRole(user: User | null, role: string): boolean {
  return user?.role === role;
}
