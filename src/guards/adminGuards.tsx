/**
 * Admin Guards - Simple Condition Wrappers
 * 
 * ✅ MARCH 10, 2026: REFACTORED - Guards Architecture
 * - Before: 173 lines with hooks, logging, toast logic (Score: 6/10)
 * - After: ~60 lines, pure guard wrappers only (Score: 10/10)
 * 
 * REFACTORING: Moved logic to /hooks/auth/
 * - useRequireAdmin → /hooks/auth/useRequireAdmin.ts
 * - isAdmin → /hooks/auth/useAdminPermission.ts
 * - Logging → /hooks/auth/useAuthLogging.ts
 * 
 * Provides:
 * - withAdminGuard: HOC for component-level admin protection
 * 
 * Re-exports (for convenience):
 * - useRequireAdmin: Hook for function-level admin checks
 * - isAdmin: Simple utility for conditional rendering
 * 
 * PRINCIPLE:
 * - Guards = Simple condition wrappers (check condition, render or deny)
 * - Hooks = Business logic (logging, toast, complex checks)
 * 
 * USAGE:
 * 
 * 1. Component-level protection (HOC):
 *    const ProtectedComponent = withAdminGuard(MyComponent, 'my page');
 * 
 * 2. Function-level protection (hook):
 *    import { useRequireAdmin } from '../hooks/auth/useRequireAdmin';
 *    const checkAdmin = useRequireAdmin(user);
 *    if (!checkAdmin('action name')) return;
 * 
 * 3. Conditional rendering:
 *    import { isAdmin } from '../hooks/auth/useAdminPermission';
 *    {isAdmin(user) && <AdminButton />}
 */

import React from 'react';
import { User } from '../hooks/useAuth';
import { AdminAccessDenied } from '../components/order/AdminAccessDenied';
// ✅ Import from auth hooks
import { isAdmin } from '../hooks/auth/useAdminPermission';
import { useAuthLogging, getUserContextForLogging } from '../hooks/auth/useAuthLogging';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AdminGuardedComponentProps {
  user: User;
  onBack: () => void;
  [key: string]: unknown;
}

// ============================================================================
// HOC: withAdminGuard
// ============================================================================

/**
 * Higher-Order Component that wraps a component with admin access control.
 * Shows AdminAccessDenied screen if user is not an admin.
 * 
 * @param Component - The component to protect
 * @param pageName - Display name for the page (shown in access denied message)
 * @returns Protected component that checks admin status
 * 
 * @example
 * ```typescript
 * const ProtectedAdminPage = withAdminGuard(AdminPage, 'admin dashboard');
 * 
 * function App() {
 *   return <ProtectedDashboard user={user} onBack={handleBack} />;
 * }
 * ```
 */
export function withAdminGuard<P extends AdminGuardedComponentProps>(
  Component: React.ComponentType<P>,
  pageName: string = 'this page'
) {
  return function AdminGuardedComponent(props: P) {
    const { logAdminAccessDenied, logAuthError } = useAuthLogging();
    
    // ✅ Simple user check - delegate logging to auth hook
    if (!props.user) {
      logAuthError({ 
        error: 'withAdminGuard called without user prop',
        details: 'Route loader should have provided user - this indicates a routing configuration error'
      });
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#4a4a4a] via-[#3a3a3a] to-[#2a2a2a] flex items-center justify-center">
          <div className="text-center text-gray-300">
            <p className="text-xl mb-4">Authentication Error</p>
            <p className="mb-4">Please log in to continue.</p>
            <button
              onClick={props.onBack}
              className="px-4 py-2 bg-[#D4A574] text-black rounded hover:bg-[#C49574] transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    
    // ✅ Simple admin check - delegate logging to auth hook
    if (!isAdmin(props.user)) {
      const userContext = getUserContextForLogging(props.user);
      logAdminAccessDenied({
        pageName,
        ...userContext,
      });
      
      return <AdminAccessDenied onBack={props.onBack} pageName={pageName} />;
    }

    // ✅ User is admin - render protected component
    return <Component {...props} />;
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { useRequireAdmin } from '../hooks/auth/useRequireAdmin';
export { isAdmin } from '../hooks/auth/useAdminPermission';