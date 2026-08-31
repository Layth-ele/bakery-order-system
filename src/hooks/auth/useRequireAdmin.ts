/**
 * useRequireAdmin - Function-Level Admin Check with Feedback
 * 
 * ✅ MARCH 10, 2026: Moved from /guards/adminGuards.tsx
 * - Hook for function-level admin permission checks
 * - Includes logging and toast feedback
 * - Used within components for action-level protection
 * 
 * PURPOSE:
 * - Protect specific actions/functions within components
 * - Provide user feedback via toast notifications
 * - Log unauthorized access attempts
 * 
 * USAGE:
 * ```typescript
 * function CustomersList({ user }: Props) {
 *   const checkAdmin = useRequireAdmin(user);
 * 
 *   const handleDeleteCustomer = async (customerId: string) => {
 *     if (!checkAdmin('delete customer')) return;
 *     
 *     // Proceed with delete action...
 *   };
 * 
 *   return <div>...</div>;
 * }
 * ```
 * 
 * @author Bakery Order Management System
 */

import { toast } from 'sonner';
import type { User } from '../useAuth';
import { isAdmin } from './useAdminPermission';
import { useAuthLogging, getUserContextForLogging } from './useAuthLogging';

/**
 * Hook that returns a function to check admin status with toast feedback
 * Used for protecting specific actions/functions within a component
 * 
 * @param user - Current user object
 * @returns Function that checks admin status and shows toast if denied
 * 
 * @example
 * ```typescript
 * function RegistrationRequests({ user }: Props) {
 *   const checkAdmin = useRequireAdmin(user);
 * 
 *   const handleApproveRequest = async (requestId: string) => {
 *     // Check admin permission before proceeding
 *     if (!checkAdmin('approve registration request')) return;
 *     
 *     // Admin-only logic continues here...
 *     await approveRequest(requestId);
 *   };
 * 
 *   const handleRejectRequest = async (requestId: string) => {
 *     if (!checkAdmin('reject registration request')) return;
 *     
 *     await rejectRequest(requestId);
 *   };
 * 
 *   return (
 *     <div>
 *       {requests.map(req => (
 *         <div key={req.id}>
 *           <button onClick={() => handleApproveRequest(req.id)}>Approve</button>
 *           <button onClick={() => handleRejectRequest(req.id)}>Reject</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRequireAdmin(user: User) {
  const { logAdminActionDenied } = useAuthLogging();
  
  /**
   * Check if user is admin. If not, log warning and show toast.
   * 
   * @param actionName - Name of the action being attempted (for logging)
   * @returns true if user is admin, false otherwise
   */
  return (actionName: string): boolean => {
    // Check admin permission
    if (!isAdmin(user)) {
      // Log the unauthorized attempt
      const userContext = getUserContextForLogging(user);
      logAdminActionDenied({
        actionName,
        ...userContext,
      });
      
      // Show user feedback
      toast.error('Permission denied: Admin access required');
      
      return false;
    }
    
    return true;
  };
}

/**
 * Alternative hook that returns an object with both check and silent check
 * 
 * @param user - Current user object
 * @returns Object with check function and silent check function
 * 
 * @example
 * ```typescript
 * const { check, checkSilent } = useRequireAdminWithOptions(user);
 * 
 * // With toast and logging
 * if (!check('delete order')) return;
 * 
 * // Silent check (no toast, still logs)
 * if (!checkSilent('view analytics')) return;
 * ```
 */
export function useRequireAdminWithOptions(user: User) {
  const { logAdminActionDenied } = useAuthLogging();
  
  /**
   * Check with full feedback (toast + logging)
   */
  const check = (actionName: string): boolean => {
    if (!isAdmin(user)) {
      const userContext = getUserContextForLogging(user);
      logAdminActionDenied({
        actionName,
        ...userContext,
      });
      
      toast.error('Permission denied: Admin access required');
      return false;
    }
    return true;
  };
  
  /**
   * Silent check (logging only, no toast)
   */
  const checkSilent = (actionName: string): boolean => {
    if (!isAdmin(user)) {
      const userContext = getUserContextForLogging(user);
      logAdminActionDenied({
        actionName,
        ...userContext,
      });
      return false;
    }
    return true;
  };
  
  return { check, checkSilent };
}
