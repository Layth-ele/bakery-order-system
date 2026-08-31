/**
 * ===================================================================
 * AppProviders - Centralized Provider Hierarchy
 * ===================================================================
 * 
 * Single source of truth for all React Context providers.
 * Ensures correct nesting order and prevents HMR issues.
 * 
 * Provider Hierarchy (outer to inner):
 * 1. CacheProvider - TanStack Query for data caching
 * 2. AlertProvider - Global alert/confirmation dialogs
 * 3. ModalProvider - Type-safe modal management
 * 
 * Note: ErrorBoundary is handled at App.tsx level, not here.
 * 
 * Usage:
 * ```tsx
 * import { AppProviders } from '@/contexts/AppProviders';
 * 
 * <AppProviders>
 *   <App />
 * </AppProviders>
 * ```
 * 
 * Architecture:
 * - Each provider is responsible for one concern
 * - Order matters: outer providers can be used by inner ones
 * - All providers use React Context API
 * - Designed for tree-shakability and code splitting
 * 
 * Version: 2.1.0 - Light Theme Only (GlobalErrorHandler removed)
 * Last Updated: 2026-03-18
 * ===================================================================
 */

import { ReactNode, Suspense, useEffect } from 'react';
import { CacheProvider } from './CacheContext';
import { AlertProvider } from './AlertContext';
import { ModalProvider } from './ModalContextNew';
import { AuthProvider, useAuth } from './AuthContext';
import { useCleanup } from '../hooks/useCleanup';
import { ModalRoot } from '../ui/modals/ModalRoot';
import { useCachedSettings } from '../hooks/useCachedFirebase';
import { setPDFSettings } from '../utils/pdf/index';
import { DataPreloader } from '../components/shared/DataPreloader';

/**
 * GlobalSettingsSync — keeps PDF settings in sync with Firestore for ALL routes
 * (admin AND customer). Must be inside CacheProvider so useCachedSettings works.
 *
 * FIX T2R2-C2 (CRITICAL — privacy/PII): Default fallback values previously
 * hardcoded the real bakery's street address and Yahoo email. If admin had
 * not set business settings, every PDF (invoice, packing slip, customer
 * receipt) printed the actual bakery address — embedded in source control
 * AND in customer-facing PDFs.  Now uses generic placeholders matching the
 * sanitized seed-file convention.  Real values live only in Firestore.
 */
function GlobalSettingsSync(): null {
  const { data: settings } = useCachedSettings();
  useEffect(() => {
    if (!settings) return;
    setPDFSettings({
      companyName:    settings.businessName     || 'Your Bakery Name',
      companyAddress: settings.businessLocation || '123 Example St, City, BC V0V 0V0',
      companyPhone:   settings.businessPhone    || '604-555-0100',
      companyEmail:   settings.businessEmail    || 'orders@example.com',
      gstNumber:      settings.businessNumber   || '',
      companyCity:    settings.businessCity     || 'City',
    });
  }, [settings]);
  return null;
}

/**
 * Renders GlobalSettingsSync only after Firebase confirms an authenticated user.
 *
 * FIX T2R2-C1 (CRITICAL — performance): This component used to register its
 * OWN onAuthStateChanged listener — making it the 34th independent auth
 * subscription in the codebase.  Now consumes the centralized AuthContext
 * via useAuth(), which owns the only listener.
 */
function AuthenticatedSettingsSync(): JSX.Element | null {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <GlobalSettingsSync />;
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element | null {
  // ✅ Initialize timer cleanup system
  useCleanup();

  return (
    <CacheProvider>
      <AuthProvider>
        <AuthenticatedSettingsSync />
        <AlertProvider>
          <ModalProvider>
            <DataPreloader>
              {children}
            </DataPreloader>
            <Suspense fallback={null}>
              <ModalRoot />
            </Suspense>
          </ModalProvider>
        </AlertProvider>
      </AuthProvider>
    </CacheProvider>
  );
}
