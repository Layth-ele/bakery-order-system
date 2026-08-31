/**
 * RootLayout.tsx
 * Root layout component that wraps the entire application
 * 
 * Provides:
 * - Error boundary
 * - Global providers (AppProviders, notifications, etc.)
 * - AppShell
 * - Toast notifications
 * - DevTools
 */

import { Outlet } from 'react-router';
import { ErrorBoundary, OfflineNotification } from '../../components/errors';
import { AppShell } from '../../components/layout/AppShell';
import { AppProviders } from '../../contexts/AppProviders';
import { Toaster } from 'sonner';
import { Suspense, lazy } from 'react';
import { ENV } from '../../config/environment';
import { KeyboardHintTooltip } from '../../components/shared/KeyboardHintTooltip';

const DevTools = ENV.isDevelopment
  ? lazy(() => import('../../components/DevTools').then(m => ({ default: m.DevTools })))
  : null;
import { RouteLoader } from '../components/RouteLoader';
import { DocumentMeta } from '../components/DocumentMeta';

export function RootLayout(): JSX.Element | null {
  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      console.error('App Error Boundary caught error:', error, errorInfo);
    }}>
      <AppProviders>
        <DocumentMeta />
        <OfflineNotification />
        <KeyboardHintTooltip />
        
        <AppShell>
          <Suspense fallback={<RouteLoader variant="fullscreen" />}>
            <Outlet />
          </Suspense>
        </AppShell>
        
        <Toaster position="top-right" richColors />
        {DevTools && ENV.isDevelopment && (
          <Suspense fallback={null}>
            <DevTools />
          </Suspense>
        )}
      </AppProviders>
    </ErrorBoundary>
  );
}