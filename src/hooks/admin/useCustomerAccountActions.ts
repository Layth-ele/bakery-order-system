/**
 * Customer Accounts actions (Admin → Accounts): registration requests and
 * "Add account". All run in Cloud Functions (functions/src/accountAdmin.ts),
 * which keep the profile, the Firebase sign-in and the audit log in step:
 *
 *   approveRegistration → approveCustomer  (customer emailed "approved")
 *   rejectRegistration  → rejectCustomer   (sign-in disabled)
 *   createNewCustomer   → adminCreateAccount
 *
 * The customer keeps the password they registered with; an admin-created
 * account uses the temporary password the admin chose (the customer can
 * change it under My Profile, or use "Forgot password").
 */
import { useCallback } from 'react';
import { useAlert } from '../../contexts/AlertContext';
import { toast } from 'sonner';
import { describeEmailResult } from '../../services/emailService';
import { invalidateCache } from '../useCachedFirebase';
import {
  adminCreateAccountViaCloudFunction,
  approveCustomerViaCloudFunction,
  callableErrorMessage,
  rejectCustomerViaCloudFunction,
} from '../../services/firebase/cloudFunctions';
import type { PendingRegistration, NewCustomer } from './useRegistrationRequestsData';

export interface CustomerAccountActions {
  approveRegistration: (registration: PendingRegistration) => Promise<void>;
  rejectRegistration: (registration: PendingRegistration) => void;
  createNewCustomer: (customer: NewCustomer, isAddingAdmin: boolean) => Promise<boolean>;
}

interface UseCustomerAccountActionsOptions {
  checkAdmin: (action: string) => boolean;
}

const nameOf = (r: { storeName?: string; contactPerson?: string; email?: string }) =>
  r.storeName || r.contactPerson || r.email || 'this account';

export function useCustomerAccountActions({ checkAdmin }: UseCustomerAccountActionsOptions): CustomerAccountActions {
  const { showAlert } = useAlert();

  const approveRegistration = useCallback(async (registration: PendingRegistration) => {
    if (!checkAdmin('approve registration')) return;
    try {
      const { email } = await approveCustomerViaCloudFunction(registration.id);
      await invalidateCache.customers();
      toast.success(`✅ ${nameOf(registration)} approved`, {
        description: email.state === 'sent'
          ? `They were emailed at ${email.to} and can sign in now.`
          : `They can sign in now. ${describeEmailResult(email)}`,
        duration: 6000,
      });
    } catch (error) {
      toast.error(callableErrorMessage(error, 'approve this registration'));
    }
  }, [checkAdmin]);

  const rejectRegistration = useCallback((registration: PendingRegistration) => {
    if (!checkAdmin('reject registration')) return;
    showAlert({
      title: 'Reject Registration',
      message: `Reject the registration from ${nameOf(registration)} (${registration.email})?\n\nThey won't be able to sign in. You can still approve it later from "Rejected requests".`,
      icon: 'warning',
      confirmText: 'REJECT',
      cancelText: 'CANCEL',
      onConfirm: async () => {
        try {
          await rejectCustomerViaCloudFunction(registration.id);
          await invalidateCache.customers();
          toast.success(`${nameOf(registration)} rejected`);
        } catch (error) {
          toast.error(callableErrorMessage(error, 'reject this registration'));
        }
      },
    });
  }, [checkAdmin, showAlert]);

  const createNewCustomer = useCallback(async (customer: NewCustomer, isAddingAdmin: boolean): Promise<boolean> => {
    if (!checkAdmin('create account')) return false;
    try {
      const result = await adminCreateAccountViaCloudFunction({
        email: customer.email,
        password: customer.password,
        storeName: customer.storeName,
        contactPerson: customer.contactPerson,
        phone: customer.phone,
        storeAddress: customer.storeAddress,
        customerType: isAddingAdmin ? 'admin' : (customer.customerType as 'commercial' | 'individual'),
      });
      await invalidateCache.customers();
      showAlert({
        title: isAddingAdmin ? 'Admin Account Created' : 'Account Created',
        message:
          `${nameOf(customer)} can sign in now with:\n\n` +
          `Email: ${customer.email.trim().toLowerCase()}\n` +
          `Password: the temporary password you set` +
          (result.customerCode ? `\n\nCustomer ID: ${result.customerCode}` : '') +
          `\n\nShare the password privately (not by email). They can change it under My Profile.`,
        icon: 'success',
      });
      return true;
    } catch (error) {
      showAlert({ title: 'Account Not Created', message: callableErrorMessage(error, 'create the account'), icon: 'error' });
      return false;
    }
  }, [checkAdmin, showAlert]);

  return { approveRegistration, rejectRegistration, createNewCustomer };
}
