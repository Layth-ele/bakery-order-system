/**
 * App.tsx - Main Application Entry Point
 * 
 * ✅ MARCH 7, 2026: Refactored to Route-Driven Architecture
 * ✅ MARCH 11, 2026: Mobile UI optimizations for order cards
 * ✅ MARCH 16, 2026: Timestamp validation fix applied
 * ✅ MAR 17, 2026: Add notification migration
 * 
 * BEFORE: State-based navigation with conditional rendering
 * AFTER: React Router Data Mode with proper URL-based routing
 * 
 * BENEFITS:
 * - URL-based navigation (shareable links, browser history)
 * - Centralized route configuration in /routes/index.ts
 * - Type-safe routing with loaders and guards
 * - Lazy-loaded route components
 * - Proper 404 handling
 * - SEO-friendly URLs
 * 
 * ARCHITECTURE:
 * - Uses RouterProvider from react-router
 * - Routes defined in /routes/index.ts
 * - Layouts in /routes/layouts/
 * - Guards for authentication and authorization
 * - Suspense fallback for lazy-loaded routes
 * 
 * MIGRATION NOTES:
 * - Removed conditional rendering logic
 * - Removed state-based page management
 * - Auth logic moved to route loaders/guards
 * - Navigation providers moved to layout components
 */

import { Suspense, useEffect } from 'react';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { RouteLoader } from './routes/components/RouteLoader';
import { fixLocalStorageData } from './utils/fixLocalStorageData';
import { runNotificationMigrations } from './utils/notification-migration';
import { useButtonKeyboardBinding } from './hooks/useButtonKeyboardBinding';
// PASS 11: Wire the structured-event reporter (Sentry / Bugsnag / etc.)
// at startup. Default is a no-op; see src/utils/errorReporterInit.ts for
// the 5-line change that activates Sentry once the DSN is configured.
import { setupReporter } from './utils/errorReporterInit';
import { logger } from './utils/logger';

// Set up error reporter immediately at module load — before any React tree
// renders — so any logger.event/exception calls during initial app boot are
// captured. The function is idempotent so the useEffect below is harmless.
setupReporter();

function App() {
  // ✅ Activate global button keyboard binding
  useButtonKeyboardBinding({
    enabled: true,
    preventDefault: true,
    ignoreFocusedInput: false,
  });

  // ✅ Run cleanup on mount (only once)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        fixLocalStorageData();
 // Run notification data migrations
        runNotificationMigrations();
      } catch (error) {
        // PASS 11: Boot-time cleanup failure is rare but worth structured
        // capture — useful for spotting regressions in localStorage shape
        // changes between releases.
        logger.exception('app.boot.cleanup_failed', error as Error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);
  
  return (
    <ErrorBoundary
      componentName="App"
      showDetails={import.meta.env.DEV}
      allowRetry={true}
    >
      <Suspense fallback={<RouteLoader variant="fullscreen" message="Loading application..." />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;