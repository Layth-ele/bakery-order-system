/**
 * Phone push notifications (Firebase Cloud Messaging, web push).
 *
 * The device's push token is saved on the signed-in account
 * (customers/{uid}.fcmTokens — the Firestore rules let owners update only that
 * field among a few profile fields). The server sends a push for every new
 * in-app notification (functions/src/pushNotifications.ts); the service
 * worker shows it and sets the app-icon badge (public/push-sw.js).
 *
 * iPhone: only works in the home-screen app (Share → Add to Home Screen,
 * iOS 16.4+). Android/desktop: works in the browser too.
 */
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { app, db } from '../firebase/config';

/** Public "Web Push certificate" key of this Firebase project (safe to ship). */
export const VAPID_PUBLIC_KEY =
  'BCZn-06Op5Dqo4hWurQ3xQjxG2BvCsp4rRlqFHaC6ozoMIYmxIXZqVc99PKsrbOnsxhFsKYA3n_CfSpz3dE74iU';

export type PushState = 'unsupported' | 'needs-home-screen' | 'off' | 'on' | 'blocked';

const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

/** What this device can do right now (no prompts). */
export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (isIos() && !isStandalone()) return 'needs-home-screen';
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported';
  try {
    const { isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return 'unsupported';
  } catch {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' ? 'on' : 'off';
}

async function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 8000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** Get this device's token and save it on the account. Returns false if it failed. */
async function saveToken(uid: string): Promise<boolean> {
  const registration = await serviceWorker();
  if (!registration || !app || !db) return false;
  const { getMessaging, getToken } = await import('firebase/messaging');
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;
  await updateDoc(doc(db, 'customers', uid), { fcmTokens: arrayUnion(token), updatedAt: serverTimestamp() });
  return true;
}

/** Ask permission (must run from a tap) and register this device. */
export async function enablePush(uid: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  return (await saveToken(uid)) ? 'on' : 'off';
}

/**
 * Keep the saved token current (tokens can rotate). Silent: only runs when
 * permission was already granted.
 */
export async function refreshPushToken(uid: string): Promise<void> {
  try {
    if ((await getPushState()) === 'on') await saveToken(uid);
  } catch {
    /* best effort */
  }
}

/** Show the unread count on the app icon (where supported). */
export function setAppIconBadge(count: number): void {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch {
    /* unsupported */
  }
}
