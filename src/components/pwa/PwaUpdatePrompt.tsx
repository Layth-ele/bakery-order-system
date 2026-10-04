/**
 * Registers the service worker and announces new versions.
 *
 * After a deploy, the new version downloads in the background; this bar lets
 * the user reload when they're ready, so code never changes under them in the
 * middle of placing or approving an order.
 *
 * Installed apps are rarely reloaded: phones freeze background timers and
 * resume the app without a page load, so an hourly timer alone meant users
 * only saw updates after logging out and back in. We therefore also check
 * whenever the app comes back to the foreground, regains focus or comes back
 * online, plus every few minutes while it's open. A dismissed bar returns the
 * next time the app is reopened, until the user reloads.
 */
import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_CHECK_MS = 5 * 60 * 1000;
/** Don't hit the server more than once per this window (focus + visibility fire together). */
const MIN_GAP_MS = 30 * 1000;

export function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheckRef = useRef(0);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setInterval(() => checkForUpdate(true), UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed:', error);
    },
  });

  /** Ask the server for a new sw.js; a found update shows the bar via onNeedRefresh. */
  function checkForUpdate(force = false) {
    const registration = registrationRef.current;
    if (!registration || !navigator.onLine) return;
    // A version already downloaded (e.g. bar dismissed earlier): show it again.
    if (registration.waiting && navigator.serviceWorker.controller) setNeedRefresh(true);
    const now = Date.now();
    if (!force && now - lastCheckRef.current < MIN_GAP_MS) return;
    lastCheckRef.current = now;
    registration.update().catch(() => {});
  }

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    const onActive = () => checkForUpdate();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onActive);
    window.addEventListener('online', onActive);
    window.addEventListener('pageshow', onActive);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onActive);
      window.removeEventListener('online', onActive);
      window.removeEventListener('pageshow', onActive);
    };
    // checkForUpdate only reads refs and a stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[1000] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-[#2c2416] px-4 py-3 text-[#e8dcc8] shadow-2xl border border-[#D4A574]/60">
        <RefreshCw className="w-5 h-5 shrink-0 text-[#D4A574]" />
        <p className="flex-1 text-sm">A new version of the app is available.</p>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-[#D4A574] px-3 py-1.5 text-sm font-semibold text-[#2c2416] hover:bg-[#e0b789]"
        >
          Reload
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg p-1 text-[#e8dcc8]/70 hover:text-[#e8dcc8]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
