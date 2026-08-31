/**
 * ⚙️ SETTINGS DATA SERVICE
 * 
 * Firestore service for system settings.
 * Firestore-backed settings service.
 */

import { isFirebaseConfigured } from '../../firebase/config';
import { FirestoreDataService, getFirestoreDataService, COLLECTIONS } from './firestoreDataService';
import type { Unsubscribe } from 'firebase/firestore';
import { logger } from '../../utils/logger';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SystemSettings {
  // Business Information
  businessName?: string;
  businessLocation?: string;
  businessPhone?: string;
  businessEmail?: string;
  adminEmail?: string;
  orderEmail?: string;

  // Financial Settings
  deliveryFee?: number;
  freeDeliveryMin?: number;
  serviceChargeAmount?: number;
  serviceChargeEnabled?: boolean;
  gstRate?: number;

  // Operational Settings
  cutoffTime?: string; // "12:00"
  timezone?: string; // "America/Vancouver"
  minimumOrderAmount?: number;

  // Email Templates
  emailTemplates?: {
    orderApproval?: string;
    paymentReminder?: string;
    orderComplete?: string;
  };

  // Delivery settings (expanded)
  freeDeliveryThreshold?: number;
  orderDeadline?: string;       // e.g. "Thursday 12:00"
  deliveryDays?: string[];      // e.g. ["monday","wednesday","friday"]
  deliveryFeeDowntown?: number;
  deliveryFeeEastVan?: number;
  businessCity?: string;
  businessAddress?: string;
  businessProvince?: string;
  businessPostal?: string;
  deliveryTimeInfo?: string;

  // Email template/notification settings
  ccEmail?: string;
  orderCcEmail?: string;
  sendApprovalEmails?: boolean;

  // Payment method settings
  paymentMethod1?: string;
  paymentMethod2?: string;
  paymentAddress?: string;

  // Policy settings
  dailyOrderPolicy?: string;
  weeklyOrderPolicy?: string;
  cancellationPolicy?: string;
  lateCancellationFee?: string;
  cancellationFeePercent?: number;
  maxMonthlyCancellations?: number;

  // Legacy field aliases
  serviceFee?: number;
  taxRate?: number;
  minimumOrder?: number;
  orderCutoffDays?: number;

  // Weekly/order policies
  businessNumber?: string;

  // Metadata
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown; // allow additional fields
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_SETTINGS: SystemSettings = {
  businessName: 'Your Bakery Name',
  businessLocation: '123 Example St, City, BC V0V 0V0',
  businessPhone: '604-555-0100',
  businessEmail: 'orders@example.com',
  adminEmail: 'admin@bakery.com',
  orderEmail: 'orders@example.com',

  deliveryFee: 50,
  freeDeliveryMin: 250,
  serviceChargeAmount: 3.99,
  serviceChargeEnabled: true,
  gstRate: 0.05,

  cutoffTime: '12:00',
  timezone: 'America/Vancouver',
  minimumOrderAmount: 0,

  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// SETTINGS DOCUMENT ID
// ============================================================================

/**
 * Settings are stored as a single document with ID "system"
 * Path: /settings/system
 */
const SETTINGS_DOC_ID = 'general'; // ✅ FIXED: must match subscribeToSettings which reads settings/general

// ============================================================================
// SETTINGS DATA SERVICE
// ============================================================================

export class SettingsDataService {
  private dataService: FirestoreDataService;

  constructor(dataService?: FirestoreDataService) {
    this.dataService = (dataService || getFirestoreDataService()) as FirestoreDataService;
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Gets system settings
   * Falls back to default settings if not found
   */
  async getSettings(): Promise<SystemSettings> {
    try {
      const settings = await this.dataService.getDocument<SystemSettings>(
        COLLECTIONS.SETTINGS,
        SETTINGS_DOC_ID
      );

      if (!settings) {
        return DEFAULT_SETTINGS;
      }

      // Merge with defaults (in case new settings were added)
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.error('❌ Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Gets a specific setting value
   */
  async getSetting<K extends keyof SystemSettings>(
    key: K
  ): Promise<SystemSettings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Updates system settings (partial update)
   *
   * FIX R4-S4-F26 (CRITICAL): Was calling setDocument which performs setDoc()
   * WITHOUT the {merge: true} option — every "partial update" silently overwrote
   * the entire settings document with just the changed fields, wiping all other
   * settings (gst rate, delivery fee, business hours, contact email, etc.).
   * Switched to updateDocument which uses Firestore updateDoc() — true partial
   * merge that preserves all other fields.
   *
   * Note: updateDoc requires the document to exist. If the settings doc has
   * never been initialized, callers must use setSettings() (full overwrite)
   * first to seed it. ensureSettingsDoc handles this in the bootstrapping path.
   */
  async updateSettings(updates: Partial<SystemSettings>): Promise<void> {
    try {
      const settingsWithTimestamp = {
        ...updates,
        updatedAt: Date.now(),
      };

      await this.dataService.updateDocument(
        COLLECTIONS.SETTINGS,
        SETTINGS_DOC_ID,
        settingsWithTimestamp
      );

    } catch (error) {
      console.error('❌ Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Replaces all settings (full overwrite)
   */
  async setSettings(settings: SystemSettings): Promise<void> {
    try {
      const settingsWithTimestamp = {
        ...settings,
        updatedAt: Date.now(),
      };

      await this.dataService.setDocument(
        COLLECTIONS.SETTINGS,
        SETTINGS_DOC_ID,
        settingsWithTimestamp
      );

    } catch (error) {
      console.error('❌ Failed to set settings:', error);
      throw error;
    }
  }

  /**
   * Resets settings to defaults
   */
  async resetSettings(): Promise<void> {
    try {
      await this.setSettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('❌ Failed to reset settings:', error);
      throw error;
    }
  }

  // ==========================================================================
  // REAL-TIME LISTENER
  // ==========================================================================

  /**
   * Subscribes to settings changes
   * 
   * @param callback - Called when settings change
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = settingsService.subscribeToSettings((settings) => {
   *   logger.log('Settings updated:', settings);
   * });
   * // Later: unsubscribe();
   */
  subscribeToSettings(
    callback: (settings: SystemSettings) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.dataService.subscribeToDocument<SystemSettings>(
      COLLECTIONS.SETTINGS,
      SETTINGS_DOC_ID,
      (settings) => {
        if (settings) {
          // Merge with defaults
          callback({ ...DEFAULT_SETTINGS, ...settings });
        } else {
          // No settings found, use defaults
          callback(DEFAULT_SETTINGS);
        }
      },
      onError
    );
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initializes settings with defaults if they don't exist
   */
  async initializeSettings(): Promise<void> {
    try {
      const exists = await this.dataService.documentExists(
        COLLECTIONS.SETTINGS,
        SETTINGS_DOC_ID
      );

      if (!exists) {
        await this.setSettings(DEFAULT_SETTINGS);
      } else {
      }
    } catch (error) {
      console.error('❌ Failed to initialize settings:', error);
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let settingsServiceInstance: SettingsDataService | null = null;

/**
 * Gets or creates a singleton settings service instance
 * Returns null if Firebase not configured
 */
export function getSettingsDataService(): SettingsDataService | null {
  // ✅ Don't initialize if Firebase not configured
    if (!settingsServiceInstance) {
    try {
      settingsServiceInstance = new SettingsDataService();
    } catch (error) {
      logger.warn('⚠️ Failed to create SettingsDataService:', error);
      return null;
    }
  }
  return settingsServiceInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetSettingsDataService(): void {
  settingsServiceInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Safely gets settings data service or returns null if Firebase not configured
 */
function getServiceSafely(): SettingsDataService | null {
    try {
    return getSettingsDataService();
  } catch (error) {

    return null;
  }
}

// Export singleton instance (may be null if Firebase not configured)
export const settingsDataService = getServiceSafely();

/**
 */
export async function getSettings(): Promise<SystemSettings> {
  const service = getServiceSafely();
  
  if (service && isFirebaseConfigured) {
    try {
      return await service.getSettings();
    } catch (error) { console.error("Firebase error:", error); throw error; }
  }

  try {

    return DEFAULT_SETTINGS;
  } catch (error) { console.error("Firebase error:", error); throw error; }
}

export const updateSettings = (updates: Partial<SystemSettings>) =>
  settingsDataService?.updateSettings(updates) ?? Promise.reject(new Error('Firebase not configured'));
export const subscribeToSettings = (
  callback: (settings: SystemSettings) => void,
  onError?: (error: Error) => void
) => settingsDataService?.subscribeToSettings(callback, onError) ?? (() => {});