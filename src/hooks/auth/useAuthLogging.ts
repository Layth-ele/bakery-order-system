/**
 * useAuthLogging - Centralized Authentication Event Logging
 * 
 * ✅ MARCH 10, 2026: Created during guards architecture refactoring
 * - Extracted from /guards/adminGuards.tsx
 * - Centralized logging for all auth events
 * - Consistent format and context
 * 
 * PURPOSE:
 * - Log admin access denials
 * - Log admin action denials
 * - Log authentication errors
 * - Provide audit trail for security events
 * 
 * USAGE:
 * ```typescript
 * const { logAdminAccessDenied, logAdminActionDenied } = useAuthLogging();
 * 
 * // In guards
 * if (!isAdmin(user)) {
 *   logAdminAccessDenied({ pageName: 'dashboard', user });
 *   return <AccessDenied />;
 * }
 * 
 * // In hooks/handlers
 * if (!isAdmin(user)) {
 *   logAdminActionDenied({ actionName: 'delete customer', user });
 *   return false;
 * }
 * ```
 * 
 * @author Bakery Order Management System
 */

import { getServerTimestamp } from '../../utils/timestamps';
import type { User } from '../useAuth';
import { logger } from '../../utils/logger';


/**
 * Context for admin access denied logs
 */
export interface AdminAccessDeniedContext {
  pageName: string;
  userId: string;
  userEmail: string;
  userRole: string;
}

/**
 * Context for admin action denied logs
 */
export interface AdminActionDeniedContext {
  actionName: string;
  userId: string;
  userEmail: string;
  userRole: string;
}

/**
 * Context for authentication errors
 */
export interface AuthErrorContext {
  error: string;
  userId?: string;
  details?: string;
}

/**
 * Hook for centralized authentication event logging
 * Provides consistent logging functions for all auth events
 * 
 * @returns Object with logging functions
 */
export function useAuthLogging() {
  /**
   * Log when a non-admin user attempts to access an admin page
   * 
   * @param context - Context information about the access attempt
   */
  const logAdminAccessDenied = (context: AdminAccessDeniedContext): void => {
    logger.warn(`⚠️ Non-admin user attempted to access ${context.pageName}:`, {
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      timestamp: getServerTimestamp() as any,
      event: 'admin_access_denied',
    });
  };

  /**
   * Log when a non-admin user attempts to perform an admin action
   * 
   * @param context - Context information about the action attempt
   */
  const logAdminActionDenied = (context: AdminActionDeniedContext): void => {
    console.error('❌ Non-admin attempted admin action:', {
      action: context.actionName,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      timestamp: getServerTimestamp() as any,
      event: 'admin_action_denied',
    });
  };

  /**
   * Log authentication errors
   * 
   * @param context - Context information about the error
   */
  const logAuthError = (context: AuthErrorContext): void => {
    console.error('❌ CRITICAL: Authentication error:', {
      error: context.error,
      userId: context.userId,
      details: context.details,
      timestamp: getServerTimestamp() as any,
      event: 'auth_error',
    });
  };

  /**
   * Log successful authentication events (optional)
   * 
   * @param userId - User ID
   * @param eventType - Type of auth event
   */
  const logAuthSuccess = (userId: string, eventType: string): void => {
  };

  return {
    logAdminAccessDenied,
    logAdminActionDenied,
    logAuthError,
    logAuthSuccess,
  };
}

/**
 * Helper function to extract user context for logging
 * 
 * @param user - User object
 * @returns User context object safe for logging
 */
export function getUserContextForLogging(user: User | null): {
  userId: string;
  userEmail: string;
  userRole: string;
} {
  return {
    userId: user?.id || 'unknown',
    userEmail: user?.email || 'unknown',
    userRole: user?.role || 'unknown',
  };
}
