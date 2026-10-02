/**
 * Customer Management actions (Admin → Customers).
 *
 * Status changes run on the server so the Firebase sign-in always matches the
 * account status (functions/src/accountAdmin.ts, customers.ts):
 *   Suspend / Reactivate → setCustomerSuspended
 *   Archive / Delete      → deleteCustomerAccount
 * Edit writes only the profile fields the form shows.
 */
import { useState, useCallback } from 'react';
import { useModal } from '../../contexts/ModalContextNew';
import { useAlert } from '../../contexts/AlertContext';
import { useRequireAdmin } from '../../guards/adminGuards';
import { invalidateCache } from '../useCachedFirebase';
import { updateCustomer, deleteCustomer, isCustomerSuspended } from '../../services/customersService';
import { callableErrorMessage, setCustomerSuspendedViaCloudFunction } from '../../services/firebase/cloudFunctions';
import { copyToClipboard } from '../../utils/clipboardUtils';
import { resetPassword as sendPasswordResetLink } from '../../services/firebase/authService';
import { toast } from 'sonner';
import type { User } from '../useAuth';
import type { Customer } from '../../types/customer';

interface UseCustomerActionsProps { user: User; }

interface CustomerActions {
  copiedAddress: string | null;
  handleToggleSuspend: (customer: Customer) => void;
  handleEditCustomer: (customer: Customer) => void;
  handleDeleteCustomer: (customer: Customer) => void;
  handleResetPassword: (customer: Customer) => Promise<void>;
  handleCopyAddress: (address: string) => Promise<void>;
  handleRefresh: () => void;
}

const nameOf = (c: Customer) => c.storeName || c.contactPerson || c.email || 'this account';

export function useCustomerActions({ user }: UseCustomerActionsProps): CustomerActions {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const { openModal, closeModal } = useModal();
  const { showAlert } = useAlert();
  const checkAdmin = useRequireAdmin(user);

  const handleToggleSuspend = useCallback((customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    const suspend = !isCustomerSuspended(customer as User);
    showAlert({
      title: suspend ? 'Suspend Account' : 'Reactivate Account',
      message: suspend
        ? `Suspend ${nameOf(customer)}?\n\nThey are signed out and can't sign in or order until you reactivate the account. Orders and history are kept.`
        : `Reactivate ${nameOf(customer)}?\n\nThey can sign in and order again.`,
      icon: suspend ? 'warning' : 'info',
      confirmText: suspend ? 'SUSPEND' : 'REACTIVATE',
      cancelText: 'CANCEL',
      onConfirm: async () => {
        try {
          await setCustomerSuspendedViaCloudFunction(customer.id, suspend);
          await invalidateCache.customers();
          toast.success(suspend ? `🔒 ${nameOf(customer)} suspended` : `🔓 ${nameOf(customer)} reactivated`);
        } catch (error) {
          toast.error(callableErrorMessage(error, suspend ? 'suspend the account' : 'reactivate the account'));
        }
      },
    });
  }, [checkAdmin, showAlert]);

  const handleEditCustomer = useCallback((customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    openModal('EDIT_CUSTOMER', {
      customer,
      onClose: closeModal,
      onCancel: closeModal,
      onSave: async (edited: Customer) => {
        try {
          // Only the fields the form edits — status, type and code have their
          // own actions. Blank name/address fields are left unchanged.
          const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
          await updateCustomer({
            id: customer.id,
            ...(text(edited.storeName) ? { storeName: text(edited.storeName) } : {}),
            ...(text(edited.contactPerson) ? { contactPerson: text(edited.contactPerson) } : {}),
            ...(text(edited.storeAddress) ? { storeAddress: text(edited.storeAddress) } : {}),
            phone: text(edited.phone),
          } as any);
          await invalidateCache.customers();
          closeModal();
          toast.success('Customer updated', { description: `${nameOf(edited)} has been saved.` });
        } catch (error) {
          toast.error((error as any)?.code === 'permission-denied'
            ? "You don't have permission to edit this account."
            : 'Failed to save the changes. Please try again.');
        }
      },
    });
  }, [checkAdmin, openModal, closeModal]);

  const handleDeleteCustomer = useCallback((customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    openModal('DELETE_CUSTOMER', {
      customer,
      onClose: closeModal,
      onCancel: closeModal,
      onConfirm: async (target: Customer, archiveOnly: boolean) => {
        try {
          const mode = await deleteCustomer(target.id, !archiveOnly);
          toast.success(mode === 'deleted'
            ? `🗑️ ${nameOf(target)} deleted permanently`
            : `📦 ${nameOf(target)} archived — sign-in disabled, orders kept`);
          closeModal();
        } catch (error: any) {
          toast.error(error?.message || 'Failed to delete the account', { duration: 8000 });
        }
      },
    });
  }, [checkAdmin, openModal, closeModal]);

  const handleResetPassword = useCallback(async (customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    if (!customer.email) { toast.error('This account has no email address'); return; }
    try {
      const result = await sendPasswordResetLink(customer.email);
      if (!result.success) { toast.error(result.message); return; }
      toast.success(`📧 Password reset email sent to ${customer.email}`, {
        description: 'The link lets them choose a new password.',
        duration: 8000,
      });
    } catch {
      toast.error('Failed to send the password reset email. Please try again.');
    }
  }, [checkAdmin]);

  const handleCopyAddress = useCallback(async (address: string) => {
    if (await copyToClipboard(address)) {
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await invalidateCache.customers();
      toast.success('Customer list refreshed', { duration: 3000 });
    } catch { toast.error('Failed to refresh'); }
  }, []);

  return {
    copiedAddress,
    handleToggleSuspend, handleEditCustomer, handleDeleteCustomer,
    handleResetPassword, handleCopyAddress, handleRefresh,
  };
}
