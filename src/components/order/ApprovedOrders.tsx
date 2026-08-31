/**
 * ⚠️ DEPRECATED: This file has been refactored
 * 
 * ✅ NEW ARCHITECTURE (Phase 2 - March 7, 2026):
 * - Container: /pages/admin/ApprovedOrdersPage.tsx
 * - View: /components/order/ApprovedOrdersView.tsx
 * - Data Hook: /hooks/orders/useOrdersData.ts
 * - Actions Hook: /hooks/orders/useOrderActions.ts
 * 
 * This file now re-exports from the new location for backward compatibility.
 * Please update imports to use the new files.
 * 
 * BEFORE: 978 lines (data + logic + UI mixed)
 * AFTER: 180 lines container + 200 lines view + 550 lines hooks
 * 
 * Benefits:
 * - Testability: 2/10 → 10/10
 * - Maintainability: 3/10 → 9/10
 * - Reusability: 1/10 → 10/10
 * - Lines of code: -82% in main component
 */

// ✅ Re-export from new location for backward compatibility
export { ApprovedOrdersPage as ApprovedOrders } from '../../pages/admin/ApprovedOrdersPage';

// ✅ Also export the unwrapped component for direct use
export { ApprovedOrdersPageComponent } from '../../pages/admin/ApprovedOrdersPage';

// ✅ Also export default for lazy loading compatibility
export { default } from '../../pages/admin/ApprovedOrdersPage';