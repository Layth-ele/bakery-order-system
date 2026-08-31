/**
 * useBusinessSettings Hook
 *
 * Reads business contact info from the TanStack Query settings cache.
 * ✅ LIVE: When admin updates settings and saves, this hook auto-refreshes
 *    because useCachedSettings is invalidated by useSettingsActions → invalidateAll().
 *
 * Used by: HomePage footer, hero section, etc.
 */

import { useCachedSettings } from './useCachedFirebase';

export interface BusinessSettings {
  businessName: string;
  businessLocation: string;
  businessPhone: string;
  businessEmail: string;
  businessCity: string;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'Your Bakery Name',
  businessLocation: '123 Example St, City, BC V0V 0V0',
  businessPhone: '(555) 555-0100',
  businessEmail: 'orders@example.com',
  businessCity: 'City',
};

export function useBusinessSettings() {
  const { data: settings, isLoading: loading, error } = useCachedSettings();

  const businessSettings: BusinessSettings = {
    businessName:
      settings?.businessName || DEFAULT_SETTINGS.businessName,
    businessLocation:
      settings?.businessLocation || DEFAULT_SETTINGS.businessLocation,
    businessPhone:
      settings?.businessPhone || DEFAULT_SETTINGS.businessPhone,
    businessEmail:
      settings?.businessEmail || DEFAULT_SETTINGS.businessEmail,
    businessCity:
      settings?.businessCity || DEFAULT_SETTINGS.businessCity,
  };

  return {
    businessSettings,
    loading,
    error: error ?? null,
  };
}
