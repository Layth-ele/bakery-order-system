/**
 * Firebase Authentication Service
 * 
 * Provides authentication functions that wrap Firebase Auth.
 * These are the core Firebase functions - for app-specific auth logic,
 * see /services/firebase/authService.ts
 * 
 * @module firebase/auth
 */

import {
  signInWithEmailAndPassword as firebaseSignIn,
  createUserWithEmailAndPassword as firebaseCreateUser,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './config';

/**
 * Sign in with email and password
 */
export const signInWithEmailAndPassword = (email: string, password: string) => {
  return firebaseSignIn(auth, email, password);
};

/**
 * Create a new user with email and password
 */
export const createUserWithEmailAndPassword = (email: string, password: string) => {
  return firebaseCreateUser(auth, email, password);
};

/**
 * Sign out the current user
 */
export const signOut = () => {
  return firebaseSignOut(auth);
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = (email: string) => {
  return firebaseSendPasswordReset(auth, email);
};

/**
 * Type exports
 */
export type { User, UserCredential };
