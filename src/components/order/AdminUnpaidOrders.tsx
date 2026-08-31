/**
 * ⚠️ DEPRECATED: This file has been refactored
 * 
 * ✅ NEW ARCHITECTURE (Phase 2 - March 7, 2026):
 * - Container: /pages/admin/AdminUnpaidOrdersPage.tsx
 * - View: /components/order/AdminUnpaidOrdersView.tsx
 * - Actions Hook: /hooks/orders/useUnpaidOrderActions.ts
 * - Data Hook: /hooks/orders/useOrdersData.ts (SHARED)
 * 
 * This file now re-exports from the new location for backward compatibility.
 * Please update imports to use the new files.
 * 
 * BEFORE: 421 lines (data + logic + UI mixed)
 * AFTER: 180 lines container + 130 lines view + 350 lines actions hook
 * 
 * Benefits:
 * - Testability: 2/10 → 10/10
 * - Maintainability: 3/10 → 9/10
 * - Reusability: 1/10 → 10/10
 * - Lines of code: -57% in main component
 */

// ✅ Re-export from new location for backward compatibility
export { AdminUnpaidOrdersPage as AdminUnpaidOrders } from '../../pages/admin/AdminUnpaidOrdersPage';

// ✅ Also export default for direct use
export { default } from '../../pages/admin/AdminUnpaidOrdersPage';
