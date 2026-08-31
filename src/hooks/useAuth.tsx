/**
 * useAuth.tsx — backward-compat shim.
 *
 * FIX T2R1-F1 / T2R2-C1 (CRITICAL): Original hook self-managed Firebase Auth +
 * Firestore listeners + DOM events.  Each of 33 callers spun up its own copy.
 * Now delegates to the AuthContext which owns one set of listeners for the
 * whole app.
 *
 * The signature is identical, so all 33 callers stay unchanged.  This file
 * exists only so existing imports of '@/hooks/useAuth' still resolve.
 *
 * FIX T2R1-F14 (HIGH — closed by architectural change): The original audit
 * flagged this hook's `useEffect` as having a misleading `[]` dep array
 * (it read `isFirebaseConfigured` from module scope; the deps suggested
 * isolation but the effect actually depended on a constant).  After the
 * F1/C1 fix above, the entire effect was removed — the AuthProvider owns
 * the single auth-state subscription now, and this file is a one-line
 * re-export.  No misleading deps remain.
 */

export {
  AuthProvider,
  useAuth,
  useAuthSafe,
} from '../contexts/AuthContext';

export type {
  User,
  LoginResult,
  RegisterResult,
  RegisterData,
} from '../contexts/AuthContext';
