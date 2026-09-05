import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from '../firebase/auth';
import { safeSubscribe, isExpectedFirestoreListenerError } from '../utils/subscriptionSafety';
import { 
  Customer, 
  Product, 
  Order,
  Settings,
  NotificationData,
  subscribeToCustomer,
  subscribeToCustomers,
  subscribeToProducts,
  subscribeToOrders,
  subscribeToCustomerOrders,
  subscribeToSettings,
  subscribeToNotifications,
} from '../firebase/firestore';
import {
  getCustomers as getAllCustomers,
  getOrders,
  getActiveOrders,
} from '../services/dataService';
import { getAll as getProductsFromDataService } from '../services/data/productsDataService'; // Direct data service import
// PASS 10: removed unused `getAvailableCredit` import — useCachedCreditBalance
// uses a dynamic import('../firebase/firestore') for getCreditNotes instead.

// ============================================
// REQUEST DEDUPLICATION
// ============================================

/**
 * Prevents cache stampede by deduplicating concurrent requests
 * 
 * Example:
 * - 100 components mount simultaneously
 * - All request same data
 * - Without dedup: 100 Firebase reads
 * - With dedup: 1 Firebase read (other 99 wait for result)
 */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate requests - ensures only one request in flight per key
 */
function deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  // Check if request already in flight
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)! as Promise<T>;
  }
  
  // Start new request
  const promise = fetcher()
    .then((result) => {
      pendingRequests.delete(key);
      return result;
    })
    .catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });
  
  pendingRequests.set(key, promise);
  return promise;
}

// ============================================
// CACHE CONFIGURATION
// ============================================

export const CACHE_TIMES = {
  // How long data is considered "fresh" (no refetch)
  STALE_TIME: {
    orders: 30 * 1000,            // 30 seconds — ensures fresh data on login
    customers: 60 * 1000,         // 1 minute
    products: 5 * 60 * 1000,     // 5 minutes
    settings: 0,                  // 0ms — live listener handles freshness ✅ FIXED
    notifications: 5 * 60 * 1000, // 5 minutes ✅ OPTIMIZED
  },
  
  // How long data stays in MEMORY (before garbage collection)
  // ⚠️ REDUCED to prevent memory bloat! Was 7 days → now 1 hour
  CACHE_TIME: {
    orders: 60 * 60 * 1000,      // 1 hour (was 7 days) ✅ MEMORY FIX
    customers: 60 * 60 * 1000,   // 1 hour (was 7 days) ✅ MEMORY FIX
    products: 2 * 60 * 60 * 1000, // 2 hours (was 7 days) ✅ MEMORY FIX
    settings: 2 * 60 * 60 * 1000, // 2 hours (was 7 days) ✅ MEMORY FIX
    notifications: 30 * 60 * 1000, // 30 minutes (was 24h) ✅ MEMORY FIX
  }
};

// ============================================
// QUERY CLIENT SETUP
// ============================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately, fetch fresh in background
      staleTime: CACHE_TIMES.STALE_TIME.orders,
      gcTime: CACHE_TIMES.CACHE_TIME.orders,
      refetchOnWindowFocus: true,   // ✅ See admin-side changes on tab focus
      refetchOnReconnect: true,     // ✅ Refetch after network reconnect
      refetchOnMount: true,         // ✅ Always fetch fresh on login/mount
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Firebase is the cache source of truth - no client-side cache persistence needed
// ============================================
// CACHE KEYS
// ============================================

export const QUERY_KEYS = {
  customers: ['customers'] as const,
  customer: (id: string) => ['customer', id] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  customerOrders: (customerId: string) => ['orders', 'customer', customerId] as const,
  products: ['products'] as const,
  settings: ['settings'] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  creditBalance: (customerId: string) => ['credit', 'balance', customerId] as const, // Credit balance
};

// ============================================
// CACHED HOOKS (Replace existing hooks)
// ============================================

/**
 * Cached hook for all customers
 * Only fetches if cache is stale (>5 minutes)
 * 
 * ✅ MAR 11, 2026: Request deduplication prevents cache stampede
 */
export const useCachedCustomers = (isActive: boolean = true) => {
  const { data, isLoading, error, refetch } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      return deduplicate('customers', async () => {
        const customers = await getAllCustomers();
        return customers;
      });
    },
    // ✅ initialData ensures data is always Customer[] (never undefined)
    initialData: [] as Customer[],
    enabled: isActive,
    staleTime: CACHE_TIMES.STALE_TIME.customers,
    gcTime: CACHE_TIMES.CACHE_TIME.customers,
  });

  return { data, isLoading, error, refetch };
};

/**
 * Cached hook for single customer
 *
 * ✅ PASS 9 FIX: Promise rejects on Firestore error so TanStack Query retries
 *    instead of hanging in `loading` state.
 */
export const useCachedCustomer = (customerId: string | null) => {
  return useQuery<Customer | null>({
    queryKey: customerId ? QUERY_KEYS.customer(customerId) : ['customer', 'null'],
    queryFn: async () => {
      if (!customerId) return null;
      
      return new Promise<Customer | null>((resolve, reject) => {
        const unsubscribe = subscribeToCustomer(
          customerId,
          (customer) => {
            unsubscribe();
            resolve(customer);
          },
          (error) => {
            unsubscribe();
            console.error(`❌ Error fetching customer ${customerId}:`, error);
            // Reject so TanStack Query retries instead of hanging on null
            reject(error);
          }
        );
      });
    },
    staleTime: CACHE_TIMES.STALE_TIME.customers,
    gcTime: CACHE_TIMES.CACHE_TIME.customers,
    enabled: !!customerId,
    retry: 2,
  });
};

/**
 * Cached hook for all orders
 * Only fetches if cache is stale (>2 minutes)
 * 
 * ✅ FEB 17, 2026: Added refetchInterval + refetchOnWindowFocus support
 * - refetchInterval: Allows components like BalanceWidget to poll for updates
 * - refetchOnWindowFocus: Enabled by default so customer sees admin-side changes
 *   when they tab back to the app (e.g., admin confirmed payment)
 */
export const useCachedOrders = (
  enabled: boolean = true, 
  limitCount: number = 100,
  options?: { refetchInterval?: number }
) => {
  return useQuery<Order[]>({
    queryKey: [...QUERY_KEYS.orders, limitCount],
    queryFn: async () => {
      // FIX T2R1-F5 (HIGH): Was `await getOrders()` (all orders) then
      // `.slice(0, limitCount)` client-side.  This downloaded the entire
      // orders collection and threw away everything past `limitCount` —
      // paying full Firestore read cost for data that was discarded, and
      // thrashing query gcTime caches with a much larger payload than
      // needed.  Now passes `limit` through to `getOrders`, which forwards
      // it to the underlying Firestore query (`fbGetOrders` accepts the
      // same options shape).  No more client-side slicing.
      const orders = await getOrders({ limit: limitCount });
      return orders;
    },
    // ✅ initialData ensures data is always Order[] (never undefined)
    initialData: [] as Order[],
    staleTime: CACHE_TIMES.STALE_TIME.orders,
    gcTime: CACHE_TIMES.CACHE_TIME.orders,
    enabled,
 // Allow window focus refetch so customer sees admin-side changes
    // (e.g., admin confirmed payment → order moves from approved to in_process)
    refetchOnWindowFocus: true,
 // Optional polling — BalanceWidget uses 60s interval
    // TanStack Query merges: shortest interval wins for shared query key
    ...(options?.refetchInterval ? { refetchInterval: options.refetchInterval } : {}),

  });
};

/**
 * Cached hook for active orders only (pending | approved | in_process).
 *
 * BUG 2 FIX: useCachedOrders() fetches ALL orders then slices to limitCount=100,
 * silently dropping in-process orders from the Production Sheet, invoice views,
 * and badge counts when a bakery has more than 100 active orders.
 *
 * This hook queries Firestore with a status filter — no data is transferred for
 * terminal orders (completed/cancelled/rejected) — and imposes NO client-side cap.
 * Use this everywhere production planning or badge counts are needed.
 */
export const useCachedActiveOrders = (enabled: boolean = true) => {
  return useQuery<Order[]>({
    queryKey: ['orders', 'active'],
    queryFn: () => getActiveOrders(),
    initialData: [] as Order[],
    staleTime: CACHE_TIMES.STALE_TIME.orders,
    gcTime: CACHE_TIMES.CACHE_TIME.orders,
    enabled,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
};

/**
 * Cached hook for customer-specific orders
 *
 * FIX T2R1-F3 (CRITICAL): Was using subscribeToCustomerOrders inside a Promise
 * and immediately unsubscribing after the first callback.  That meant we paid
 * the cost of setting up a Firestore real-time subscription (more expensive
 * than a one-shot getDocs) and immediately tore it down — without getting
 * any of the live-update benefit.  Pure waste.
 *
 * The original comment justified it as "avoid Promise-never-resolves bug" but
 * the right fix is to use a real one-shot reader: getOrdersByCustomer.
 */
export const useCachedCustomerOrders = (customerId: string | null) => {
  return useQuery<Order[]>({
    queryKey: customerId ? QUERY_KEYS.customerOrders(customerId) : ['orders', 'customer', 'null'],
    queryFn: async () => {
      if (!customerId) return [];
      // ✅ One-shot fetch via the canonical service-layer reader.
      // This routes through ordersDataService → firebase/firestore/orders, which
      // applies schema validation via parseArrayPartial.
      const { getOrdersByCustomer } = await import('../services/data/ordersDataService');
      return await getOrdersByCustomer(customerId);
    },
    initialData: [] as Order[],
    staleTime: CACHE_TIMES.STALE_TIME.orders,
    gcTime: CACHE_TIMES.CACHE_TIME.orders,
    enabled: !!customerId,
    refetchOnMount: true,          // Always refetch when component mounts
    refetchOnWindowFocus: true,    // Refetch when window regains focus
    retry: 2,                      // Retry on error (e.g. after rules deploy)
  });
};

/**
 * Cached hook for products
 * Products rarely change, so long cache time
 */
export const useCachedProducts = (enabled: boolean = true) => {
  return useQuery<Product[]>({
    queryKey: QUERY_KEYS.products,
    queryFn: async () => {
      const products = await getProductsFromDataService();
      return products;
    },
    // ✅ initialData ensures data is always Product[] (never undefined)
    initialData: [] as Product[],
    staleTime: CACHE_TIMES.STALE_TIME.products,
    gcTime: CACHE_TIMES.CACHE_TIME.products,
    enabled,
  });
};

/**
 * Cached hook for notifications
 * Short cache time for freshness
 *
 * ✅ PASS 9 FIX: Promise rejects on Firestore error so TanStack Query retries
 *    instead of hanging in `loading` state forever. Without this fix, a
 *    transient permission error or rules-deploy churn would freeze the
 *    notification bell indefinitely.
 */
export const useCachedNotifications = (userId: string | null) => {
  return useQuery<NotificationData[]>({
    queryKey: userId ? QUERY_KEYS.notifications(userId) : ['notifications', 'null'],
    queryFn: async () => {
      if (!userId) return [];
      
      return new Promise<NotificationData[]>((resolve, reject) => {
        const unsubscribe = subscribeToNotifications(
          userId,
          (notifications) => {
            unsubscribe();
            resolve(notifications);
          },
          'customer',
          (error) => {
            unsubscribe();
            console.error(`❌ Error fetching notifications for ${userId}:`, error);
            // Reject so TanStack Query retries instead of hanging
            reject(error);
          }
        );
      });
    },
    // ✅ initialData ensures data is always NotificationData[] (never undefined)
    initialData: [] as NotificationData[],
    staleTime: CACHE_TIMES.STALE_TIME.notifications,
    gcTime: CACHE_TIMES.CACHE_TIME.notifications,
    enabled: !!userId,
    retry: 2,
  });
};

/**
 * Cached hook for settings — LIVE Firestore listener
 *
 * ✅ FIXED: Previously unsubscribed immediately after first value,
 *    meaning admin changes would not reflect in the customer footer
 *    until the 30-minute stale time expired.
 *
 * Now uses a persistent Firestore onSnapshot listener:
 * - Initial value loaded via queryFn (staleTime = 0 → always fresh)
 * - Every subsequent Firestore write pushes to queryClient.setQueryData
 * - All consumers (HomePage footer, InvoicePreviewModal, etc.) update
 *   within ~1 second of admin clicking "Save Settings"
 */
export const useCachedSettings = () => {
  const queryClient = useQueryClient();
  const unsubRef = useRef<(() => void) | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // Wait for Firebase Auth to confirm a user before subscribing to settings.
  // Without this guard the Firestore listener fires before auth resolves and
  // produces "Missing or insufficient permissions" errors.
  useEffect(() => {
    const unsub = onAuthStateChanged((user) => setIsAuthed(!!user));
    return unsub;
  }, []);

  // Only subscribe once we know the user is authenticated.
  useEffect(() => {
    if (!isAuthed) return;

    const unsub = safeSubscribe('settings-listener', () =>
      subscribeToSettings((settings) => {
        queryClient.setQueryData<Settings | null>(QUERY_KEYS.settings, settings);
      })
    );

    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [isAuthed, queryClient]);

  return useQuery<Settings | null>({
    queryKey: QUERY_KEYS.settings,
    queryFn: async () => {
      // One-time fetch to seed the cache on first load;
      // the useEffect listener will keep it updated afterwards.
      return new Promise<Settings | null>((resolve) => {
        const unsub = subscribeToSettings((settings) => {
          unsub();
          resolve(settings);
        });
      });
    },
    enabled: isAuthed,           // Don't even attempt the query until auth is confirmed
    staleTime: 0,
    gcTime: CACHE_TIMES.CACHE_TIME.settings,
    refetchOnWindowFocus: false,
  });
};

/**
 * Cached hook for credit balance
 * 
 * ✅ FEB 17, 2026: Replaces synchronous getAvailableCredit + 5s polling in CreditBalanceWidget
 * ✅ MAR 4, 2026: MIGRATED TO FIRESTORE — reads from creditNotes collection
 * - queryFn wraps the async Firestore read for TanStack Query compatibility
 * - refetchOnWindowFocus: true so customer sees admin-side credit changes on tab focus
 * - Supports refetchInterval for background polling (CreditBalanceWidget uses 60s)
 */
export const useCachedCreditBalance = (
  customerId: string | null,
  options?: { refetchInterval?: number }
) => {
  return useQuery<number>({
    queryKey: customerId ? QUERY_KEYS.creditBalance(customerId) : ['credit', 'balance', 'null'],
    queryFn: async () => {
      if (!customerId) return 0;
      
 // Get credit notes from Firestore
      const { getCreditNotes } = await import('../firebase/firestore');
      const creditNotes = await getCreditNotes(customerId);
      
      // Calculate available credit from credit notes
      const availableCredit = creditNotes
        .filter((note) => note.status === 'available' || note.status === 'partially_used')
        .reduce((sum, note) => sum + (note.remainingBalance ?? (note.amount ?? 0)), 0);
      return availableCredit;
    },
    staleTime: 0, // Always re-fetch when invalidated — credit balance must be up-to-date
    gcTime: 30 * 60 * 1000, // 30 minutes in memory
    refetchOnWindowFocus: true, // ✅ See admin-side credit changes on tab focus
    ...(options?.refetchInterval ? { refetchInterval: options.refetchInterval } : {}),
    enabled: !!customerId,
  });
};

// ============================================
// CACHE INVALIDATION HELPERS
// ============================================

/**
 * Invalidate (refresh) specific cache keys
 * Call these after mutations (create/update/delete)
 */
export const invalidateCache = {
  customers: async () => {
    await queryClient.refetchQueries({ queryKey: QUERY_KEYS.customers, exact: false });
  },
  customer: (id: string) => queryClient.refetchQueries({ queryKey: QUERY_KEYS.customer(id) }),
  orders: async () => {
    await queryClient.refetchQueries({ queryKey: QUERY_KEYS.orders, exact: false }); // ✅ exact: false to match all order queries
  },
  order: (id: string) => queryClient.refetchQueries({ queryKey: QUERY_KEYS.order(id) }),
  customerOrders: (customerId: string) => queryClient.refetchQueries({ queryKey: QUERY_KEYS.customerOrders(customerId) }),
  products: () => queryClient.refetchQueries({ queryKey: QUERY_KEYS.products }),
  settings: () => queryClient.refetchQueries({ queryKey: QUERY_KEYS.settings }),
  notifications: (userId: string) => queryClient.refetchQueries({ queryKey: QUERY_KEYS.notifications(userId) }),
 // Credit balance invalidation
  // Call after credit mutations (admin edit paid order, apply credit, create credit note)
  credit: async (customerId?: string) => {
    if (customerId) {
      await queryClient.refetchQueries({ queryKey: QUERY_KEYS.creditBalance(customerId) });
    } else {
      // Invalidate ALL credit balance queries (any customer)
      await queryClient.refetchQueries({ queryKey: ['credit'], exact: false });
    }
  },
  all: () => queryClient.refetchQueries(),
};

/**
 * Prefetch data (load in background before user needs it)
 */
export const prefetchCache = {
  customers: (limitCount = 100) => 
    queryClient.prefetchQuery({
      queryKey: [...QUERY_KEYS.customers, limitCount],
      queryFn: async () => {
        const customers = await getAllCustomers();
        return customers.slice(0, limitCount);
      },
    }),
  
  orders: (limitCount = 100) =>
    queryClient.prefetchQuery({
      queryKey: [...QUERY_KEYS.orders, limitCount],
      queryFn: async () => {
        const orders = await getOrders();
        return orders.slice(0, limitCount);
      },
    }),
  
  products: () =>
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.products,
      queryFn: async () => {
        const products = await getProductsFromDataService();
        return products;
      },
    }),
};

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * BEFORE (No cache):
 * 
 * function PendingOrders({ isActive }) {
 *   const { orders } = useConditionalOrders(isActive);
 *   // ❌ Fetches from Firebase every time component mounts
 *   // ❌ 100 reads per mount
 * }
 * 
 * AFTER (With cache):
 * 
 * function PendingOrders({ isActive }) {
 *   const { data: orders, isLoading } = useCachedOrders(isActive);
 *   // ✅ First mount: 100 reads from Firebase → cached
 *   // ✅ Return visit (within 2 min): 0 reads (from cache!)
 *   // ✅ After 2 min: Background refetch, shows cached data immediately
 * }
 * 
 * RESULT:
 * - 10 page visits without cache: 1000 reads
 * - 10 page visits with cache: 100-200 reads (-80-90%)
 */