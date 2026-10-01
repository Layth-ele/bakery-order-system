/**
 * Install-to-home-screen state, shared app-wide.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once, early — often before
 * the header that shows the "Install app" button has mounted — so this
 * module starts listening as soon as it's imported (from main.tsx) and keeps
 * the event until the user clicks Install. Safari (iPhone/iPad) has no
 * install event; there the button shows "Add to Home Screen" instructions.
 * Chrome on Android only fires the event after the user has engaged with the
 * site for a while — until then Android users get menu instructions too.
 */
import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode =
  | 'installed' // already running as an installed app
  | 'prompt' // browser can show its own install dialog
  | 'ios' // iPhone/iPad: manual Share → "Add to Home Screen"
  | 'android' // Android, browser not ready to prompt yet: menu → "Install app"
  | 'unavailable'; // not installable here (e.g. Firefox desktop)

/** iPhone, iPod, or iPad — including iPadOS, which reports itself as a Mac. */
export function isIOSDevice(ua: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
}

export function isAndroidDevice(ua: string): boolean {
  return /android/i.test(ua);
}

export function isStandaloneDisplay(win: Pick<Window, 'matchMedia' | 'navigator'>): boolean {
  return (
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function resolveInstallMode(state: {
  standalone: boolean;
  hasPrompt: boolean;
  ios: boolean;
  android?: boolean;
}): InstallMode {
  if (state.standalone) return 'installed';
  if (state.hasPrompt) return 'prompt';
  if (state.ios) return 'ios';
  if (state.android) return 'android';
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
    android: isAndroidDevice(navigator.userAgent),
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

// ── "Install the app" card: snooze after "Not now" ────────────────────────────

const SNOOZE_KEY = 'pwa-install-card-snoozed-until';
export const INSTALL_CARD_SNOOZE_DAYS = 14;

export function isInstallCardSnoozed(now = Date.now()): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > now;
  } catch {
    return false;
  }
}

export function snoozeInstallCard(now = Date.now()): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now + INSTALL_CARD_SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    /* storage blocked — the card simply shows again next visit */
  }
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
