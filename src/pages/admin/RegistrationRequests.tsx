/**
 * Customer Accounts (Admin → Accounts): registration requests and
 * "Add account". Approve / reject / create run in Cloud Functions
 * (useCustomerAccountActions → functions/src/accountAdmin.ts).
 */
import React, { useCallback } from 'react';
import { withAdminGuard, useRequireAdmin } from '../../guards/adminGuards';
import { useRegistrationRequestsData, EMPTY_NEW_CUSTOMER } from '../../hooks/admin/useRegistrationRequestsData';
import { useCustomerAccountActions } from '../../hooks/admin/useCustomerAccountActions';
import { RegistrationRequestsView } from '../../components/admin/registration-requests/RegistrationRequestsView';
import { useModal } from '../../contexts/ModalContextNew';

interface RegistrationRequestsProps {
  user: any;
  onBack: () => void;
  isActive?: boolean;
  onLogout?: () => void;
  setCurrentPage?: (page: any) => void;
  currentPage?: string;
}

const RegistrationRequestsComponent: React.FC<RegistrationRequestsProps> = ({ user }) => {
  const checkAdmin = useRequireAdmin(user);
  const {
    pendingRegistrations,
    rejectedRegistrations,
    stats,
    showAddCustomer,
    isAddingAdmin,
    newCustomer,
    showAdminPassword,
    setShowAddCustomer,
    setIsAddingAdmin,
    setNewCustomer,
    setShowAdminPassword,
  } = useRegistrationRequestsData();
  const { openModal } = useModal();
  const { approveRegistration, rejectRegistration, createNewCustomer } = useCustomerAccountActions({ checkAdmin });

  const resetForm = useCallback(() => {
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setIsAddingAdmin(false);
    setShowAdminPassword(false);
  }, [setNewCustomer, setIsAddingAdmin, setShowAdminPassword]);

  const handleCloseAddCustomer = useCallback(() => {
    setShowAddCustomer(false);
    resetForm();
  }, [setShowAddCustomer, resetForm]);

  const handleSaveCustomer = useCallback(async () => {
    if (await createNewCustomer(newCustomer, isAddingAdmin)) {
      setShowAddCustomer(false);
      resetForm();
    }
  }, [createNewCustomer, newCustomer, isAddingAdmin, setShowAddCustomer, resetForm]);

  const handleSelectCustomerType = useCallback(
    (type: 'commercial' | 'individual') => setNewCustomer({ ...newCustomer, customerType: type, storeName: '' }),
    [newCustomer, setNewCustomer]
  );

  // Creating an admin requires re-entering the admin's own password first.
  const handleStartAdminCreation = useCallback(() => {
    setShowAddCustomer(false);
    openModal('AUTH_GUARD', {
      title: 'Create New Admin Account',
      description: 'You are about to create a new administrator account. This grants full system access.',
      actionLabel: 'Verified — Continue',
      danger: false,
      onConfirm: async () => {
        setNewCustomer({ ...EMPTY_NEW_CUSTOMER, customerType: 'admin' });
        setIsAddingAdmin(true);
        setShowAddCustomer(true);
      },
    });
  }, [openModal, setIsAddingAdmin, setNewCustomer, setShowAddCustomer]);

  return (
    <RegistrationRequestsView
      pendingRegistrations={pendingRegistrations}
      rejectedRegistrations={rejectedRegistrations}
      stats={stats}
      showAddCustomer={showAddCustomer}
      isAddingAdmin={isAddingAdmin}
      newCustomer={newCustomer}
      showAdminPassword={showAdminPassword}
      onAddAccount={() => { resetForm(); setShowAddCustomer(true); }}
      onApprove={approveRegistration}
      onReject={rejectRegistration}
      onCloseAddCustomer={handleCloseAddCustomer}
      onSaveCustomer={handleSaveCustomer}
      onCustomerChange={setNewCustomer}
      onTogglePasswordVisibility={() => setShowAdminPassword(!showAdminPassword)}
      onSelectCustomerType={handleSelectCustomerType}
      onStartAdminCreation={handleStartAdminCreation}
      user={user}
    />
  );
};

export const RegistrationRequests = withAdminGuard(RegistrationRequestsComponent);
