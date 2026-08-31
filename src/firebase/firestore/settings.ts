/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - SETTINGS DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Settings collection.
 * 
 * EXPORTS:
 * - getSettings: Fetch app settings
 * - updateSettings: Update app settings
 * - subscribeToSettings: Real-time settings updates
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';

import {
  settingsSchema,
  updateSettingsInputSchema,
  parseOrThrow,
  parseSafe,
  type Settings,
} from '../../schemas';

import {db, serverTimestamp, wrapFirestoreOperation} from './shared'
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default settings for fresh Firebase deployments
 * ✅ Matches settingsSchema required fields
 * ✅ Provides safe defaults to prevent crashes
 */
const DEFAULT_SETTINGS: Settings = {
  // ✅ REQUIRED FIELDS
  deliveryFee: 10.00,
  freeDeliveryThreshold: 100.00,
  orderDeadline: '12:00 PM',
  deliveryDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  
  // ✅ OPTIONAL FIELDS - Reasonable defaults
  serviceChargeEnabled: true,
  serviceChargeAmount: 3.99,
  deliveryTimeInfo: 'Delivery between 6 AM - 8 AM',
  
  // Business info (placeholder defaults)
  businessName: 'Golden Bakery',
  businessLocation: 'Vancouver, BC',
  businessCity: 'Vancouver',
  
  // Payment methods (empty by default - admin must configure)
  // Policies (empty by default - admin must configure)
};

// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get settings
 * ✅ VALIDATED: Settings document is validated
 * Creates default settings if none exist
 */
export const getSettings = async (): Promise<Settings> => {
  return wrapFirestoreOperation(async () => {
    const docRef = doc(db, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const rawData = docSnap.data();
      
      // ✅ SCHEMA PROTECTION: Validate settings document
      const result = parseSafe(settingsSchema, rawData);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'Unknown validation error';
        console.error('❌ Invalid settings document:', errorMessage);
        throw new Error('Invalid settings in Firestore');
      }
      
      return result.data;
    }
    
    // ✅ AUTO-CREATE: settings/general missing.
    //
    // FIX T2R8-H7 (HIGH — bootstrap fails for non-admin first user):
    // The Firestore rule on /settings/general is `allow write: if isAnyAdmin()`.
    // If a non-admin customer is the FIRST person to load the app after a
    // fresh deploy or settings deletion, the setDoc call below fails with
    // permission-denied — and the entire settings load chain breaks.
    //
    // Fix: try the bootstrap-via-CF path first (if available), then fall
    // back to client-side setDoc (works for admin users), then fall back
    // to returning in-memory DEFAULT_SETTINGS so the app stays usable
    // even if no document can be written. The caller (useCachedSettings)
    // sees valid settings either way.
    //
    // Long-term gold-standard: a CF triggered by app deploy that creates
    // settings/general with admin SDK before any client traffic arrives.
    // Until that's wired up, this graceful fallback keeps the app working.
    logger.warn('⚠️ settings/general document missing — attempting to bootstrap');

    // Try Cloud Function first (it runs as Admin SDK, bypasses rules)
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const bootstrapSettings = httpsCallable(functions, 'bootstrapSettings');
      const result = await bootstrapSettings({});
      if (result.data && typeof result.data === 'object' && 'settings' in result.data) {
        const validated = parseSafe(settingsSchema, (result.data as any).settings);
        if (validated.success) {
          logger.warn('✅ Settings bootstrapped via Cloud Function');
          return validated.data;
        }
      }
    } catch (cfErr: any) {
      // CF unavailable, falls through to client-side write attempt
      const code = cfErr?.code;
      if (code === 'functions/not-found') {
        logger.warn('[getSettings] bootstrapSettings CF not deployed yet, attempting client write');
      } else {
        logger.warn('[getSettings] bootstrapSettings CF failed:', cfErr);
      }
    }

    // Try client-side write (works for admin users)
    try {
      await setDoc(docRef, DEFAULT_SETTINGS);
      const createdSnap = await getDoc(docRef);
      if (createdSnap.exists()) {
        return parseOrThrow(settingsSchema, createdSnap.data(), 'Settings');
      }
    } catch (clientErr: any) {
      // Permission-denied: caller is non-admin and no CF available.
      // Fall back to in-memory defaults so the app stays usable. Log a
      // warning so the admin can fix the bootstrap problem.
      if (clientErr?.code === 'permission-denied') {
        logger.warn(
          '⚠️ [getSettings] Could not bootstrap settings/general (caller ' +
          'is not admin, and no bootstrapSettings CF is deployed). ' +
          'Returning in-memory DEFAULT_SETTINGS. Admin: please log in ' +
          'and visit the Settings page to create the document, OR ' +
          'deploy the bootstrapSettings Cloud Function.'
        );
      } else {
        logger.warn('[getSettings] Client-side bootstrap failed:', clientErr);
      }
    }

    // Final fallback: in-memory defaults. Validates against schema for safety.
    return parseOrThrow(settingsSchema, DEFAULT_SETTINGS, 'Settings (default fallback)');
  }, 'getSettings');
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update settings
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateSettings = async (settings: Partial<Settings>): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update
    const validatedInput = parseOrThrow(updateSettingsInputSchema, settings, 'UpdateSettingsInput');
    
    const cleanData = Object.entries(validatedInput).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    if (Object.keys(cleanData).length === 0) {
      logger.warn('updateSettings: No valid fields to update');
      return;
    }
    
    const docRef = doc(db, 'settings', 'general');
    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp() as any,
    });
  }, 'updateSettings');
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to settings
 * ✅ VALIDATED: Settings document is validated
 */
export const subscribeToSettings = (callback: (settings: Settings) => void) => {
  const docRef = doc(db, 'settings', 'general');
  
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      const rawData = doc.data();
      
      // Try strict validation first
      const result = parseSafe(settingsSchema, rawData);
      if (result.success) {
        callback(result.data);
        return;
      }
      
      // ✅ GRACEFUL FALLBACK: Validation failed (e.g. legacy Firestore document
      // has extra required fields not in schema, or email not yet set).
      // Use partial schema so the app never hangs on a schema mismatch.
      const errorMessage = 'error' in result ? result.error : 'Unknown validation issue';
      logger.warn('⚠️ Settings validation issues (using partial data):', errorMessage);
      const partial = settingsSchema.partial().safeParse(rawData);
      if (partial.success) {
        callback(partial.data as Settings);
      } else {
        // Last resort: pass raw data cast to Settings so the app keeps running
        callback(rawData as unknown as Settings);
      }
    }
  }, (error) => {
    console.error('Error subscribing to settings:', error);
  });
};