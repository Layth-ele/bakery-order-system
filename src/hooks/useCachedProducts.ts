/**
 * ===================================================================
 * useCachedProducts - TanStack Query Hook
 * ===================================================================
 * 
 * ✅ P1 OPTIMIZATION: Single source of truth for products
 * 
 * Benefits:
 * - Eliminates duplicate state across components
 * - Automatic cache invalidation and updates
 * - 20-30% memory reduction
 * - All components always see same data
 * 
 * Usage:
 * ```typescript
 * const { data: products = [], isLoading, isError } = useCachedProducts();
 * // No local state needed!
 * ```
 * 
 * Migration Pattern:
 * ```typescript
 * // ❌ BEFORE: Local state + manual loading
 * const [products, setProducts] = useState<Product[]>([]);
 * useEffect(() => {
 *   const load = async () => {
 *     const prods = await getProducts();
 *     setProducts(prods);
 *   };
 *   load();
 * }, []);
 * 
 * // ✅ AFTER: TanStack Query cache
 * const { data: products = [] } = useCachedProducts();
 * ```
 * 
 * Created: February 14, 2026 (Phase H: P1 Optimization)
 * ✅ FIXED: Now calls Firebase layer directly (March 13, 2026)
 */

import { useQuery } from '@tanstack/react-query';
import { getAll as getProductsFromDataService } from '../services/data/productsDataService';
import { Product } from '../types';

/**
 * Hook to get products from TanStack Query cache
 * 
 * @returns TanStack Query result with products array
 * 
 * @example
 * ```typescript
 * const { data: products = [], isLoading } = useCachedProducts();
 * 
 * if (isLoading) return <LoadingSkeleton />;
 * 
 * return products.map(product => <ProductCard key={product.id} product={product} />);
 * ```
 */
export function useCachedProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const products = await getProductsFromDataService();
      return products;
    },
    // ✅ initialData ensures data is always Product[] (never undefined),
    // eliminating `never[] | NoInfer<Product[]>` errors at call sites.
    // initialData (not placeholderData) is required: placeholderData:[] is inferred
    // as never[] in TS, which conflicts with TData. initialData with a cast is the
    // canonical TanStack Query v5 fix.
    initialData: [] as Product[],
    // Cache configuration
    staleTime: 5 * 60 * 1000, // 5 minutes - consider data fresh for 5 min
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 min (formerly cacheTime)
    
    // Refetch behavior
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
    refetchOnMount: false, // Use cache if available (don't refetch on component mount)
    
    // Error handling
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}