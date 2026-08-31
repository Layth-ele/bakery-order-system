/**
 * navigation.ts
 * Navigation utilities and helpers
 * 
 * Features:
 * - Safe navigation with permission checks
 * - Redirect history management
 * - Deep link support
 * - Navigation state management
 */

import { NavigateFunction } from 'react-router';
import {getCurrentUser, getRedirectIfUnauthorized} from '../guards/navigationGuards'

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION STATE
// ═══════════════════════════════════════════════════════════════════════════

interface NavigationState {
  from?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Navigate with state tracking
 */
export function navigateWithState(
  navigate: NavigateFunction,
  to: string,
  state?: NavigationState
) {
  navigate(to, {
    state: {
      ...state,
      from: window.location.pathname,
      timestamp: Date.now(),
    },
  });
}

/**
 * Safe navigation - checks permissions before navigating
 */
export async function safeNavigate(
  navigate: NavigateFunction,
  to: string,
  state?: NavigationState
) {
  const user = await getCurrentUser();
  const redirectPath = getRedirectIfUnauthorized(user, to);
  
  if (redirectPath) {
    // User doesn't have permission, redirect to their default dashboard
    navigateWithState(navigate, redirectPath, state);
  } else {
    // User has permission, navigate normally
    navigateWithState(navigate, to, state);
  }
}

/**
 * Navigate back with fallback
 */
export function navigateBack(
  navigate: NavigateFunction,
  fallbackPath: string = '/'
) {
  if (window.history.length > 2) {
    navigate(-1);
  } else {
    navigate(fallbackPath);
  }
}

/**
 * Navigate to user's default dashboard
 */
export async function navigateToDashboard(navigate: NavigateFunction) {
  const user = await getCurrentUser();
  
  if (!user) {
    navigate('/');
    return;
  }
  
  if (user?.role === 'admin') {
    navigate('/admin');
  } else if (user?.status === 'approved') {
    navigate('/customer');
  } else {
    navigate('/account-status');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build route with query parameters
 */
export function buildRoute(path: string, params?: Record<string, string | number | boolean>) {
  if (!params) return path;
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });
  
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Parse query parameters from current URL
 */
export function parseQueryParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
}

/**
 * Admin route builder
 */
export const adminRoutes = {
  pending: () => '/admin/pending',
  unpaid: () => '/admin/unpaid',
  approved: () => '/admin/approved',
  history: () => '/admin/history',
  analytics: () => '/admin/analytics',
  customers: () => '/admin/customers',
  products: () => '/admin/products',
  settings: () => '/admin/settings',
  registrations: () => '/admin/registrations',
  productionTodo: () => '/admin/production-todo',
  weeklyInvoices: () => '/admin/weekly-invoices',
} as const;

/**
 * Customer route builder
 */
export const customerRoutes = {
  dashboard: () => '/customer',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BREADCRUMB HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get breadcrumb label for a path
 */
export function getBreadcrumbLabel(path: string): string {
  const pathMap: Record<string, string> = {
    '/': 'Home',
    '/admin': 'Admin',
    '/admin/pending': 'Pending Orders',
    '/admin/unpaid': 'Unpaid Orders',
    '/admin/approved': 'Approved Orders',
    '/admin/history': 'Order History',
    '/admin/analytics': 'Analytics',
    '/admin/customers': 'Customers',
    '/admin/products': 'Products',
    '/admin/settings': 'Settings',
    '/admin/registrations': 'Registration Requests',
    '/admin/production-todo': 'Production Todo',
    '/admin/weekly-invoices': 'Weekly Invoices',
    '/customer': 'Dashboard',
    '/account-status': 'Account Status',
  };
  
  return pathMap[path] || 'Unknown';
}

/**
 * Get parent path for breadcrumbs
 */
export function getParentPath(path: string): string | null {
  if (path === '/') return null;
  
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 1) return '/';
  
  segments.pop();
  return '/' + segments.join('/');
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

const HISTORY_KEY = 'bakery_navigation_history';
const MAX_HISTORY_LENGTH = 10;

interface NavigationHistoryEntry {
  path: string;
  timestamp: number;
  title?: string;
}

/**
 * Add current page to navigation history
 */
export function addToNavigationHistory(path: string, title?: string) {
  const history = getNavigationHistory();
  
  history.unshift({
    path,
    timestamp: Date.now(),
    title,
  });
  
  // Keep only the most recent entries
  const trimmedHistory = history.slice(0, MAX_HISTORY_LENGTH);
  
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
}

/**
 * Get navigation history
 */
export function getNavigationHistory(): NavigationHistoryEntry[] {
  try {
    const stored = sessionStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear navigation history
 */
export function clearNavigationHistory() {
  sessionStorage.removeItem(HISTORY_KEY);
}
