/**
 * Registers the service worker and announces new versions.
 *
 * After a deploy, the new version downloads in the background; this bar lets
 * the user reload when they're ready, so code never changes under them in the
 * middle of placing or approving an order. Checks for updates hourly while
 * the app stays open (installed apps can stay open for days).
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {});
      }, UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed:', error);
    },
  });

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
