/**
 * useCustomerAccountActions Hook
 * 🟢 HOOK - Customer account operations
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from RegistrationRequests.tsx (1081 lines)
 * - Handles all customer account operations
 * - Manages approve/reject/create workflows
 * 
 * Responsibilities:
 * - Approve registration requests
 * - Reject registration requests
 * - Create new customer accounts
 * - Admin account creation
 * - Validation and error handling
 * 
 * Used by: /pages/admin/RegistrationRequests.tsx
 * Location: /hooks/admin/useCustomerAccountActions.ts
 */

import { useCallback } from 'react';
import { useAlert } from '../../contexts/AlertContext';
import { toast } from 'sonner';
import { updateCustomer, createCustomer } from '../../services/dataService';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { resetPassword as sendPasswordResetLink } from '../../services/firebase/authService';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getFirebaseConfig } from '../../firebase/config';
import { generateCustomerId } from '../../services/idCounterService';
import { createUserProfile } from '../../firebase/firestore/customers';
import { getServerTimestamp } from '../../utils/timestamps';
import type { PendingRegistration, NewCustomer } from './useRegistrationRequestsData';
import { logger } from '../../utils/logger';


// ============================================================================
// TYPES
// ============================================================================

export interface CustomerAccountActions {
  approveRegistration: (registration: PendingRegistration) => Promise<void>;
  rejectRegistration: (registrationId: string) => Promise<void>;
  createNewCustomer: (customer: NewCustomer, isAddingAdmin: boolean, allCustomers: any[]) => Promise<boolean>;
  validateCustomerData: (customer: NewCustomer, isAddingAdmin: boolean, allCustomers: any[]) => boolean;
}

interface UseCustomerAccountActionsOptions {
  user: any;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  checkAdmin: (action: string) => boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCustomerAccountActions({
  user,
  onSuccess,
  onError,
  checkAdmin,
}: UseCustomerAccountActionsOptions): CustomerAccountActions {
  const { showAlert } = useAlert();
  
  // ============================================================================
  // APPROVE REGISTRATION
  // ============================================================================
  
  const approveRegistration = useCallback(
    async (registration: PendingRegistration) => {
      // Admin check
      if (!checkAdmin('approve registration')) return;
      
      try {
        // Generate a human-readable customer code — retry up to 3 times
        let customerCode = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            customerCode = await generateCustomerId();
            break;
          } catch {
            if (attempt === 3) {
              // FIX T2R8-H5 (HIGH — collision-prone customer codes): Was
              // `Math.floor(Math.random() * 9000) + 1000` for the fallback
              // 4-digit suffix. Math.random() in V8 is reverse-engineerable,
              // and two admins approving customers in the same minute via
              // this fallback path can collide on the same suffix.
              // Now uses crypto.getRandomValues() with rejection sampling
              // to produce a uniform 4-digit value (1000-9999 range).
              const d = new Date().toISOString().slice(0, 10);
              const buf = new Uint32Array(1);
              const range = 9000;          // 9000 possible values
              const limit = Math.floor(0xFFFFFFFF / range) * range;
              let n: number;
              do {
                crypto.getRandomValues(buf);
                n = buf[0];
              } while (n >= limit);
              const suffix = (n % range) + 1000;
              customerCode = `CUST-${d}-${suffix}`;
            }
            await new Promise(r => setTimeout(r, 400 * attempt));
          }
        }

        // FIX BUG 1 (CRITICAL): Removed `password: tempPassword` from the Firestore write.
        // Storing a plaintext password in customers/{id} means any admin or future Firestore
        // data leak exposes customer credentials. Firebase Auth manages passwords — Firestore
        // must never hold them. Instead, mark the account approved with isTemporaryPassword:true
        // and trigger Firebase Auth's own password-reset email so the customer sets their
        // password directly through Firebase — no plaintext leaves the client or hits Firestore.
        await updateCustomer(registration.id, {
          status: 'approved',
          approvedAt: getServerTimestamp() as any,
          isTemporaryPassword: true,
          customerCode,
        } as any);

        // Send Firebase's built-in password-reset email — customer clicks the link and sets
        // their own password. This is the secure credential-handoff flow.
        let resetEmailSent = false;
        if (registration.email) {
          try {
            // FIX: raw sendPasswordResetEmail() with no actionCodeSettings used
            // Firebase's default action URL, not this app's /reset-password route.
            const result = await sendPasswordResetLink(registration.email);
            resetEmailSent = result.success;
          } catch (resetErr) {
            // Non-fatal: account is approved. Admin can trigger reset manually via customer list.
            logger.warn('[approveRegistration] Password reset email failed (non-fatal):', resetErr);
          }
        }

        showAlert({
          title: '✅ Registration Approved!',
          message: resetEmailSent
            ? `${registration.storeName || registration.contactPerson} has been approved.\n\nA password-reset email has been sent to ${registration.email}. They should click the link to set their password before logging in.`
            : `${registration.storeName || registration.contactPerson} has been approved.\n\nNote: The password-reset email could not be sent automatically. Please use "Reset Password" from the customer list to send it manually.`,
          icon: 'success',
        });
        onSuccess('✅ Registration approved!');
      } catch (error) {
        console.error('Error approving registration:', error);
        
        if ((error as any)?.code === 'permission-denied') {
          toast.error('Permission denied: Admin access required');
        } else {
          showAlert({ message: 'Failed to approve registration. Please try again.', title: 'Error' });
        }
      }
    },
    [(user.email ?? ""), checkAdmin, onSuccess, showAlert]
  );
  
  // ============================================================================
  // REJECT REGISTRATION
  // ============================================================================
  
  const rejectRegistration = useCallback(
    async (registrationId: string) => {
      // Admin check
      if (!checkAdmin('reject registration')) return;
      
      try {
        await updateCustomer(registrationId, {
          status: 'rejected',
          rejectedAt: getServerTimestamp() as any,
        });
        
        onSuccess('❌ Registration rejected');
      } catch (error) {
        console.error('Error rejecting registration:', error);
        
        if ((error as any)?.code === 'permission-denied') {
          toast.error('Permission denied: Admin access required');
        } else {
          showAlert({ message: 'Failed to reject registration. Please try again.', title: 'Error' });
        }
      }
    },
    [(user.email ?? ""), checkAdmin, onSuccess, showAlert]
  );
  
  // ============================================================================
  // VALIDATE CUSTOMER DATA
  // ============================================================================
  
  const validateCustomerData = useCallback(
    (customer: NewCustomer, isAddingAdmin: boolean, allCustomers: any[]): boolean => {
      // Store name validation (required for commercial and admin)
      if (
        (isAddingAdmin || customer.customerType === 'commercial') &&
        !customer.storeName.trim()
      ) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: `${isAddingAdmin ? 'Admin Name' : 'Business Legal Name'} is required!`,
          icon: 'warning',
        });
        return false;
      }
      
      // Contact person validation
      if (!customer.contactPerson.trim()) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Contact Person is required!',
          icon: 'warning',
        });
        return false;
      }
      
      // Email validation
      if (!customer.email.trim()) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Email is required!',
          icon: 'warning',
        });
        return false;
      }
      
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test((customer.email ?? ""))) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Please enter a valid email address!',
          icon: 'warning',
        });
        return false;
      }
      
      // Phone validation
      if (!customer.phone.trim()) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Phone number is required!',
          icon: 'warning',
        });
        return false;
      }
      
      if (!isAddingAdmin) {
        const phonePattern = /^(\+1|1)?[\s.-]?([2-9][0-8][0-9])[\s.-]?([2-9][0-9]{2})[\s.-]?([0-9]{4})$/;
        if (!phonePattern.test((customer.phone ?? ""))) {
          showAlert({
            title: 'VALIDATION ERROR',
            message: 'Please enter a valid British Columbia phone number!\n\nFormat: 604-123-4567 or 778-123-4567',
            icon: 'warning',
          });
          return false;
        }
      }
      
      // Address validation
      if (!customer.storeAddress.trim()) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Address is required!',
          icon: 'warning',
        });
        return false;
      }
      
      // Password validation
      if (!customer.password.trim()) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Password is required!',
          icon: 'warning',
        });
        return false;
      }
      
      if (customer.password.length < 6) {
        showAlert({
          title: 'VALIDATION ERROR',
          message: 'Password must be at least 6 characters long!',
          icon: 'warning',
        });
        return false;
      }
      
      // Check for duplicate email
      const emailExists = allCustomers.some(
        (c: any) => c.email.toLowerCase() === customer.email.toLowerCase()
      );
      
      if (emailExists) {
        showAlert({
          title: 'EMAIL ALREADY EXISTS',
          message: 'This email is already registered in the system!\n\nPlease use a different email address.',
          icon: 'error',
        });
        return false;
      }
      
      return true;
    },
    [showAlert]
  );
  
  // ============================================================================
  // CREATE NEW CUSTOMER
  // ============================================================================
  
  const createNewCustomer = useCallback(
    async (customer: NewCustomer, isAddingAdmin: boolean, allCustomers: any[]): Promise<boolean> => {
      // Validate data
      if (!validateCustomerData(customer, isAddingAdmin, allCustomers)) {
        return false;
      }
      
      try {
        // Step 1: Create Firebase Auth account using a SECONDARY app instance.
        // This keeps the admin signed in — createUserWithEmailAndPassword on the
        // primary app would sign out the admin and sign in the new user.
        const firebaseConfig = getFirebaseConfig();
        const secondaryAppName = `secondary-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        // Normalise email — Firebase Auth stores lowercase, Firestore must match
        const normalisedEmail = (customer.email ?? '').trim().toLowerCase();

        let uid: string;
        try {
          const credential = await createUserWithEmailAndPassword(
            secondaryAuth,
            normalisedEmail,
            customer.password ?? ''
          );
          uid = credential.user.uid;
        } finally {
          // Always clean up the secondary app — admin session is unaffected
          await signOut(secondaryAuth).catch(() => {});
          await deleteApp(secondaryApp).catch(() => {});
        }

        // Step 2: Generate customer code — retry up to 3 times
        let customerCode = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            customerCode = await generateCustomerId();
            break;
          } catch {
            if (attempt === 3) {
              // FIX T2R8-H5 (HIGH): crypto-secure fallback (see same
              // comment block at line 81). Two admins concurrently using
              // this fallback path no longer collide on a predictable
              // Math.random()-derived suffix.
              const d = new Date().toISOString().slice(0, 10);
              const buf = new Uint32Array(1);
              const range = 9000;
              const limit = Math.floor(0xFFFFFFFF / range) * range;
              let n: number;
              do {
                crypto.getRandomValues(buf);
                n = buf[0];
              } while (n >= limit);
              const suffix = (n % range) + 1000;
              customerCode = `CUST-${d}-${suffix}`;
            }
            await new Promise(r => setTimeout(r, 400 * attempt));
          }
        }

        // Step 4: Create Firestore profile using Firebase Auth UID
        // FIX T2R8-H4: explicit 'admin-on-behalf' source so the permissive
        // schema is used (allows customerType:'admin' / status:'approved'
        // for the Add Admin / Add Customer admin flows).
        await createUserProfile(uid, {
          email: normalisedEmail,
          storeName: customer.storeName || (customer.contactPerson ?? ""),
          storeAddress: customer.storeAddress,
          contactPerson: (customer.contactPerson ?? ""),
          phone: (customer.phone ?? ""),
          customerType: isAddingAdmin ? 'admin' : customer.customerType,
          status: 'approved',
          approvedAt: getServerTimestamp() as any,
          registeredAt: getServerTimestamp() as any,
          customerCode: customerCode,
          isTemporaryPassword: true, // Force password reset on first login
        } as any, 'admin-on-behalf');

        // FIX T2R2-C7 (CRITICAL — admin security): The original flow displayed
        // the plaintext password back in a success alert.  That meant:
        //   - shoulder-leak risk (admin's screen often visible to other staff)
        //   - screen-recording capture
        //   - no secure handoff path (admin couldn't easily SMS/email the
        //     password through a secure channel)
        // The mirror flow `approveRegistration` (above) already does this
        // correctly — Firebase sends a password-reset email, customer/admin
        // sets their own password, the temporary password we created above
        // is irrelevant after first reset.
        let resetEmailSent = false;
        try {
          // FIX: raw sendPasswordResetEmail() with no actionCodeSettings used
          // Firebase's default action URL, not this app's /reset-password route.
          const result = await sendPasswordResetLink(normalisedEmail);
          resetEmailSent = result.success;
        } catch (resetErr) {
          // Non-fatal: account exists. Admin can trigger reset manually.
          logger.warn('[createNewCustomer] Password reset email failed (non-fatal):', resetErr);
        }

        // Show success message — NEVER includes the password
        if (isAddingAdmin) {
          showAlert({
            title: 'ADMIN CREATED SUCCESSFULLY!',
            message: resetEmailSent
              ? `Admin "${customer.storeName}" created.\nA password-reset email has been sent to ${customer.email}. They should click the link to set their password before logging in.`
              : `Admin "${customer.storeName}" created.\nNote: Could not send password-reset email automatically. Use "Reset Password" from the customer list to send it.`,
            icon: 'success',
          });
        } else {
          const label = customer.customerType === 'commercial' ? 'Business' : 'Customer';
          const displayName = customer.storeName || customer.contactPerson;
          showAlert({
            title: 'CUSTOMER CREATED SUCCESSFULLY!',
            message: resetEmailSent
              ? `${label} "${displayName}" created.\nA password-reset email has been sent to ${customer.email}. They should click the link to set their password before logging in.`
              : `${label} "${displayName}" created.\nNote: Could not send password-reset email automatically. Use "Reset Password" from the customer list to send it.`,
            icon: 'success',
          });
        }
        
        onSuccess(`✅ ${isAddingAdmin ? 'Admin' : 'Customer'} created successfully!`);
        return true;
      } catch (error: any) {
        console.error('Error creating customer:', error);
        const code = error?.code || '';
        let msg = '❌ Failed to create customer.';
        if (code === 'auth/email-already-in-use') {
          msg = '❌ This email is already registered in Firebase Auth.\nPlease use a different email.';
        } else if (code === 'auth/invalid-email') {
          msg = '❌ Invalid email address format.';
        } else if (code === 'auth/weak-password') {
          msg = '❌ Password must be at least 6 characters.';
        } else if (code === 'permission-denied') {
          msg = '❌ Permission denied. Please make sure you have admin access.';
        } else if (error?.message) {
          msg = `❌ ${error.message}`;
        }
        showAlert({ title: 'Error Creating Account', message: msg, icon: 'error' });
        return false;
      }
    },
    [(user.email ?? ""), validateCustomerData, showAlert, onSuccess, onError]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    approveRegistration,
    rejectRegistration,
    createNewCustomer,
    validateCustomerData,
  };
}
