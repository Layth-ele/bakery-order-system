/**
 * navigationGuards.ts
 * Route guards using Firebase Auth as source of truth.
 * 
 * Production: reads from Firebase Auth + Firestore — cannot be spoofed via localStorage.
 * Demo mode:  falls back to localStorage only when isFirebaseConfigured is false.
 */

import { redirect, LoaderFunctionArgs } from 'react-router';
import { auth, isFirebaseConfigured } from '../../firebase/config';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { getCustomerForAuth } from '../../services/dataService';

const STORAGE_KEYS = {
  USER: 'bakery_user',
  REDIRECT_AFTER_LOGIN: 'bakery_redirect_after_login',
  LAST_VISITED_ADMIN: 'bakery_last_admin_page',
  LAST_VISITED_CUSTOMER: 'bakery_last_customer_page',
} as const;

// FIX BUG 7 (MEDIUM): Module-level cache for the last resolved user role.
// getCurrentUserSync() previously hardcoded role:'customer' regardless of the
// actual Firestore customerType, making any future caller that checks .role
// silently deny admin privileges. Now getCurrentUser() (async) writes the
// resolved role here, and getCurrentUserSync() reads it back — so callers
// that run after the first async resolution get the correct role.
//
// FIX R1-S2-F2 (CRITICAL): _cachedRole is module-level → it persists across
// user sessions on shared devices.  Without explicit clear-on-logout, the next
// user inherits the previous user's role.  authService.logout now imports and
// calls clearAuthCache() to reset this state.
let _cachedRole: 'admin' | 'customer' = 'customer';

/**
 * Clear the cached auth role.  MUST be called by logout() so the next user
 * doesn't inherit the previous user's role on shared devices.
 */
export function clearAuthCache(): void {
  _cachedRole = 'customer';
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  status?: 'pending' | 'approved' | 'rejected' | 'suspended' | 'archived';
  [key: string]: unknown;
}

/**
 * Get current user from Firebase Auth (production) or localStorage (demo mode).
 */
export async function getCurrentUser(): Promise<User | null> {
  if (isFirebaseConfigured) {
    // ✅ Wait for Firebase to restore session from localStorage cache.
    // auth.currentUser is null until this resolves — without it, page
    // refresh immediately redirects logged-in users to the login page.
    await auth.authStateReady();

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;

    try {
      const customer = await getCustomerForAuth(firebaseUser.uid);
      if (customer) {
        // FIX T2R2-C3 (CRITICAL — security): Was defaulting missing status to
        // 'approved'.  That was a fail-open security policy: any customer
        // record without a status field (failed registration write, manual
        // admin edit that dropped the field, seed-script-created docs)
        // automatically gained full approved-customer access — bypassing
        // admin approval entirely.  Now defaults to 'pending', forcing
        // explicit admin approval. Existing approved customers are not
        // affected because their docs already have status:'approved' set.
        // Admin accounts pass through the customerType check below so they
        // continue to work even without a status field.
        const effectiveStatus = customer.status ?? 'pending';
        const resolvedRole: 'admin' | 'customer' =
          customer.customerType === 'admin' ? 'admin' : 'customer';
        // FIX BUG 7: Persist resolved role so getCurrentUserSync() returns the
        // correct value for any caller that runs after this async resolution.
        _cachedRole = resolvedRole;
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email ?? (customer.email ?? ""),
          role: resolvedRole,
          status: effectiveStatus,
          storeName: (customer.storeName ?? ""),
          contactPerson: (customer.contactPerson ?? ""),
          customerType: customer.customerType,
        };
      }
      // FIX BUG 15: Firebase Auth valid but no Firestore profile → reject, not approve.
      // Previously granted status:'approved' unconditionally, matching the BUG 3 pattern
      // in useAuth.tsx. A Firebase Auth account with no customer document means the
      // account is incomplete, deleted, or rejected — do not allow access.
      await firebaseSignOut(auth);
      return null;
    } catch {
      // FIX BUG 15: Firestore unavailable on load — fail safe, not fail open.
      // Redirecting to login is safer than granting 'approved' access based on
      // unverifiable client state. User can refresh once connectivity returns.
      await firebaseSignOut(auth);
      return null;
    }
  }
  return null;
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

export function isApprovedCustomer(user: User | null): boolean {
  return user?.role === 'customer' && user?.status === 'approved';
}

export function getDefaultDashboard(user: User): string {
  if (isAdmin(user)) return sessionStorage.getItem(STORAGE_KEYS.LAST_VISITED_ADMIN) || '/admin/pending';
  if (isApprovedCustomer(user)) return sessionStorage.getItem(STORAGE_KEYS.LAST_VISITED_CUSTOMER) || '/customer';
  return '/account-status';
}

export function saveRedirectPath(path: string) {
  if (path === '/' || path === '/account-status') return;
  sessionStorage.setItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN, path);
}

export function getAndClearRedirectPath(): string | null {
  const path = sessionStorage.getItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN);
  if (path) { sessionStorage.removeItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN); return path; }
  return null;
}

export function saveLastVisitedPage(path: string, user: User) {
  if (path.startsWith('/admin/')) sessionStorage.setItem(STORAGE_KEYS.LAST_VISITED_ADMIN, path);
  else if (path.startsWith('/customer')) sessionStorage.setItem(STORAGE_KEYS.LAST_VISITED_CUSTOMER, path);
}

export async function rootLoader() {
  const user = await getCurrentUser();
  return { user };
}

export async function publicGuard({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();
  if (!user) return null;
  
  // Pending/rejected/suspended users should stay on login page
  // Their status will be shown via the alert system after login attempt
  if (!isAdmin(user) && !isApprovedCustomer(user)) {
    // Sign them out so they can re-attempt login after approval
    try { await firebaseSignOut(auth); } catch {}
    return null; // Show login page
  }
  
  const redirectPath = getAndClearRedirectPath();
  if (redirectPath) return redirect(redirectPath);
  return redirect(getDefaultDashboard(user));
}

export async function authGuard({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(request.url);
    saveRedirectPath(url.pathname + url.search);
    return redirect('/');
  }
  saveLastVisitedPage(new URL(request.url).pathname, user);
  return { user };
}

export async function adminGuard({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();
  if (!user) {
    saveRedirectPath(new URL(request.url).pathname + new URL(request.url).search);
    return redirect('/');
  }
  if (!isAdmin(user)) return isApprovedCustomer(user) ? redirect('/customer') : redirect('/account-status');
  saveLastVisitedPage(new URL(request.url).pathname, user);
  return { user };
}

export async function customerGuard({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();
  if (!user) {
    saveRedirectPath(new URL(request.url).pathname + new URL(request.url).search);
    return redirect('/');
  }
  if (isAdmin(user)) return redirect('/admin');
  if (!isApprovedCustomer(user)) return redirect('/account-status');
  saveLastVisitedPage(new URL(request.url).pathname, user);
  return { user };
}

export async function accountStatusGuard({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser();
  if (!user) return redirect('/');
  if (isAdmin(user)) return redirect('/admin');
  if (isApprovedCustomer(user)) return redirect('/customer');
  return { user, status: user.status || 'pending' };
}

export function canAccessPath(user: User | null, path: string): boolean {
  if (!user) return path === '/';
  if (path.startsWith('/admin')) return isAdmin(user);
  if (path.startsWith('/customer')) return isApprovedCustomer(user);
  return true;
}

export function getRedirectIfUnauthorized(user: User | null, path: string): string | null {
  if (canAccessPath(user, path)) return null;
  if (!user) return '/';
  return getDefaultDashboard(user);
}

// Legacy sync export for backward compat (some hooks call this synchronously)
// Reads from Firebase Auth synchronously — works after authStateReady() has resolved.
// FIX BUG 7 (MEDIUM): Role is now sourced from _cachedRole (populated by the async
// getCurrentUser() path) instead of being hardcoded to 'customer'. Callers that run
// after the first async resolution will get the correct admin/customer role.
export function getCurrentUserSync(): User | null {
  if (!isFirebaseConfigured) return null;
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    role: _cachedRole,
  };
}

export function isAuthenticated(): boolean {
  return getCurrentUserSync() !== null;
}
