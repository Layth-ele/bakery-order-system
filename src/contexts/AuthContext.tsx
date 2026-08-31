/**
 * AuthContext.tsx
 *
 * FIX T2R1-F1 / T2R2-C1 (CRITICAL): Centralized auth state via Context.
 *
 * Before: useAuth was a hook, not a context. 33+ components called it directly,
 * each creating their own onAuthStateChanged listener, customers/{uid} Firestore
 * snapshot, and DOM event listeners.  That meant ~132 active subscriptions for
 * the same data — every login/logout fired 33 parallel callbacks; every Firestore
 * customer-doc change fanned out to 33 onSnapshot callbacks.
 *
 * After: one AuthProvider owns all listeners.  The useAuth hook becomes a thin
 * useContext reader.  All 33 callers stay unchanged because the hook signature
 * is identical.
 *
 * The legacy useAuth from /hooks/useAuth.tsx now re-exports from this module.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import * as authService from '../services/firebase/authService';
import { queryClient } from '../hooks/useCachedFirebase';
import { logger } from '../utils/logger';

// Re-export types for compatibility with existing consumers.
export type {
  User,
  LoginResult,
  RegisterResult,
} from '../services/firebase/authService';
export type { RegisterData } from '../services/firebase/authService';

interface AuthContextValue {
  user: authService.User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<authService.LoginResult>;
  register: (
    data: authService.RegisterData,
    contactEmail?: string
  ) => Promise<authService.RegisterResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFirebaseMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<authService.User | null>(null);
  const [loading, setLoading] = useState(true);

  // ────────────────────────────────────────────────────────────────────────────
  // SINGLE Firebase Auth listener — replaces the 33+ that existed before.
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirebaseConfigured) {
      let currentCallId = 0;
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        const callId = ++currentCallId;
        if (firebaseUser) {
          try {
            const u = await authService.getUserFromFirebaseAuth(firebaseUser.uid);
            if (callId !== currentCallId) return;
            if (u) {
              setUser(u);
            } else {
              logger.warn('[AuthProvider] Firebase user has no Firestore profile — signing out.');
              await authService.logout();
              setUser(null);
            }
          } catch (error) {
            if (callId !== currentCallId) return;
            console.error('[AuthProvider] Error loading user profile:', error);
            try { await authService.logout(); } catch { /* secondary error ignored */ }
            setUser(null);
          }
        } else {
          if (callId !== currentCallId) return;
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }

    // Demo / localStorage mode
    const loadUserFromStorage = () => {
      try {
        const raw = localStorage.getItem('bakery_user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
      setLoading(false);
    };
    loadUserFromStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bakery_user') loadUserFromStorage();
    };
    window.addEventListener('storage', handleStorageChange);

    const handleUserChange = () => loadUserFromStorage();
    window.addEventListener('user-changed', handleUserChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-changed', handleUserChange);
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // SINGLE Firestore customer-profile listener — replaces 33+ that existed before.
  // Picks up admin-side role/status changes live (mirrors BUG 10).
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured || !user?.id) return;
    const unsub = onSnapshot(
      doc(db, 'customers', user.id),
      (snap) => {
        if (!snap.exists()) {
          authService.logout().catch(() => {});
          queryClient.clear();
          setUser(null);
          return;
        }
        const data = snap.data();
        const newRole = data.customerType === 'admin' ? 'admin' : 'customer';
        const newStatus = data.status;
        setUser((prev) => {
          if (!prev) return prev;
          if (prev.role === newRole && prev.status === newStatus) return prev;
          return { ...prev, role: newRole, customerType: data.customerType, status: newStatus };
        });
      },
      (err) => {
        if ((err as any).code !== 'permission-denied') {
          logger.warn('[AuthProvider] Profile listener error:', err);
        }
      }
    );
    return () => unsub();
  }, [user?.id]);

  // ────────────────────────────────────────────────────────────────────────────
  // Actions — wrapped in useCallback so consumers don't re-render on every change.
  // ────────────────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await authService.login(email, password);
        if (result.success && result.user) {
          setUser(result.user);
          if (!isFirebaseConfigured) {
            localStorage.setItem('bakery_user', JSON.stringify(result.user));
          }
        }
        return result;
      } catch (error) {
        console.error('[AuthProvider] Login error:', error);
        return { success: false, message: 'An unexpected error occurred. Please try again.' };
      }
    },
    []
  );

  const register = useCallback(
    async (data: authService.RegisterData, contactEmail?: string) => {
      try {
        return await authService.register(data, contactEmail);
      } catch (error) {
        console.error('[AuthProvider] Registration error:', error);
        return { success: false, message: 'An unexpected error occurred. Please try again.' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      queryClient.clear();
      try { sessionStorage.clear(); } catch { /* unavailable */ }
      if (!isFirebaseConfigured) localStorage.removeItem('bakery_user');
      setUser(null);
    } catch (error) {
      console.error('[AuthProvider] Logout error:', error);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      return await authService.resetPassword(email);
    } catch (error) {
      console.error('[AuthProvider] Password reset error:', error);
      return { success: false, message: 'Failed to send reset email. Please try again later.' };
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // FIX T2R2-C6 (memoized context value): prevents consumer re-render storm.
  // Without useMemo, every state change re-creates the value object, forcing
  // every consumer to re-render even when nothing relevant changed.
  // ────────────────────────────────────────────────────────────────────────────
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      resetPassword,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isFirebaseMode: isFirebaseConfigured,
    }),
    [user, loading, login, register, logout, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — context-based replacement for the legacy hook.
 *
 * Throws if called outside an AuthProvider.  In production this means a
 * misconfigured app — fail loudly so the developer fixes the wrapping order.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Wrap your app root in <AuthProvider> (typically inside <AppProviders>).'
    );
  }
  return ctx;
}

/**
 * Safe variant — returns null if no provider.  Use sparingly; prefer useAuth.
 */
export function useAuthSafe(): AuthContextValue | null {
  return useContext(AuthContext);
}
