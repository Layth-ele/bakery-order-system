import type { LinkProps } from 'react-router';
/**
 * routes/utils/prefetch.ts
 * 
 * Route prefetching utilities for instant navigation.
 * Preloads route data when user hovers over links.
 * 
 * Benefits:
 * - Navigation feels instant (data already loaded)
 * - Smart prefetching (only on hover intent)
 * - Bandwidth-conscious (no aggressive prefetching)
 * 
 * Created: March 10, 2026
 */

import {Link} from 'react-router'
import { useEffect, useCallback, useState } from 'react';

// Import route loaders for prefetching
import type {
  pendingOrdersLoader,
  approvedOrdersLoader,
  completeOrdersLoader,
  unpaidOrdersLoader,
  customersListLoader,
  manageProductsLoader,
  systemSettingsLoader,
} from '../loaders/adminLoaders';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PrefetchStrategy = 
  | 'intent'   // Prefetch on hover (default, recommended)
  | 'render'   // Prefetch immediately when link renders
  | 'viewport' // Prefetch when link enters viewport
  | 'none';    // No prefetching

export interface PrefetchLinkProps extends LinkProps {
  /**
   * Prefetch strategy
   * @default 'intent'
   */
  prefetch?: PrefetchStrategy;
  
  /**
   * Delay before prefetching on hover (ms)
   * @default 100
   */
  prefetchDelay?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE LOADER REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map of routes to their loader functions
 * Used to prefetch data for specific routes
 */
const routeLoaderMap = new Map<string, () => Promise<any>>();

/**
 * Register a route loader for prefetching
 * Call this in your route configuration
 */
export function registerRouteLoader(
  path: string,
  loader: () => Promise<any>
): void {
  routeLoaderMap.set(path, loader);
}

/**
 * Get loader for a specific route
 */
function getRouteLoader(path: string): (() => Promise<any>) | undefined {
  // Try exact match first
  if (routeLoaderMap.has(path)) {
    return routeLoaderMap.get(path);
  }
  
  // Try pattern matching (e.g., /admin/pending matches /admin/:page)
  for (const [pattern, loader] of routeLoaderMap.entries()) {
    if (matchRoutePattern(pattern, path)) {
      return loader;
    }
  }
  
  return undefined;
}

/**
 * Simple route pattern matching
 */
function matchRoutePattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  
  return patternParts.every((part, i) => {
    return part.startsWith(':') || part === pathParts[i];
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PREFETCH STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Track which routes have been prefetched
 */
const prefetchedRoutes = new Set<string>();

/**
 * Track in-flight prefetch requests
 */
const prefetchingRoutes = new Set<string>();

/**
 * Check if route is already prefetched
 */
function isPrefetched(path: string): boolean {
  return prefetchedRoutes.has(path);
}

/**
 * Check if route is currently being prefetched
 */
function isPrefetching(path: string): boolean {
  return prefetchingRoutes.has(path);
}

/**
 * Mark route as prefetched
 */
function markPrefetched(path: string): void {
  prefetchedRoutes.add(path);
}

/**
 * Clear prefetch cache
 */
export function clearPrefetchCache(): void {
  prefetchedRoutes.clear();
  prefetchingRoutes.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE PREFETCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prefetch a route's data
 * 
 * @param path - Route path to prefetch
 * @returns Promise that resolves when prefetch is complete
 */
export async function prefetchRoute(path: string): Promise<void> {
  // Skip if already prefetched or in progress
  if (isPrefetched(path) || isPrefetching(path)) {
    return;
  }
  
  // Get loader for this route
  const loader = getRouteLoader(path);
  if (!loader) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      logger.warn(`No loader registered for route: ${path}`);
    }
    return;
  }
  
  try {
    // Mark as in-progress
    prefetchingRoutes.add(path);
    
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    }
    
    // Execute loader
    await loader();
    
    // Mark as complete
    markPrefetched(path);
    
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    }
  } catch (error) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.error(`❌ Failed to prefetch route: ${path}`, error);
    }
  } finally {
    // Remove from in-progress
    prefetchingRoutes.delete(path);
  }
}

/**
 * Prefetch multiple routes in parallel
 */
export async function prefetchRoutes(paths: string[]): Promise<void> {
  await Promise.all(paths.map(prefetchRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART PREFETCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Predict and prefetch likely next routes based on current route
 */
export function prefetchLikelyNextRoutes(currentPath: string): void {
  const likelyNextRoutes: Record<string, string[]> = {
    '/admin/pending': ['/admin/approved', '/admin/customers'],
    '/admin/approved': ['/admin/production-todo', '/admin/history'],
    '/admin/unpaid': ['/admin/customers', '/admin/history'],
    '/admin/customers': ['/admin/pending', '/admin/analytics'],
    '/admin/products': ['/admin/pending', '/admin/analytics'],
    '/admin/settings': ['/admin/pending'],
  };
  
  const nextRoutes = likelyNextRoutes[currentPath] || [];
  
  // Prefetch in background (don't wait)
  if (nextRoutes.length > 0) {
    setTimeout(() => {
      prefetchRoutes(nextRoutes);
    }, 1000); // Wait 1s before prefetching (let page settle)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PREFETCH LINK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Link component with intelligent prefetching
 * 
 * @example
 * // Prefetch on hover (default)
 * <PrefetchLink to="/admin/pending">
 *   Pending Orders
 * </PrefetchLink>
 * 
 * @example
 * // Prefetch immediately
 * <PrefetchLink to="/admin/customers" prefetch="render">
 *   Customers
 * </PrefetchLink>
 * 
 * @example
 * // No prefetching
 * <PrefetchLink to="/admin/settings" prefetch="none">
 *   Settings
 * </PrefetchLink>
 */
export function PrefetchLink({ 
  to, 
  children, 
  prefetch = 'intent',
  prefetchDelay = 100,
  onMouseEnter,
  ...props 
}: PrefetchLinkProps): JSX.Element | null {
  const [hoverTimeout, setHoverTimeout] = useState<number | null>(null);
  
  // Prefetch on render
  useEffect(() => {
    if (prefetch === 'render' && typeof to === 'string') {
      prefetchRoute(to);
    }
  }, [to, prefetch]);
  
  // Prefetch on viewport (intersection observer)
  useEffect(() => {
    if (prefetch !== 'viewport' || typeof to !== 'string') {
      return;
    }
    
    // TODO: Implement intersection observer
    // This is a placeholder for viewport-based prefetching
    
  }, [to, prefetch]);
  
  // Handle hover prefetch
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call original onMouseEnter if provided
    onMouseEnter?.(e);
    
    // Prefetch on hover intent
    if (prefetch === 'intent' && typeof to === 'string') {
      // Clear any existing timeout
      if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
      }
      
      // Set timeout for prefetch (debounce fast hovers)
      const timeout = window.setTimeout(() => {
        prefetchRoute(to);
      }, prefetchDelay);
      
      setHoverTimeout(timeout);
    }
  }, [to, prefetch, prefetchDelay, onMouseEnter, hoverTimeout]);
  
  const handleMouseLeave = useCallback(() => {
    // Clear timeout if user moves away quickly
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  }, [hoverTimeout]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);
  
  return (
    <Link 
      to={to} 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to prefetch routes programmatically
 * 
 * @example
 * function MyComponent() {
 *   const { prefetch, prefetchAll } = usePrefetch();
 *   
 *   useEffect(() => {
 *     // Prefetch on component mount
 *     prefetch('/admin/pending');
 *   }, []);
 *   
 *   return ...
 * }
 */
export function usePrefetch() {
  const prefetch = useCallback((path: string) => {
    prefetchRoute(path);
  }, []);
  
  const prefetchAll = useCallback((paths: string[]) => {
    prefetchRoutes(paths);
  }, []);
  
  const prefetchLikelyNext = useCallback((currentPath: string) => {
    prefetchLikelyNextRoutes(currentPath);
  }, []);
  
  return {
    prefetch,
    prefetchAll,
    prefetchLikelyNext,
    clearCache: clearPrefetchCache,
  };
}

/**
 * Hook to automatically prefetch likely next routes
 * Call this in your layout component
 * 
 * @example
 * function AdminLayout() {
 *   const location = useLocation();
 *   useAutoPrefetch(location.pathname);
 *   
 *   return <Outlet />;
 * }
 */
export function useAutoPrefetch(currentPath: string) {
  useEffect(() => {
    // Wait for page to settle before prefetching
    const timeout = setTimeout(() => {
      prefetchLikelyNextRoutes(currentPath);
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [currentPath]);
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize prefetch system with route loaders
 * Call this once at app startup
 */
export function initializePrefetch() {
  // Register admin route loaders
  // These will be dynamically imported when needed
  
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Expose utilities for debugging
  (window as any).__prefetchUtils = {
    prefetch: prefetchRoute,
    prefetchAll: prefetchRoutes,
    clear: clearPrefetchCache,
    getPrefetched: () => Array.from(prefetchedRoutes),
    getPrefetching: () => Array.from(prefetchingRoutes),
    getLoaders: () => Array.from(routeLoaderMap.keys()),
    register: registerRouteLoader,
  };
  
  logger.log(
    '🔧 Prefetch utilities available at window.__prefetchUtils\n' +
    'Try: await window.__prefetchUtils.prefetch("/admin/pending")'
  );
}