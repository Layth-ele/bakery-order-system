/**
 * routes/loaders/utils.ts
 * 
 * Utilities for creating performant route loaders that integrate
 * with TanStack Query cache and Firebase data services.
 * 
 * These utilities eliminate waterfall requests, prevent duplicate
 * network calls, and provide automatic cache management.
 * 
 * Created: March 10, 2026
 */

import type { LoaderFunctionArgs } from 'react-router';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface QueryLoaderOptions {
  /**
   * Time in ms before data is considered stale
   * @default 5 * 60 * 1000 (5 minutes)
   */
  staleTime?: number;
  
  /**
   * Time in ms before cached data is garbage collected
   * @default 10 * 60 * 1000 (10 minutes)
   */
  cacheTime?: number;
  
  /**
   * Custom cache key prefix
   */
  keyPrefix?: string;
}

export interface LoaderPerformanceMetrics {
  loaderName: string;
  duration: number;
  timestamp: number;
  cacheHit: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE (Simple implementation)
// ═══════════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Return cached data if not stale
    if (age < entry.staleTime) {
      return entry.data as T;
    }
    
    // Remove stale entry
    this.cache.delete(key);
    return undefined;
  }
  
  set<T>(key: string, data: T, staleTime: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTime,
    });
  }
  
  invalidate(keyPattern: string | RegExp): void {
    const pattern = typeof keyPattern === 'string' 
      ? new RegExp(`^${keyPattern}`) 
      : keyPattern;
    
    for (const [key] of this.cache) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getSize(): number {
    return this.cache.size;
  }
}

// Global cache instance
//
// FIX T2R2-C4 (CRITICAL — security): This Map is module-level so it survives
// across user sessions on the same browser tab.  Without an explicit clear on
// logout, User B logging in could read User A's cached route data for up to
// the configured staleTime (default 5 minutes).  authService.logout now imports
// and calls clearRouteCache(); see line 134 below for the export.
const routeCache = new SimpleCache();

// ═══════════════════════════════════════════════════════════════════════════
// CACHE ACCESS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the route cache instance
 * Use this to manually invalidate cache entries
 */
export function getRouteCache(): SimpleCache {
  return routeCache;
}

/**
 * Invalidate cache by pattern
 * 
 * @example
 * invalidateRouteCache('orders'); // Invalidates all order-related cache
 * invalidateRouteCache(/^admin-/); // Invalidates all admin caches
 */
export function invalidateRouteCache(pattern: string | RegExp): void {
  routeCache.invalidate(pattern);
}

/**
 * Clear all route cache
 *
 * Called by authService.logout (FIX T2R2-C4 / T2R2-H4) so the next user does
 * not inherit cached routes/metrics from the previous session.
 */
export function clearRouteCache(): void {
  routeCache.clear();
  // Also reset performance metrics — they leak route names from the prior
  // user's session into window.__routeLoaderUtils.getMetrics() in dev.
  performanceMetrics.length = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a route loader that integrates with cache
 * 
 * @example
 * export const ordersLoader = createQueryLoader(
 *   'pending-orders',
 *   () => fetchPendingOrders(),
 *   { staleTime: 60 * 1000 } // 1 minute
 * );
 */
export function createQueryLoader<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: QueryLoaderOptions = {}
): () => Promise<T> {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes default
    keyPrefix = 'route-loader',
  } = options;
  
  const fullKey = `${keyPrefix}:${cacheKey}`;
  
  return async () => {
    // FIX T2R2-H5 (HIGH): Removed two empty `if (DEV) {}` instrumentation
    // blocks. They were dead — the bodies had no statements — but each
    // one ran a property-access chain (`typeof import.meta !== 'undefined'
    // && import.meta.env?.DEV`) on every loader invocation.  Net effect:
    // tiny perf cost + cognitive noise during code review.  Removed.
    // If logging becomes useful, use `logger.log` directly with a clear
    // statement.
    const cached = routeCache.get<T>(fullKey);
    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await queryFn();

    // Store in cache
    routeCache.set(fullKey, data, staleTime);

    return data;
  };
}

/**
 * Load multiple queries in parallel
 * Prevents waterfall requests
 * 
 * @example
 * export const dashboardLoader = createParallelLoader({
 *   orders: () => fetchOrders(),
 *   customers: () => fetchCustomers(),
 *   products: () => fetchProducts(),
 * });
 * 
 * // Component usage:
 * const { orders, customers, products } = useLoaderData();
 */
export function createParallelLoader<T extends Record<string, any>>(
  loaders: Record<keyof T, () => Promise<any>>
): () => Promise<T> {
  return async () => {
    const entries = Object.entries(loaders);
    
    // Load all in parallel
    const results = await Promise.all(
      entries.map(([_, loader]) => loader())
    );
    
    // Combine results
    return Object.fromEntries(
      entries.map(([key], index) => [key, results[index]])
    ) as T;
  };
}

/**
 * Create loader with URL param parsing
 * 
 * @example
 * export const orderDetailsLoader = createParamLoader(
 *   async (params) => {
 *     const order = await fetchOrder(params.orderId);
 *     const customer = await fetchCustomer(order.customerId);
 *     return { order, customer };
 *   }
 * );
 */
export function createParamLoader<T>(
  loader: (params: Record<string, string | undefined>) => Promise<T>
): (args: LoaderFunctionArgs) => Promise<T> {
  return async ({ params }: LoaderFunctionArgs) => {
    return loader(params as Record<string, string | undefined>);
  };
}

/**
 * Create loader with search param parsing
 * 
 * @example
 * export const filteredOrdersLoader = createSearchParamLoader(
 *   async (searchParams) => {
 *     const status = searchParams.get('status') || 'all';
 *     const page = parseInt(searchParams.get('page') || '1', 10);
 *     return fetchOrders({ status, page });
 *   }
 * );
 */
export function createSearchParamLoader<T>(
  loader: (searchParams: URLSearchParams) => Promise<T>
): (args: LoaderFunctionArgs) => Promise<T> {
  return async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    return loader(url.searchParams);
  };
}

/**
 * Measure loader performance and warn about slow loaders
 * 
 * @example
 * export const dashboardLoader = withLoaderTiming(
 *   'dashboard',
 *   createParallelLoader({ ... })
 * );
 */
export function withLoaderTiming<T>(
  name: string,
  loader: () => Promise<T>
): () => Promise<T> {
  return async () => {
    const start = performance.now();
    
    try {
      const result = await loader();
      const duration = performance.now() - start;
      
      // Track performance metrics
      trackLoaderPerformance({
        loaderName: name,
        duration,
        timestamp: Date.now(),
        cacheHit: false, // TODO: track actual cache hits
      });
      
      // Warn about slow loaders in development
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && duration > 500) {
        logger.warn(
          `⚠️ Slow loader: "${name}" took ${duration.toFixed(2)}ms\n` +
          `Consider optimizing this loader or splitting it into smaller chunks.`
        );
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(
        `❌ Loader failed: "${name}" after ${duration.toFixed(2)}ms`,
        error
      );
      throw error;
    }
  };
}

/**
 * Create loader with retry logic
 * 
 * @example
 * export const criticalLoader = withRetry(
 *   createQueryLoader('critical-data', fetchCriticalData),
 *   { maxRetries: 3, retryDelay: 1000 }
 * );
 */
export function withRetry<T>(
  loader: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): () => Promise<T> {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    shouldRetry = () => true,
  } = options;
  
  return async () => {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await loader();
      } catch (error) {
        lastError = error;
        
        // Don't retry if we shouldn't
        if (!shouldRetry(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt < maxRetries) {
          if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
            logger.warn(
              `Loader failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms...`
            );
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    throw lastError;
  };
}

/**
 * Create loader with fallback data
 * Returns fallback if loader fails
 * 
 * @example
 * export const optionalLoader = withFallback(
 *   createQueryLoader('optional-data', fetchOptionalData),
 *   { data: [], message: 'Using cached data' }
 * );
 */
export function withFallback<T>(
  loader: () => Promise<T>,
  fallback: T
): () => Promise<T> {
  return async () => {
    try {
      return await loader();
    } catch (error) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      }
      return fallback;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

const performanceMetrics: LoaderPerformanceMetrics[] = [];

function trackLoaderPerformance(metrics: LoaderPerformanceMetrics): void {
  performanceMetrics.push(metrics);
  
  // Keep only last 100 metrics
  if (performanceMetrics.length > 100) {
    performanceMetrics.shift();
  }
}

/**
 * Get loader performance metrics
 * Useful for debugging and optimization
 */
export function getLoaderPerformanceMetrics(): LoaderPerformanceMetrics[] {
  return [...performanceMetrics];
}

/**
 * Get average loader duration
 */
export function getAverageLoaderDuration(loaderName?: string): number {
  const metrics = loaderName
    ? performanceMetrics.filter(m => m.loaderName === loaderName)
    : performanceMetrics;
  
  if (metrics.length === 0) return 0;
  
  const total = metrics.reduce((sum, m) => sum + m.duration, 0);
  return total / metrics.length;
}

/**
 * Get slowest loaders
 */
export function getSlowestLoaders(count = 5): LoaderPerformanceMetrics[] {
  return [...performanceMetrics]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, count);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Expose utilities in dev mode for debugging
  (window as any).__routeLoaderUtils = {
    getCache: () => routeCache,
    invalidateCache: invalidateRouteCache,
    clearCache: clearRouteCache,
    getMetrics: getLoaderPerformanceMetrics,
    getAverageDuration: getAverageLoaderDuration,
    getSlowest: getSlowestLoaders,
  };
  
  logger.log(
    '🔧 Route loader utilities available at window.__routeLoaderUtils'
  );
}