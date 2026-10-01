/**
 * Install-to-home-screen state, shared app-wide.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once, early — often before
 * the header that shows the "Install app" button has mounted — so this
 * module starts listening as soon as it's imported (from main.tsx) and keeps
 * the event until the user clicks Install. Safari (iPhone/iPad) has no
 * install event; there the button shows "Add to Home Screen" instructions.
 */
import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode =
  | 'installed' // already running as an installed app
  | 'prompt' // browser can show its own install dialog
  | 'ios' // Safari on iPhone/iPad: manual "Add to Home Screen"
  | 'unavailable'; // not installable here (e.g. Firefox desktop, in-app browsers)

/** iPhone, iPod, or iPad — including iPadOS, which reports itself as a Mac. */
export function isIOSDevice(ua: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
}

export function isStandaloneDisplay(win: Pick<Window, 'matchMedia' | 'navigator'>): boolean {
  return (
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function resolveInstallMode(state: { standalone: boolean; hasPrompt: boolean; ios: boolean }): InstallMode {
  if (state.standalone) return 'installed';
  if (state.hasPrompt) return 'prompt';
  if (state.ios) return 'ios';
  return 'unavailable';
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function currentMode(): InstallMode {
  if (typeof window === 'undefined') return 'unavailable';
  return resolveInstallMode({
    standalone: installedThisSession || isStandaloneDisplay(window),
    hasPrompt: deferred !== null,
    ios: isIOSDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedThisSession = true;
    emit();
  });
}

/** Show the browser's install dialog. Resolves true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // the event can only be used once
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    currentMode,
    () => 'unavailable'
  );
}
