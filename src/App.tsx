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