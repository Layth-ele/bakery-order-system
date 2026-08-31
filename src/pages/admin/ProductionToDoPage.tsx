/**
 * 📄 ProductionToDoPage - Container Component
 * 
 * PURPOSE:
 * - Container/orchestrator for production to-do sheet
 * - Minimal wrapper around ProductionToDoSheet component
 * - Handles admin guard and page props
 * 
 * ARCHITECTURE:
 * - Presentation: ProductionToDoSheet component
 * - This file: Thin wrapper for routing integration
 */

import { useRenderTracking } from '../../hooks/useRenderTracking';
import { useScrollToTop } from '../../hooks/useScrollToTop';
import { withAdminGuard } from '../../guards/adminGuards';
import { ProductionToDoSheet } from '../../components/admin/ProductionToDoSheet';
import type { User } from '../../services/firebase/authService';
import type { AdminPage } from '../../config/adminNavigation';

interface ProductionToDoPageProps {
  isActive?: boolean;
  user: User;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage) => void;
}

/**
 * Container component for production to-do page
 * 
 * Responsibilities:
 * - Minimal orchestration for route-based navigation
 * - Pass through props to ProductionToDoSheet
 */
function ProductionToDoPageComponent({
  isActive,
  setCurrentPage,
}: ProductionToDoPageProps) {
  // ============================================================================
  // HOOKS - Performance & Navigation
  // ============================================================================
  
  // ✅ Track render performance
  useRenderTracking('ProductionToDoPage', isActive, 60);
  
  // ✅ Auto scroll to top when page loads
  useScrollToTop('smooth');
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <ProductionToDoSheet
      isActive={(isActive ?? false)}
      setCurrentPage={setCurrentPage}
    />
  );
}

// ✅ Export with admin guard
export const ProductionToDoPage = withAdminGuard(ProductionToDoPageComponent as any);

// ✅ Also export component directly for testing
export { ProductionToDoPageComponent };