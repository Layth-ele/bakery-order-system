/**
 * ===================================================================
 * useCacheInvalidation - Helper for TanStack Query Cache Invalidation
 * ===================================================================
 * 
 * ✅ P1 OPTIMIZATION: Centralized cache invalidation
 * 
 * Benefits:
 * - Invalidate once, all components auto-update
 * - Consistent invalidation patterns
 * - Easy to use in any component
 * - Supports batch invalidation
 * 
 * Usage:
 * ```typescript
 * const { invalidateProducts, invalidateCategories } = useCacheInvalidation();
 * 
 * // After saving a product
 * await saveProduct(product);
 * await invalidateProducts(); // ✅ All components see new data!
 * 
 * // After bulk updates
 * await bulkUpdate();
 * await invalidateAll(); // ✅ Refresh everything!
 * ```
 * 
 * Migration Pattern:
 * ```typescript
 * // ❌ BEFORE: Manual state updates in each component
 * const handleSave = async (product: Product) => {
 *   await saveProduct(product);
 *   const updated = await getProducts();
 *   setProducts(updated); // Only this component updates!
 * };
 * 
 * // ✅ AFTER: Cache invalidation (all components update)
 * const { invalidateProducts } = useCacheInvalidation();
 * const handleSave = async (product: Product) => {
 *   await saveProduct(product);
 *   await invalidateProducts(); // All components auto-update!
 * };
 * ```
 * 
 * Created: February 14, 2026 (Phase H: P1 Optimization)
 */

import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook that provides cache invalidation helpers
 * 
 * Use these functions after mutations to refresh cached data
 * across all components automatically
 * 
 * @returns Object with invalidation functions
 * 
 * @example
 * ```typescript
 * const { 
 *   invalidateProducts, 
 *   invalidateCategories,
 *   invalidateCustomers,
 *   invalidateAll 
 * } = useCacheInvalidation();
 * 
 * // After saving a product
 * await productsService.save(product);
 * await invalidateProducts(); // Refreshes products everywhere
 * 
 * // After updating settings that affect multiple caches
 * await settingsService.update(settings);
 * await invalidateAll(); // Refreshes everything
 * ```
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalidate products cache
     * 
     * Call after: creating, updating, or deleting products
     * Effect: All components using useCachedProducts will re-fetch
     */
    invalidateProducts: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },

    /**
     * Invalidate categories cache
     * 
     * Call after: creating, updating, or deleting categories
     * Effect: All components using useCachedCategories will re-fetch
     */
    invalidateCategories: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },

    /**
     * Invalidate customers cache
     * 
     * Call after: creating, updating, or deleting customers
     * Effect: All components using useCachedCustomers will re-fetch
     */
    invalidateCustomers: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },

    /**
     * Invalidate orders cache
     * 
     * Call after: creating, updating, or deleting orders
     * Effect: All components using useCachedOrders will re-fetch
     * 
     * Note: Orders already use TanStack Query via useCachedOrders from useCachedFirebase.ts
     */
    invalidateOrders: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    /**
     * Invalidate credit balance cache
     * 
     * ✅ FEB 17, 2026: Added for TanStack Query credit migration
     * Call after: applying credit, creating credit notes, admin editing paid orders
     * Effect: All components using useCachedCreditBalance will re-fetch
     */
    invalidateCredit: async (customerId?: string) => {
      if (customerId) {
        await queryClient.invalidateQueries({ queryKey: ['credit', 'balance', customerId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['credit'] });
      }
    },

    /**
     * Invalidate all caches at once
     * 
     * Call after: bulk operations, major data changes, or when you want to refresh everything
     * Effect: All components using any cache will re-fetch
     * 
     * Use sparingly - this refetches all data!
     */
    invalidateAll: async () => {
      await queryClient.invalidateQueries();
    },

    /**
     * Clear all caches immediately
     * 
     * Call after: logout, data reset, or critical errors
     * Effect: All cached data is removed immediately
     * 
     * Warning: Components will show loading state until data refetches
     */
    clearAllCaches: () => {
      queryClient.clear();
    },
  };
}