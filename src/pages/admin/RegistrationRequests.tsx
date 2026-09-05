/**
 * Customer registration requests page.
 */

import React, { useCallback } from 'react';
import {
  withAdminGuard,
  useRequireAdmin,
} from '../../guards/adminGuards';

// ✅ PHASE 2 REFACTOR: Import extracted hooks
import { useRegistrationRequestsData } from '../../hooks/admin/useRegistrationRequestsData';
import { useCustomerAccountActions } from '../../hooks/admin/useCustomerAccountActions';

// ✅ PHASE 2 REFACTOR: Import extracted view component
import { RegistrationRequestsView } from '../../components/admin/registration-requests/RegistrationRequestsView';
import { useModal } from '../../contexts/ModalContextNew';

// ============================================================================
// TYPES
// ============================================================================

interface RegistrationRequestsProps {
  user: any;
  onBack: () => void;
  isActive?: boolean;
  onLogout?: () => void;
  setCurrentPage?: (page: any) => void;
  currentPage?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const RegistrationRequestsComponent: React.FC<RegistrationRequestsProps> = ({
  user,
  onBack,
}) => {
  // ============================================================================
  // HOOKS - Data and logic layers
  // ============================================================================
  
  // Admin check
  const checkAdmin = useRequireAdmin(user);
  
  // Data layer - All data fetching and state management
  const {
    allCustomers,
    allOrders,
    pendingRegistrations,
    stats,
    customersLoading,
    ordersLoading,
    notification,
    showAddCustomer,
    isAddingAdmin,
    newCustomer,
    addModalKey,
    adminPasswordVerification,
    showAdminPassword,
    setNotification,
    setShowAddCustomer,
    setIsAddingAdmin,
    setNewCustomer,
    setAddModalKey,
    setAdminPasswordVerification,
    setShowAdminPassword,
  } = useRegistrationRequestsData();

  const { openModal } = useModal();

  // ============================================================================
  // NOTIFICATION HELPERS
  // ============================================================================
  
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  }, [setNotification]);
  
  // ============================================================================
  // ACTION HOOKS - Business logic
  // ============================================================================
  
  const {
    approveRegistration,
    rejectRegistration,
    createNewCustomer,
  } = useCustomerAccountActions({
    user,
    onSuccess: showNotification,
    onError: showNotification,
    checkAdmin,
  });
  
  // ============================================================================
  // MODAL HANDLERS - Thin wrappers
  // ============================================================================
  
  const handleAddAccount = useCallback(() => {
    setShowAddCustomer(true);
    setAddModalKey(addModalKey + 1);
  }, [setShowAddCustomer, setAddModalKey]);
  
  const handleCloseAddCustomer = useCallback(() => {
    setShowAddCustomer(false);
    setIsAddingAdmin(false);
    setNewCustomer({
      email: '',
      password: '',
      storeName: '',
      storeAddress: '',
      contactPerson: '',
      phone: '',
      customerType: 'commercial',
    });
  }, [setShowAddCustomer, setIsAddingAdmin, setNewCustomer]);
  
  const handleSaveCustomer = useCallback(async () => {
    const success = await createNewCustomer(newCustomer, isAddingAdmin, allCustomers);
    
    if (success) {
      // Reset form
      setNewCustomer({
        email: '',
        password: '',
        storeName: '',
        storeAddress: '',
        contactPerson: '',
        phone: '',
        customerType: 'commercial',
      });
      setAdminPasswordVerification('');
      setShowAddCustomer(false);
      setIsAddingAdmin(false);
    }
  }, [
    createNewCustomer,
    newCustomer,
    isAddingAdmin,
    allCustomers,
    setNewCustomer,
    setAdminPasswordVerification,
    setShowAddCustomer,
    setIsAddingAdmin,
  ]);
  
  const handleSelectCustomerType = useCallback(
    (type: 'commercial' | 'individual') => {
      setNewCustomer({
        ...newCustomer,
        customerType: type,
        storeName: '',
      });
    },
    [newCustomer, setNewCustomer]
  );
  
  const handleStartAdminCreation = useCallback(() => {
    // Close the Add Customer raw modal first so AUTH_GUARD can appear cleanly
    setShowAddCustomer(false);
    // Open the unified AuthGuardModal — requires admin to re-enter password before proceeding
    openModal('AUTH_GUARD', {
      title: 'Create New Admin Account',
      description: 'You are about to create a new administrator account. This grants full system access.',
      actionLabel: 'Verified — Continue',
      danger: false,
      onConfirm: async () => {
        // After auth, reset form and re-open in admin mode
        setNewCustomer({
          storeName: '',
          email: '',
          storeAddress: '',
          contactPerson: '',
          phone: '',
          password: '',
          customerType: 'admin',
        });
        setIsAddingAdmin(true);
        setShowAddCustomer(true);
      },
    });
  }, [openModal, setIsAddingAdmin, setNewCustomer, setShowAddCustomer]);

  
  // ============================================================================
  // RENDER - Delegate to view component
  // ============================================================================
  
  return (
    <RegistrationRequestsView
      // Data
      pendingRegistrations={pendingRegistrations}
      stats={stats}
      
      // UI state
      notification={notification}
      showAddCustomer={showAddCustomer}
      isAddingAdmin={isAddingAdmin}
      newCustomer={newCustomer}
      showAdminPassword={showAdminPassword}
      
      // Actions
      onAddAccount={handleAddAccount}
      onApprove={approveRegistration}
      onReject={rejectRegistration}
      onCloseNotification={() => setNotification('')}
      
      // Modal actions
      onCloseAddCustomer={handleCloseAddCustomer}
      onSaveCustomer={handleSaveCustomer}
      onCustomerChange={setNewCustomer}
      onTogglePasswordVisibility={() => setShowAdminPassword(!showAdminPassword)}
      onSelectCustomerType={handleSelectCustomerType}
      onStartAdminCreation={handleStartAdminCreation}
      
      // User info
      user={user}
    />
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

// Wrap component with admin guard before exporting
export const RegistrationRequests = withAdminGuard(
  RegistrationRequestsComponent
);