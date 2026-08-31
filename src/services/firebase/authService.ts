import { isFirebaseConfigured } from '../../firebase/config';
import { auth } from '../../firebase/config';
import { toDate } from '../../utils/timestampFormatting';
import { logger } from '../../utils/logger';
import { 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { 
  normalizePasswordResetError,
  normalizeLoginError,
  normalizeRegistrationError,
} from '../../utils/error/firebaseAuthErrors';
import {getCustomers, createCustomer, createUserProfile, getCustomerForAuth} from '../dataService'
import { serverTimestamp } from 'firebase/firestore';
// ✅ FIX H5 (Pass 1): createAdminNotification import removed — registration
// notification creation moved to createCustomerWithCode Cloud Function.
import { generateCustomerId } from '../idCounterService';
import type { Customer } from '../../types';

/**
 * ===================================================================
 * AUTH SERVICE - Business Logic Layer
 * ===================================================================
 * 
 * Centralized authentication business logic.
 * Handles all auth flows, validations, and user management.
 * 
 * Responsibilities:
 * - Login flow (Firebase + localStorage)
 * - Registration flow with duplicate checking
 * - Account status validation
 * - User profile creation
 * - Password reset
 * - Error normalization
 * 
 * Does NOT:
 * - Manage React state (that's the hook's job)
 * - Handle UI feedback (that's the hook's job)
 * 
 * Version: 2.0.0
 * Created: March 10, 2026
 * ===================================================================
 */

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'customer' | 'admin';
  customerType?: 'commercial' | 'individual' | 'admin';
  storeName?: string;
  contactPerson?: string;
  storeAddress?: string;
  phone?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'suspended' | 'archived';
  registeredAt?: string;
  isTemporaryPassword?: boolean;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  alertType?: 'pending' | 'rejected' | 'suspended';
  message?: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  isDuplicate?: boolean;
}

export interface RegisterData {
  storeName: string;
  contactPerson: string;
  storeAddress: string;
  email: string;
  phone: string;
  password: string;
  customerType: 'commercial' | 'individual';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// FIX BUG 8: Removed ADMIN_PASSWORD constant with 'admin123' default.
// isFirebaseConfigured is hardcoded true so the demo auth branch is dead code,
// but the constant was still compiled into the production bundle and visible
// to anyone inspecting minified output. The entire demo login branch below
// has been removed — Firebase Auth is the sole login mechanism.

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Derives user role from customerType field
 * 
 * SECURITY: This derivation must match Firestore rules:
 * - Firestore checks: customerType == 'admin'
 * - Client derives: role = 'admin' if customerType === 'admin'
 */
function deriveRoleFromCustomerType(customerType?: string): 'admin' | 'customer' {
  return customerType === 'admin' ? 'admin' : 'customer';
}

/**
 * Get server timestamp - Firebase or ISO string for localStorage
 */
function getServerTimestamp(): any {
  return isFirebaseConfigured ? serverTimestamp() : new Date().toISOString();
}

/**
 * Convert Customer to User type
 */
function customerToUser(customer: Customer, firebaseUid?: string): User {
  const role = deriveRoleFromCustomerType(customer.customerType);
  
  return {
    id: firebaseUid || customer.id,
    email: (customer.email ?? ""),
    role,
    customerType: customer.customerType || 'individual',
    storeName: customer.storeName || '',
    contactPerson: customer.contactPerson || '',
    storeAddress: customer.storeAddress || '',
    phone: customer.phone || '',
    status: (customer.status === 'archived' ? 'suspended' : customer.status) || 'pending',
    // ✅ PASS 6: toDate() can return null. Coalesce to current time fallback.
    registeredAt: customer.registeredAt
      ? (toDate(customer.registeredAt)?.toISOString() ?? new Date().toISOString())
      : new Date().toISOString(),
    isTemporaryPassword: customer.isTemporaryPassword,
  };
}

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Login user (Firebase or localStorage mode)
 * 
 * Handles:
 * - Admin login (hardcoded credentials)
 * - Firebase authentication
 * - localStorage authentication
 * - Account status validation
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    if (isFirebaseConfigured) {
      // ── PRODUCTION: Firebase Auth handles ALL login — no hardcoded bypass ─────
      // ========================================================================
      // FIREBASE MODE
      // ========================================================================
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const customer = await getCustomerForAuth(credential.user.uid);

        if (!customer) {
          await signOut(auth);
          // PASS 11: Structured event — signed in to Firebase Auth but no
          // matching Firestore profile. Indicates orphan auth account, often
          // from a deleted-customer race or partial registration.
          logger.event('auth.login.no_profile', 'warn', { uid: credential.user.uid });
          return {
            success: false,
            message: 'Account not found. Please register first.',
          };
        }

        // Check account status
        const statusCheck = validateAccountStatus(customer.status);
        if (!statusCheck.valid) {
          await signOut(auth);
          // PASS 11: Track which status states are blocking logins. Useful
          // for spotting patterns like "100 pending users tried to log in
          // today" (admin missed approval queue).
          logger.event('auth.login.blocked', 'info', {
            uid: credential.user.uid,
            status: customer.status,
            alertType: statusCheck.alertType,
          });
          return {
            success: false,
            alertType: statusCheck.alertType,
            message: statusCheck.message,
          };
        }

        // Success
        const user = customerToUser(customer, credential.user.uid);
        logger.event('auth.login.success', 'info', {
          uid: user.id,
          role: user.role,
        });
        return { success: true, user };

      } catch (error) {
        // PASS 11: Auth-layer failure (bad password, network error, disabled
        // account). Goes through logger.exception so the reporter (Sentry etc.)
        // captures the stack. Email is intentionally NOT included — PII.
        logger.exception('auth.login.failed', error as Error, {
          code: (error as { code?: string })?.code,
        });
        return {
          success: false,
          message: normalizeLoginError(error),
        };
      }
    // FIX BUG 8: Removed demo/localStorage login branch that contained:
    //   - Hardcoded ADMIN_EMAIL / ADMIN_PASSWORD (default 'admin123') compiled into bundle
    //   - Plain-text password comparison: foundUser.password === password
    // isFirebaseConfigured is true, so this branch was dead code — but it was still
    // compiled and visible in production output. Firebase Auth is the only login path.
    }  // closes if (isFirebaseConfigured)

    // ✅ PASS 6: Fallthrough — `isFirebaseConfigured` was false. The legacy
    // localStorage branch was removed in BUG 8, so there is no path forward.
    return {
      success: false,
      message: 'Firebase is not configured. Login is unavailable.',
    };
  } catch (error) {
    logger.exception('auth.login.unexpected', error as Error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register new user
 * 
 * Handles:
 * - Duplicate email/phone checking
 * - Firebase user creation
 * - Customer profile creation
 * - localStorage user creation
 */
export async function register(data: RegisterData, contactEmail: string = 'orders@example.com'): Promise<RegisterResult> {
  try {
    // Check for duplicates
    const duplicateCheck = await checkDuplicateRegistration((data.email ?? ""), (data.phone ?? ""));
    if (!duplicateCheck.valid) {
      return {
        success: false,
        message: duplicateCheck.message!,
        isDuplicate: true,
      };
    }

    if (isFirebaseConfigured) {
      // ========================================================================
      // FIREBASE MODE
      // ========================================================================
      try {
        // Normalise email to lowercase — Firebase Auth stores it lowercase,
        // so we must match exactly to avoid Firestore rule mismatches.
        const normalisedEmail = (data.email ?? '').trim().toLowerCase();

        const credential = await createUserWithEmailAndPassword(auth, normalisedEmail, data.password);
        
        // Create user profile in Firestore
        //
        // FIX T2R8-H3 (HIGH — defense-in-depth): Was passing `customerType: data.customerType`
        // straight through from the registration form. The Firestore rule
        // post-T2R7-C1 blocks `customerType: 'admin'` on customer self-create,
        // so this attack is closed at the rule layer — but defense-in-depth
        // says we should also reject it here. If a malicious user crafts a
        // `RegisterData` payload with `customerType: 'admin'` (e.g., via dev
        // tools / direct Firebase JS SDK call to this code path), we now
        // coerce it to a safe non-admin value before the Firestore write.
        // The form's only legitimate values are 'individual' and 'commercial'.
        const safeCustomerType: 'individual' | 'commercial' =
          data.customerType === 'commercial' ? 'commercial' : 'individual';

        await createUserProfile(credential.user.uid, {
          email: normalisedEmail,
          password: undefined, // Don't store password in Firestore
          storeName: (data.storeName ?? ""),
          contactPerson: (data.contactPerson ?? ""),
          storeAddress: data.storeAddress,
          phone: (data.phone ?? ""),
          customerType: safeCustomerType,
          status: 'pending',
          registeredAt: getServerTimestamp() as any,
        });

        // Generate human-readable customer code — try up to 3 times, always fall back
        let customerCode = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            customerCode = await generateCustomerId();
            break;
          } catch {
            if (attempt === 3) {
              // Guaranteed fallback: date + timestamp suffix
              const d = new Date().toISOString().slice(0, 10);
              customerCode = `CUST-${d}-${String(Date.now()).slice(-4)}`;
            }
            await new Promise(r => setTimeout(r, 300 * attempt));
          }
        }
        // Write customerCode directly to the already-created profile
        try {
          const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('../../firebase/config');
          await updateDoc(fsDoc(db!, 'customers', credential.user.uid), { customerCode });
        } catch { /* profile exists, backfill in CustomersList will retry */ }

        // Sign out after profile is fully set up — they need admin approval
        await signOut(auth);

        // ✅ FIX H5 (Pass 1): Removed client-side createAdminNotification call.
        // It always failed silently because:
        //   1. signOut() above means caller is now unauthenticated
        //   2. Even before signOut, customer status is 'pending' so the
        //      notifications/admin/items rule (`isApproved() || isAnyAdmin()`)
        //      denied the write
        // Admin notification of new registrations should be created server-side
        // by the createCustomerWithCode Cloud Function (see src/functions/src/customers.ts).
        // Migrating registration to use that Cloud Function is Pass 2 work.
        // Until then, admins discover new registrations via the Pending tab in
        // CustomersList — which queries customers where status == 'pending'.

        return {
          success: true,
          message: 'Registration successful! Your account is pending admin approval.',
        };
      } catch (error) {
        console.error('Firebase registration error:', error);
        return {
          success: false,
          message: normalizeRegistrationError(error, contactEmail),
        };
      }
    } else {
      // ========================================================================
      // ========================================================================
      try {
        await createCustomer({
          email: (data.email ?? ""),
          storeName: (data.storeName ?? ""),
          contactPerson: (data.contactPerson ?? ""),
          storeAddress: data.storeAddress,
          phone: (data.phone ?? ""),
          customerType: data.customerType,
          status: 'pending',
          registeredAt: getServerTimestamp() as any,
        });

        return {
          success: true,
          message: 'Registration successful! Your account is pending admin approval.',
        };
      } catch (error) {

        const errorMessage = error instanceof Error && (error as any).message
          ? `Registration failed: ${(error as any).message}\n\nIf this issue persists, please contact us at:\n${contactEmail}`
          : `Unable to complete registration due to an unexpected error.\n\nPlease try again or contact us at:\n${contactEmail} for assistance.`;
        
        return {
          success: false,
          message: errorMessage,
        };
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    
    const errorMessage = error instanceof Error && (error as any).message
      ? `Registration failed: ${(error as any).message}\n\nIf this issue persists, please contact us at:\n${contactEmail}`
      : `Unable to complete registration due to an unexpected error.\n\nPlease try again or contact us at:\n${contactEmail} for assistance.`;
    
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Logout user (Firebase or localStorage mode)
 *
 * FIX R8-S5-F56 (HIGH): Was just signOut + comment "localStorage cleanup is
 * handled by the hook".  Module-level caches in queryOptimizations and
 * navigationGuards survived signOut, leaking PII across users on shared devices.
 * Now clears every known cache before signing out.
 *
 * FIX T2R5-C4 (CRITICAL — privacy/PII across users on shared devices): Even
 * after R8-S5-F56, localStorage was NOT cleared.  Multiple subsystems write
 * to localStorage as a fallback or shadow copy:
 *   - bakery_orders         (bulkUpdateOrders shadow-write)
 *   - bakery_user           (demo-mode auth profile)
 *   - bakery_sent_emails    (mock email audit log)
 *   - bakery_settings       (settings fallback)
 *   - bakery_invoices       (invoice fallback)
 *   - bakery_status_change_audits  (legacy from before the Firestore migration)
 *   - bakery_order_edit_history    (edit history fallback)
 *   - bakery_voided_invoices       (voided invoice fallback)
 *   - bakery_*              (any future fallbacks)
 *
 * Even if the production app reads only from Firestore, this data accumulates
 * silently on shared devices (front-desk admin, kitchen tablet) and is
 * visible to whoever uses the device next via dev tools, browser sync, or
 * any future code path that falls back to localStorage reads.  Now: every
 * `bakery_*`-prefixed key is cleared on logout.  We do NOT call
 * `localStorage.clear()` because it would destroy unrelated keys (other apps
 * on the same origin, Firebase SDK internal storage).
 */
export async function logout(): Promise<void> {
  try {
    // Clear module-level caches that survive signOut
    try {
      const qopt = await import('../../firebase/queryOptimizations');
      qopt.clearQueryCache();
    } catch { /* module not loaded yet — no cache to clear */ }

    try {
      const guards = await import('../../routes/guards/navigationGuards');
      if (typeof (guards as any).clearAuthCache === 'function') {
        (guards as any).clearAuthCache();
      }
    } catch { /* module not loaded yet */ }

    // FIX T2R2-C4 (CRITICAL): Clear the route loader cache too. Module-level
    // SimpleCache survives signOut and would leak prior-user data to next user
    // for up to staleTime (default 5min).
    try {
      const routeUtils = await import('../../routes/loaders/utils');
      routeUtils.clearRouteCache();
    } catch { /* module not loaded yet */ }

    // Clear sessionStorage (rate-limit lockout state, etc.)
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    } catch { /* sessionStorage may be unavailable */ }

    // FIX T2R5-C4 (CRITICAL): Clear all bakery_*-prefixed localStorage keys
    // to prevent cross-user PII leakage on shared devices. Iterate carefully
    // because removing keys mid-iteration shifts indices — collect first,
    // then remove.
    try {
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('bakery_')) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* localStorage may be unavailable or in private mode */
    }

    // Sign out from Firebase
    if (isFirebaseConfigured) {
      await signOut(auth);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

/**
 * Send password reset email to the user
 * FIX C8: Previous implementation returned distinct error messages depending on
 * whether the email was unknown ("not registered"), pending, or rejected.
 * An unauthenticated attacker could enumerate which addresses are registered
 * and learn account approval/rejection status by probing this endpoint.
 * Fix: always attempt to send the reset email via Firebase and return the same
 * neutral "if this email is registered, you will receive a link" message
 * regardless of whether the account exists or what state it is in.
 * Accounts that are suspended/rejected will simply not receive a working link
 * because their Firebase Auth account is either disabled or has no active session
 * — there is no need to reveal that to the caller.
 */
export async function resetPassword(email: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!isFirebaseConfigured) {
      return {
        success: false,
        message: `Password reset is not available in demo mode.\n\nPlease contact the administrator for assistance.`,
      };
    }

    const actionCodeSettings = {
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: true,
    };

    // Always attempt — Firebase silently ignores unknown addresses and
    // returns the same success response, which is the industry-standard
    // approach for avoiding account enumeration.
    await firebaseSendPasswordResetEmail(auth, email.trim().toLowerCase(), actionCodeSettings);

    return {
      success: true,
      message: 'If this email is registered, you will receive a password reset link shortly.',
    };
  } catch (error) {
    console.error('Password reset error:', error);
    const code = (error as any).code;

    // FIX R8-S5-F55 (HIGH): Was leaking account existence via different error
    // messages.  auth/user-not-found returned the generic "Failed to send"
    // message while real success returned "If this email is registered..." —
    // distinct responses that let attackers enumerate which addresses are
    // registered.  Now treat user-not-found as success (same neutral response)
    // — Firebase silently consumes the call for unknown emails in some
    // configurations, but on configs where it throws, we swallow and return
    // the same neutral response.
    if (code === 'auth/user-not-found') {
      return {
        success: true,
        message: 'If this email is registered, you will receive a password reset link shortly.',
      };
    }
    if (code === 'auth/invalid-email') {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (code === 'auth/too-many-requests') {
      return { success: false, message: 'Too many requests. Please wait a few minutes and try again.' };
    }
    return { success: false, message: 'Failed to send reset email. Please try again later.' };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate account status
 */
function validateAccountStatus(status?: string): {
  valid: boolean;
  alertType?: 'pending' | 'rejected' | 'suspended';
  message?: string;
} {
  if (status === 'rejected') {
    return {
      valid: false,
      alertType: 'rejected',
      message: 'Your registration was rejected. Please contact support.',
    };
  }

  if (status === 'pending') {
    return {
      valid: false,
      alertType: 'pending',
      message: 'Your account is awaiting administrator approval.',
    };
  }

  if (status === 'suspended') {
    return {
      valid: false,
      alertType: 'suspended',
      message: 'This account has been suspended. Please contact support.',
    };
  }

  return { valid: true };
}

/**
 * Check for duplicate email or phone
 * FIX H6: Previous implementation used strict `c.email === email` comparison
 * (case-sensitive), but Firebase Auth normalizes all email addresses to
 * lowercase before creating accounts. A user stored as `user@example.com`
 * was not matched when someone registered as `User@Example.com`, so the
 * friendly duplicate message was skipped. Firebase Auth then threw
 * `auth/email-already-in-use` at account creation, surfacing as a confusing
 * generic error instead of "this email is already registered."
 * Fix: normalize both sides to lowercase before comparing, matching the
 * behaviour of Firebase Auth and the normalization step in register().
 */
async function checkDuplicateRegistration(email: string, phone: string): Promise<{
  valid: boolean;
  message?: string;
}> {
  const customers = await getCustomers();
  const normalizedEmail = email.trim().toLowerCase();
  const existingEmailUser = customers.find(
    c => (c.email ?? '').trim().toLowerCase() === normalizedEmail
  );
  const existingPhoneUser = customers.find(c => c.phone === phone);

  if (existingEmailUser || existingPhoneUser) {
    let message = '';
    if (existingEmailUser && existingPhoneUser) {
      message = 'Both this email address and phone number are already registered';
    } else if (existingEmailUser) {
      message = 'This email address is already registered';
    } else {
      message = 'This phone number is already registered';
    }

    return { valid: false, message };
  }

  return { valid: true };
}

// ============================================================================
// FIREBASE AUTH STATE LISTENER
// ============================================================================

/**
 * Get user from Firebase auth state
 * Used by the hook to sync with Firebase auth
 */
export async function getUserFromFirebaseAuth(firebaseUid: string): Promise<User | null> {
  try {
    const customer = await getCustomerForAuth(firebaseUid);
    if (!customer) return null;
    
    return customerToUser(customer, firebaseUid);
  } catch (error) {
    console.error('Error getting user from Firebase auth:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Additional auth service functions can be added here
 */
export const authService = {
  login,
  register,
  logout,
  resetPassword,
  getUserFromFirebaseAuth,
};
