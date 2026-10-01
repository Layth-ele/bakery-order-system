/**
 * Recover when a code file from an older version is gone.
 *
 * After a deploy, someone who kept the app open (common for installed apps)
 * is still running the old version. Lazily-loaded files that weren't cached
 * — e.g. the admin-only Excel/PDF/chart code — no longer exist on the server,
 * so opening that feature fails with "Failed to fetch dynamically imported
 * module". Vite reports this as `vite:preloadError`; we switch to the new
 * version (activating a waiting service worker if there is one) and reload
 * once. A per-session flag prevents reload loops.
 */
const RELOADED_FLAG = 'pwa-stale-chunk-reload';

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOADED_FLAG) === '1';
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOADED_FLAG, '1');
  } catch {
    /* storage blocked — the reload still happens once per event */
  }
}

async function activateNewVersionAndReload(): Promise<void> {
  markReloaded();
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
  } catch {
    /* fall through to a plain reload */
  }
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (alreadyReloaded()) return; // let the error surface normally
    event.preventDefault();
    void activateNewVersionAndReload();
  });
}
