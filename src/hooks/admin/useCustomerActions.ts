import { useState, useCallback } from 'react';
import { useModal } from '../../contexts/ModalContextNew';
import { useRequireAdmin } from '../../guards/adminGuards';
import { invalidateCache } from '../useCachedFirebase';
import {
  updateCustomer,
  isCustomerSuspended,
  archiveCustomer,
  unarchiveCustomer,
  deleteCustomerFromStorage,
} from '../../services/customersService';
import { copyToClipboard } from '../../utils/clipboardUtils';
import { resetPassword as sendPasswordResetLink } from '../../services/firebase/authService';
import { toast } from 'sonner';
import type { User } from '../useAuth';
import type { Customer } from '../../types/customer';

interface UseCustomerActionsProps { user: User; }

interface CustomerActions {
  copiedAddress: string | null;
  notification: string;
  notificationType: 'success' | 'error';
  clearNotification: () => void;
  handleToggleSuspend: (customer: Customer) => Promise<void>;
  handleEditCustomer: (customer: Customer) => void;
  handleDeleteCustomer: (customer: Customer) => void;
  handleResetPassword: (customer: Customer) => Promise<void>;
  handleCopyAddress: (address: string) => Promise<void>;
  handleRefresh: () => void;
}

export function useCustomerActions({ user }: UseCustomerActionsProps): CustomerActions {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [notification, setNotification] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const { openModal, closeModal } = useModal();
  const checkAdmin = useRequireAdmin(user);

  const handleToggleSuspend = useCallback(async (customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    try {
      const customerWithId = customer as User;
      const wasSuspended = isCustomerSuspended(customerWithId);
      const updated = await (wasSuspended
        ? unarchiveCustomer(customerWithId.id)
        : archiveCustomer(customerWithId.id));
      await invalidateCache.customers();
      // archiveCustomer() sets status:'archived', not 'suspended' — isCustomerSuspended()
      // treats both as suspended, so check that instead of the literal status string.
      toast.success(isCustomerSuspended(updated as User) ? '🔒 Account suspended' : '🔓 Account activated', { duration: 3000 });
    } catch (error) {
      toast.error((error as any)?.code === 'permission-denied' ? 'Permission denied' : 'Failed to update status');
    }
  }, [checkAdmin]);

  const handleEditCustomer = useCallback((customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    openModal('EDIT_CUSTOMER', {
      customer,
      onClose: closeModal,
      onCancel: closeModal,
      onSave: async (updatedCustomer: Customer) => {
        try {
          // ✅ PASS 6: id is already in updatedCustomer; the explicit `id:` field was overwritten and triggered TS2783.
          await updateCustomer(updatedCustomer);
          await invalidateCache.customers();
          closeModal();
          toast.success('✅ Customer updated successfully!', {
            description: `${updatedCustomer.storeName || updatedCustomer.contactPerson || 'Customer'} has been saved.`,
            duration: 4000,
          });
          setNotificationType('success');
          setNotification('✅ Customer updated successfully!');
          setTimeout(() => setNotification(''), 3000);
        } catch (error) {
          toast.error('Failed to update customer. Please try again.');
        }
      },
    });
  }, [checkAdmin, openModal, closeModal]);

  const handleDeleteCustomer = useCallback((customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    openModal('DELETE_CUSTOMER', {
      customer: customer,
      onClose: closeModal,
      onCancel: closeModal,
      onConfirm: async (customerToDelete: Customer, archiveOnly: boolean) => {
        try {
          if (archiveOnly) {
            await archiveCustomer(customerToDelete.id);
            toast.success('📦 Customer archived successfully');
          } else {
            await deleteCustomerFromStorage(customerToDelete.id);
            toast.success('🗑️ Customer deleted permanently');
          }
          await invalidateCache.customers();
          closeModal();
        } catch (error: any) {
          console.error('Delete customer error:', error);
          toast.error(error?.message || 'Failed to delete customer');
        }
      },
    });
  }, [checkAdmin, openModal, closeModal]);

  const handleResetPassword = useCallback(async (customer: Customer) => {
    if (!checkAdmin('customer-action')) { toast.error('Permission denied'); return; }
    if (!customer.email) { toast.error('Customer has no email address'); return; }
    if (customer.email === (import.meta.env.VITE_ADMIN_EMAIL || 'admin@bakery.com')) {
      toast.error('Cannot reset admin password through this interface'); return;
    }
    try {
      // FIX: sendPasswordResetEmail() with no actionCodeSettings uses Firebase's
      // default action URL, which doesn't route into this app's ResetPasswordPage —
      // the customer's email link just landed on the home page. resetPassword()
      // sets actionCodeSettings.url to `${origin}/reset-password` correctly.
      const result = await sendPasswordResetLink(customer.email);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(
        `📧 Password reset email sent to ${customer.email}. The customer will receive a link to set a new password.`,
        { duration: 8000 }
      );
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to send password reset email. Please try again.');
    }
  }, [checkAdmin]);

  const handleCopyAddress = useCallback(async (address: string) => {
    const success = await copyToClipboard(address);
    if (success) { setCopiedAddress(address); setTimeout(() => setCopiedAddress(null), 2000); }
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await invalidateCache.customers();
      toast.success('Customer list refreshed', { duration: 3000 });
    } catch { toast.error('Failed to refresh'); }
  }, []);

  return {
    copiedAddress, notification, notificationType,
    clearNotification: () => setNotification(''),
    handleToggleSuspend, handleEditCustomer, handleDeleteCustomer,
    handleResetPassword, handleCopyAddress, handleRefresh,
  };
}
