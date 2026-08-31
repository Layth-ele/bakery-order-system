/**
 * ===================================================================
 * useCachedCategories - TanStack Query Hook
 * ===================================================================
 * 
 * ✅ P1 OPTIMIZATION: Single source of truth for categories
 * 
 * Benefits:
 * - Eliminates duplicate state across components
 * - Automatic cache invalidation and updates
 * - All components always see same data
 * - Categories automatically sorted by display order
 * 
 * Usage:
 * ```typescript
 * const { data: categories = [], isLoading } = useCachedCategories();
 * // Categories are pre-sorted by order field
 * ```
 * 
 * Migration Pattern:
 * ```typescript
 * // ❌ BEFORE: Local state + manual loading
 * const [categories, setCategories] = useState<Category[]>([]);
 * useEffect(() => {
 *   const load = async () => {
 *     const cats = await getAllCategories();
 *     setCategories(cats.sort((a, b) => a.order - b.order));
 *   };
 *   load();
 * }, []);
 * 
 * // ✅ AFTER: TanStack Query cache
 * const { data: categories = [] } = useCachedCategories();
 * ```
 * 
 * Created: February 14, 2026 (Phase H: P1 Optimization)
 * ✅ FIXED: Now calls Firebase layer directly (March 13, 2026)
 */

import { useQuery } from '@tanstack/react-query';
import { getAllCategories } from '../services/data/categoriesDataService';
import { Category } from '../types';

/**
 * Hook to get categories from TanStack Query cache
 * 
 * Categories are automatically sorted by their display order
 * 
 * @returns TanStack Query result with sorted categories array
 * 
 * @example
 * ```typescript
 * const { data: categories = [], isLoading } = useCachedCategories();
 * 
 * if (isLoading) return <LoadingSkeleton />;
 * 
 * return categories.map(category => (
 *   <CategorySection key={category.id} category={category} />
 * ));
 * ```
 */
export function useCachedCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const categories = await getAllCategories();
      // Deduplicate by id — prevents duplicate pills in UI when Firestore has duplicates
      const seen = new Set<string>();
      return categories.filter(cat => {
        if (seen.has(cat.id)) return false;
        seen.add(cat.id);
        return true;
      });
    },
    // ✅ initialData ensures data is always Category[] (never undefined),
    // eliminating `never[] | NoInfer<Category[]>` errors at call sites.
    // initialData (not placeholderData) is required: placeholderData:[] is inferred
    // as never[] in TS, which conflicts with TData. initialData with a cast is the
    // canonical TanStack Query v5 fix.
    initialData: [] as Category[],
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes - categories rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    
    // Refetch behavior
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnMount: false, // Use cache if available
    
    // Error handling
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}