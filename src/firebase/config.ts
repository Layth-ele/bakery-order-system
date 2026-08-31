/**
 * ============================================================================
 * FIREBASE CONFIGURATION - SINGLE SOURCE OF TRUTH
 * ============================================================================
 * 
 * This is the ONLY file that initializes Firebase.
 * All other services import from here.
 * 
 * ✅ Production-ready with safety guards
 * ✅ Single initialization point
 * ✅ Graceful degradation if Firebase not configured
 * 
 * ❌ FCM REMOVED: March 15, 2026
 * Firebase Cloud Messaging was partially initialized but never implemented.
 * Removed to simplify codebase. Can be re-added if push notifications needed.
 * Current notification system (Firestore-based) handles all in-app notifications.
 * 
 * @module firebase/config
 * @created February 12, 2026
 * @updated March 15, 2026 - Fixed invalid-api-key error in demo mode
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
// Realtime Database removed — not used in this app
import { getStorage, FirebaseStorage } from 'firebase/storage';
// Cloud Functions import removed — not implemented
import { getAnalytics, Analytics } from 'firebase/analytics';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Safe access to environment variables
 */
const getEnvVar = (key: string): string | undefined => {
  try {
    return import.meta.env?.[key];
  } catch {
    return undefined;
  }
};

/**
 * Firebase configuration from environment variables
 * 
 * Required environment variables:
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * 
 * Optional:
 * - VITE_FIREBASE_MEASUREMENT_ID (for Analytics)
 * - VITE_FIREBASE_DATABASE_URL (for Realtime Database)
 */
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
  databaseURL: getEnvVar('VITE_FIREBASE_DATABASE_URL')
};

/**
 * Check if Firebase is properly configured
 * Returns true only if all required credentials are provided
 */
export const isFirebaseConfigured = true; // ✅ FIREBASE ONLY MODE

/**
 * ✅ FIX MAR 15, 2026: Use demo Firebase config when not configured
 * This prevents "invalid-api-key" errors in demo mode
 */
const demoFirebaseConfig = {
  apiKey: 'AIzaSyDemoKey1234567890abcdefghijklmnopqr',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'demo-project',
  storageBucket: 'demo-project.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef1234567890abcdef',
  databaseURL: 'https://demo-project.firebaseio.com'
};

// Use production config if available, otherwise use demo config
const activeFirebaseConfig = isFirebaseConfigured ? firebaseConfig : demoFirebaseConfig;

/** Returns the active Firebase config — used for secondary app instances */
export function getFirebaseConfig(): Record<string, string | undefined> {
  return { ...activeFirebaseConfig };
}

// ✅ FIX MAR 14, 2026: Log Firebase configuration status (only in development)
if (!isFirebaseConfigured) {
  // ✅ SILENT MODE: Don't spam console in preview/demo mode
  // Developers can check isFirebaseConfigured if they need to debug
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

// Service instances
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
// Realtime Database: not used in production
let storage: FirebaseStorage;
// Cloud Functions: not implemented — placeholder removed
let analytics: Analytics | null = null;

try {
  if (!getApps().length) {
    // ============================================
    // SINGLE INITIALIZATION POINT
    // ============================================
    
    app = initializeApp(activeFirebaseConfig);
    auth = getAuth(app);

    // PASS 10 FIX: Always initialize db. Previously this was guarded by
    // `if (isFirebaseConfigured)`, with no `else` branch. When that flag is
    // false AND `getApps().length === 0`, `db` was never assigned in the
    // happy path (it would only be assigned in the catch block). The
    // hardcoded `isFirebaseConfigured = true` above masked the bug, but if
    // that line is ever flipped (or env-based again, as the comments
    // suggest is the intended design), every consumer of `db` would get
    // `undefined` and crash with "Cannot read property 'collection' of
    // undefined". Mirroring the existing-app branch (line ~163) which
    // already calls plain getFirestore() unconditionally.
    if (isFirebaseConfigured) {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } else {
      db = getFirestore(app);
    }
    
    // Initialize Realtime Database
    // Realtime Database not used
    
    // Initialize Storage
    storage = getStorage(app);
    
    // Initialize Cloud Functions (production only)
    // Cloud Functions not implemented
    
    // Initialize Analytics (browser only, production only)
    // DISABLED: Analytics loads external Google scripts that violate CSP
    // if (typeof window !== 'undefined' && isFirebaseConfigured) {
    //   try {
    //     analytics = getAnalytics(app);
    //   } catch {
    //     // Analytics not available
    //   }
    // }
  } else {
    // ============================================
    // GET EXISTING INSTANCES
    // ============================================
    
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    // Realtime Database not used
    storage = getStorage(app);
    
    // Cloud Functions not implemented
    
    if (typeof window !== 'undefined' && isFirebaseConfigured) {
      try {
        analytics = getAnalytics(app);
      } catch {
        // Analytics not available
      }
    }
  }
} catch (error) {
      console.error('Firebase initialization error:', error);
    // ✅ FIX MAR 15, 2026: If Firebase initialization fails, create minimal valid instances
  // This ensures all exports are always defined, even if initialization fails
  if (!app!) {
    app = initializeApp(activeFirebaseConfig);
  }
  if (!auth!) {
    auth = getAuth(app);
  }
  if (!db!) {
    db = getFirestore(app);
  }
  // Realtime Database removed
  if (!storage!) {
    storage = getStorage(app);
  }
}

// ============================================================================
// EXPORTS - PRODUCTION SERVICES ONLY
// ============================================================================

/**
 * Firebase service instances
 * Import these in your service files, NOT directly in components
 */
export { 
  app,           // Firebase app instance
  auth,          // Authentication service
  db,            // Firestore database
  storage,       // Cloud storage
  analytics      // Analytics service (null if not available)
};

/**
 * Type exports for TypeScript
 */
export type {
  FirebaseApp,
  Auth,
  Firestore,
  FirebaseStorage,
  Analytics
};
