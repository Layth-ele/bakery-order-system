/**
 * ===================================================================
 * useCachedCustomers - TanStack Query Hook
 * ===================================================================
 * 
 * ✅ P1 OPTIMIZATION: Single source of truth for customers
 * 
 * Benefits:
 * - Eliminates duplicate state across components
 * - Automatic cache invalidation and updates
 * - All components always see same data
 * - Uses canonical customer service
 * 
 * Usage:
 * ```typescript
 * const { data: customers = [], isLoading } = useCachedCustomers();
 * // No local state needed!
 * ```
 * 
 * Migration Pattern:
 * ```typescript
 * // ❌ BEFORE: Local state + manual loading
 * const [customers, setCustomers] = useState<any[]>([]);
 * useEffect(() => {
 *   const load = async () => {
 *     const custs = await getAllCustomers();
 *     setCustomers(custs);
 *   };
 *   load();
 * }, []);
 * 
 * // ✅ AFTER: TanStack Query cache
 * const { data: customers = [] } = useCachedCustomers();
 * ```
 * 
 * Created: February 14, 2026 (Phase H: P1 Optimization)
 */

import { useQuery } from '@tanstack/react-query';
import { getAllCustomers } from '../services/customersService';
import type { Customer } from '../types'; // ✅ Uses canonical customer service

/**
 * Hook to get customers from TanStack Query cache
 * 
 * Uses the canonical customersService for data fetching
 * 
 * @returns TanStack Query result with customers array
 * 
 * @example
 * ```typescript
 * const { data: customers = [], isLoading } = useCachedCustomers();
 * 
 * if (isLoading) return <LoadingSkeleton />;
 * 
 * const customer = customers.find(c => c.id === order.customerId);
 * return <CustomerInfo customer={customer} />;
 * ```
 */
export function useCachedCustomers() {
  return useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const customers = await getAllCustomers();
      return customers;
    },
    // ✅ initialData ensures data is always Customer[] (never undefined),
    // eliminating `never[] | NoInfer<Customer[]>` errors at call sites.
    // initialData (not placeholderData) is required: placeholderData:[] is inferred
    // as never[] in TS, which conflicts with TData. initialData with a cast is the
    // canonical TanStack Query v5 fix.
    initialData: [] as Customer[],
    // Cache configuration (customers change more frequently than products/categories)
    staleTime: 2 * 60 * 1000, // 2 minutes - consider data fresh for 2 min
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 min
    
    // Refetch behavior
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnMount: false, // Use cache if available
    
    // Error handling
    retry: 2, // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
