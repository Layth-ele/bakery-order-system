/**
 * Public business identity — name, address, city, phone, email, logo.
 *
 * Reads publicProfile/business, which anyone (including signed-out visitors)
 * may read. The onSettingsWritten Cloud Function keeps it in sync with
 * Admin → System Settings, so changes there appear live on the login page,
 * headers and browser tab. Private settings (admin emails, payment details,
 * prices) are never exposed through it.
 */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logger } from '../utils/logger';

export interface BusinessSettings {
  businessName: string;
  /** First line of the business address. */
  businessAddress: string;
  businessCity: string;
  businessPhone: string;
  businessEmail: string;
  /** Uploaded logo URL, or '' to use the default artwork. */
  logoUrl: string;
}

const EMPTY: BusinessSettings = {
  businessName: '',
  businessAddress: '',
  businessCity: '',
  businessPhone: '',
  businessEmail: '',
  logoUrl: '',
};

/** Logo to display: the uploaded one, or the app's default artwork. */
export const DEFAULT_LOGO = '/app-icon.svg';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function toBusinessSettings(data: Record<string, unknown> | undefined): BusinessSettings {
  if (!data) return EMPTY;
  return {
    businessName: str(data.businessName),
    businessAddress: str(data.businessAddress),
    businessCity: str(data.businessCity),
    businessPhone: str(data.businessPhone),
    businessEmail: str(data.businessEmail),
    logoUrl: /^https:\/\//i.test(str(data.logoUrl)) ? str(data.logoUrl) : '',
  };
}

// One shared listener for every component that shows business details.
let cache: BusinessSettings | null = null;
const subscribers = new Set<(s: BusinessSettings) => void>();
let unsubscribe: (() => void) | null = null;

function subscribe(cb: (s: BusinessSettings) => void): () => void {
  subscribers.add(cb);
  if (!unsubscribe) {
    unsubscribe = onSnapshot(
      doc(db, 'publicProfile', 'business'),
      (snap) => {
        cache = toBusinessSettings(snap.data());
        subscribers.forEach((s) => s(cache!));
      },
      (error) => {
        logger.warn('[useBusinessSettings] public profile unavailable:', error.code);
        cache = EMPTY;
        subscribers.forEach((s) => s(EMPTY));
      }
    );
  }
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

/**
 * Empty strings mean "not set in Settings yet" — callers hide those parts
 * instead of showing placeholder text. `loading` is true until the first read.
 */
export function useBusinessSettings(): { businessSettings: BusinessSettings; loading: boolean } {
  const [state, setState] = useState<BusinessSettings | null>(cache);
  useEffect(() => subscribe(setState), []);
  return { businessSettings: state ?? EMPTY, loading: state === null };
}
