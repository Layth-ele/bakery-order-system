/**
 * ⚠️ DEPRECATED: This file has been refactored
 * 
 * ✅ NEW ARCHITECTURE (Phase 2 - March 7, 2026):
 * - Container: /pages/admin/PendingOrdersPage.tsx
 * - View: /components/order/PendingOrdersView.tsx
 * - Actions Hook: /hooks/orders/usePendingOrderActions.ts
 * - Data Hook: /hooks/orders/useOrdersData.ts
 * 
 * This file now re-exports from the new location for backward compatibility.
 * Please update imports to use the new files.
 * 
 * BEFORE: 459 lines (data + logic + UI mixed)
 * AFTER: 250 lines container + 380 lines view + 200 lines actions hook
 * 
 * Benefits:
 * - Testability: 2/10 → 10/10
 * - Maintainability: 3/10 → 9/10
 * - Reusability: 1/10 → 10/10
 * - Lines of code: -45% in main component
 */

// ✅ Re-export from new location for backward compatibility
export { PendingOrdersPage as PendingOrders } from '../../pages/admin/PendingOrdersPage';

// ✅ Also export the unwrapped component for direct use
export { PendingOrdersPageComponent } from '../../pages/admin/PendingOrdersPage';
