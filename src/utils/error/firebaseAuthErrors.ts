/**
 * Firebase Authentication Error Normalization
 * 
 * Converts raw Firebase error codes into user-friendly messages
 * that are safe to display in production.
 * 
 * ✅ Benefits:
 * - Consistent error messages across the app
 * - User-friendly language
 * - No internal error code leakage
 * - Centralized error handling
 */

import { logger } from '../logger';
// ============================================================================
// TYPES
// ============================================================================

export interface FirebaseAuthError {
  code?: string;
  message?: string;
}

// ============================================================================
// ERROR NORMALIZATION
// ============================================================================

/**
 * Normalizes Firebase authentication errors into user-friendly messages
 * 
 * @param error - The error object from Firebase Auth
 * @returns A user-friendly error message string
 * 
 * @example
 * ```ts
 * try {
 *   await signInWithEmailAndPassword(auth, email, password);
 * } catch (error) {
 *   const message = normalizeAuthError(error);
 *   setErrorMessage(message);
 * }
 * ```
 */
export function normalizeAuthError(error: unknown): string {
  if (!(error as any)?.code) {
    return "Something went wrong. Please try again.";
  }

  const errorCode = (error as any).code as string;

  switch (errorCode) {
    // ========================================================================
    // EMAIL/PASSWORD ERRORS
    // ========================================================================
    case "auth/email-already-in-use":
      return "This email is already registered.";
    
    case "auth/invalid-email":
      return "The email address format is invalid.";
    
    case "auth/user-not-found":
      return "No account found with this email.";
    
    case "auth/wrong-password":
      return "Incorrect email or password.";
    
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    
    case "auth/invalid-credential":
      return "Invalid email or password.";

    // ========================================================================
    // ACCOUNT STATUS ERRORS
    // ========================================================================
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";

    // ========================================================================
    // NETWORK & RATE LIMITING ERRORS
    // ========================================================================
    case "auth/network-request-failed":
      return "Network connection failed. Please check your internet connection and try again.";
    
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later or reset your password.";

    // ========================================================================
    // OPERATION ERRORS
    // ========================================================================
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled. Please contact support.";
    
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by your browser. Please allow popups and try again.";

    // ========================================================================
    // TOKEN & SESSION ERRORS
    // ========================================================================
    case "auth/expired-action-code":
      return "This link has expired. Please request a new one.";
    
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used.";
    
    case "auth/user-token-expired":
      return "Your session has expired. Please sign in again.";
    
    case "auth/requires-recent-login":
      return "This action requires recent authentication. Please sign in again.";

    // ========================================================================
    // MULTI-FACTOR AUTHENTICATION ERRORS
    // ========================================================================
    case "auth/multi-factor-auth-required":
      return "Additional authentication is required.";
    
    case "auth/invalid-verification-code":
      return "Invalid verification code. Please try again.";
    
    case "auth/invalid-verification-id":
      return "Invalid verification ID. Please restart the process.";

    // ========================================================================
    // GENERIC/UNKNOWN ERRORS
    // ========================================================================
    case "auth/internal-error":
      return "An internal error occurred. Please try again.";
    
    default:
      // Log unknown error codes for monitoring
      logger.warn('Unknown Firebase auth error code:', errorCode);
      return "Authentication failed. Please try again.";
  }
}

// ============================================================================
// SPECIFIC ERROR HANDLERS
// ============================================================================

/**
 * Normalizes login-specific errors
 * Provides more context for login failures
 */
export function normalizeLoginError(error: unknown): string {
  if (!(error as any)?.code) {
    return "Login failed. Please try again.";
  }

  const errorCode = (error as any).code as string;

  // Login-specific handling
  if (errorCode === "auth/user-not-found" || errorCode === "auth/wrong-password") {
    return "Invalid email or password.";
  }

  if (errorCode === "auth/too-many-requests") {
    return "Too many failed login attempts. Please try again later or use 'Forgot Password' to reset.";
  }

  // Fall back to general normalization
  return normalizeAuthError(error);
}

/**
 * Normalizes registration-specific errors
 * Provides more detailed guidance for registration failures
 */
export function normalizeRegistrationError(
  error: unknown,
  contactEmail: string = 'orders@example.com'
): string {
  if (!(error as any)?.code) {
    return "Registration failed. Please try again.";
  }

  const errorCode = (error as any).code as string;
  const contact = `contact us at:\n${contactEmail}`;

  if (errorCode === "auth/email-already-in-use") {
    return `This email address is already registered.\n\nPlease use the LOGIN tab or ${contact}`;
  }

  if (errorCode === "auth/weak-password") {
    return `The password is too weak.\n\nPlease use a stronger password (at least 6 characters) or ${contact}`;
  }

  if (errorCode === "auth/invalid-email") {
    return `The email address format is invalid.\n\nPlease check your email and try again, or ${contact}`;
  }

  if (errorCode === "auth/network-request-failed") {
    return `Network connection failed.\n\nPlease check your internet connection and try again, or ${contact}`;
  }

  const baseMessage = normalizeAuthError(error);
  return `${baseMessage}\n\nIf this issue persists, please ${contact}`;
}

/**
 * Normalizes password reset errors
 */
export function normalizePasswordResetError(error: unknown): string {
  if (!(error as any)?.code) {
    return "Failed to send password reset email. Please try again.";
  }

  const errorCode = (error as any).code as string;

  if (errorCode === "auth/user-not-found") {
    return "No account found with this email address.";
  }

  if (errorCode === "auth/invalid-email") {
    return "The email address format is invalid.";
  }

  // Fall back to general normalization
  return normalizeAuthError(error);
}
