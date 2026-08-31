/**
 * Error Reporter Init — Pass 11
 *
 * Wires `logger.event` and `logger.exception` to a real reporter
 * (Sentry, Bugsnag, Cloud Logging, etc.). By default this is a no-op:
 * events still go through to the browser console as the logger normally
 * does, they just aren't aggregated upstream.
 *
 * To wire Sentry:
 *   1. `npm install @sentry/react`
 *   2. Set `VITE_SENTRY_DSN` in `.env.production`
 *   3. Replace the body of `setupReporter()` below with:
 *
 *      import * as Sentry from '@sentry/react';
 *      Sentry.init({
 *        dsn: import.meta.env.VITE_SENTRY_DSN,
 *        environment: import.meta.env.MODE,
 *        tracesSampleRate: 0.1,
 *      });
 *      setErrorReporter({
 *        captureException: (err, ctx) =>
 *          Sentry.captureException(err, { extra: ctx as Record<string, unknown> }),
 *        captureMessage: (msg, level, ctx) =>
 *          Sentry.captureMessage(msg, {
 *            level,
 *            extra: ctx as Record<string, unknown>,
 *          }),
 *      });
 *
 * No other code needs to change — every `logger.event(...)` and
 * `logger.exception(...)` call site already reaches the configured
 * reporter via the indirection in `utils/logger.ts`.
 */

import { setErrorReporter } from './logger';

// Read from Vite env at module-load time. Missing var = no-op reporter.
const SENTRY_DSN: string | undefined = (() => {
  try {
    return import.meta.env?.VITE_SENTRY_DSN as string | undefined;
  } catch {
    return undefined;
  }
})();

/**
 * Idempotent setup — calling more than once is a no-op after the first.
 * App.tsx invokes this on mount.
 */
let initialized = false;
export function setupReporter(): void {
  if (initialized) return;
  initialized = true;

  if (!SENTRY_DSN) {
    // No reporter configured. Logger calls fall through to the console
    // output the existing implementation already provides.
    return;
  }

  // Placeholder hook-up. Real wiring documented in the file header above.
  // Until then, write a single message to confirm the env var was picked up
  // so ops can verify deployment without seeing event noise.
  // eslint-disable-next-line no-console
  console.error('[reporter] VITE_SENTRY_DSN configured but @sentry/react is not installed.');

  setErrorReporter({
    captureException: (_err, _ctx) => {
      // No-op until real Sentry import is added (see header).
    },
    captureMessage: (_msg, _level, _ctx) => {
      // No-op until real Sentry import is added (see header).
    },
  });
}
