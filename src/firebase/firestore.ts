/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - DOMAIN-SPLIT ARCHITECTURE (MAIN ENTRY POINT)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ MAR 13, 2026: Split from monolithic 968-line file into domain files
 * 
 * This file now simply re-exports from domain-specific files in ./firestore/*
 * 
 * ARCHITECTURE:
 * - firebase/firestore/shared.ts: Common utilities
 * - firebase/firestore/customers.ts: Customer operations (~220 lines)
 * - firebase/firestore/products.ts: Product operations (~180 lines)
 * - firebase/firestore/orders.ts: Order operations (~280 lines)
 * - firebase/firestore/settings.ts: Settings operations (~150 lines)
 * - firebase/firestore/notifications.ts: Notification operations (~170 lines)
 * - firebase/firestore/creditNotes.ts: Credit Note operations (~250 lines)
 * 
 * WHY THIS SPLIT:
 * ✅ Easier code reviews (one domain at a time)
 * ✅ Easier bug isolation (bugs are domain-specific)
 * ✅ Reduced merge conflicts (team works on different files)
 * ✅ Prevents accidental refactors affecting whole app
 * ✅ Each file is manageable size (~150-280 lines vs 968 lines)
 * 
 * BACKWARD COMPATIBILITY:
 * ✅ All imports from './firebase/firestore' still work
 * ✅ All imports from './firebase' still work
 * ✅ No breaking changes for existing code
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Re-export everything from the domain-split architecture
export * from './firestore/index';
