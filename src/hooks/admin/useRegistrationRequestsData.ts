/**
 * useRegistrationRequestsData Hook
 * 🟢 HOOK - Data layer for RegistrationRequests page
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from RegistrationRequests.tsx (1081 lines)
 * - Manages all data fetching and state
 * - Uses TanStack Query for caching
 * 
 * Responsibilities:
 * - Customer and order data fetching
 * - Loading states
 * - Pending registrations filtering
 * - Account statistics calculation
 * - UI state (notifications, modals)
 * 
 * Used by: /pages/admin/RegistrationRequests.tsx
 * Location: /hooks/admin/useRegistrationRequestsData.ts
 */

import { useState, useMemo } from 'react';
import { useCachedCustomers, useCachedOrders } from '../useCachedFirebase';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingRegistration {
  id: string;
  email: string;
  storeName: string;
  storeAddress: string;
  contactPerson: string;
  phone: string;
  status: string;
  customerType: 'commercial' | 'individual';
  registeredAt?: string;
  requestedAt?: string;
}

export interface NewCustomer {
  email: string;
  password: string;
  storeName: string;
  storeAddress: string;
  contactPerson: string;
  phone: string;
  customerType: 'commercial' | 'individual' | 'admin';
}

export interface AccountStats {
  pendingCount: number;
  updateCount: number;
  rejectedCount: number;
  registrationsCount: number;
  commercialCount: number;
  individualCount: number;
  adminCount: number;
}

export interface RegistrationRequestsData {
  // Data
  allCustomers: any[];
  allOrders: any[];
  pendingRegistrations: PendingRegistration[];
  stats: AccountStats;
  
  // Loading states
  customersLoading: boolean;
  ordersLoading: boolean;
  
  // UI state
  notification: string;
  showAddCustomer: boolean;
  isAddingAdmin: boolean;
  newCustomer: NewCustomer;
  addModalKey: number;
  adminPasswordVerification: string;
  showAdminPassword: boolean;
  
  // Actions
  setNotification: (message: string) => void;
  setShowAddCustomer: (show: boolean) => void;
  setIsAddingAdmin: (isAdmin: boolean) => void;
  setNewCustomer: (customer: NewCustomer) => void;
  setAddModalKey: (key: number) => void;
  setAdminPasswordVerification: (password: string) => void;
  setShowAdminPassword: (show: boolean) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRegistrationRequestsData(): RegistrationRequestsData {
  // ============================================================================
  // DATA FETCHING - TanStack Query cache
  // ============================================================================
  
  const {
    data: allCustomers = [],
    isLoading: customersLoading,
  } = useCachedCustomers(true);
  
  const {
    data: allOrders = [],
    isLoading: ordersLoading,
  } = useCachedOrders(true);
  
  // ============================================================================
  // LOCAL STATE - UI only
  // ============================================================================
  
  const [notification, setNotification] = useState<string>('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [addModalKey, setAddModalKey] = useState(0);
  const [adminPasswordVerification, setAdminPasswordVerification] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({
    email: '',
    password: '',
    storeName: '',
    storeAddress: '',
    contactPerson: '',
    phone: '',
    customerType: 'commercial',
  });
  
  // ============================================================================
  // COMPUTED DATA - Memoized for performance
  // ============================================================================
  
  // Filter pending registrations
  const pendingRegistrations = useMemo<PendingRegistration[]>(
    () => allCustomers
      .filter((c) => c.status === 'pending')
      .map((c) => ({ ...c, storeName: c.storeName || c.email || 'Unknown' })) as PendingRegistration[],
    [allCustomers]
  );
  
  // Calculate statistics
  const stats = useMemo<AccountStats>(() => {
    const pendingOrders = allOrders.filter(
      (o: any) => o.status === 'pending' && !o.updateRequested
    ).length;
    
    const updateRequestedOrders = allOrders.filter(
      (o: any) => o.updateRequested === true
    ).length;
    
    const rejectedOrders = allOrders.filter(
      (o: any) => o.status === 'rejected'
    ).length;
    
    // Count commercial customers (pending commercial accounts)
    const commercialCount = allCustomers.filter(
      (c: any) => c.status === 'pending' && c.customerType === 'commercial'
    ).length;
    
    // Count individual customers (approved individual accounts)
    const individualCount = allCustomers.filter(
      (c: any) => c.status === 'approved' && c.customerType === 'individual'
    ).length;
    
    // Count admins (all approved admin accounts)
    const adminCount = allCustomers.filter(
      (c: any) =>
        c.status === 'approved' &&
        (c.customerType === 'admin' || c.role === 'admin')
    ).length;
    
    return {
      pendingCount: pendingOrders,
      updateCount: updateRequestedOrders,
      rejectedCount: rejectedOrders,
      registrationsCount: pendingRegistrations.length,
      commercialCount,
      individualCount,
      adminCount,
    };
  }, [allOrders, allCustomers, pendingRegistrations.length]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // Data
    allCustomers,
    allOrders,
    pendingRegistrations,
    stats,
    
    // Loading states
    customersLoading,
    ordersLoading,
    
    // UI state
    notification,
    showAddCustomer,
    isAddingAdmin,
    newCustomer,
    addModalKey,
    adminPasswordVerification,
    showAdminPassword,
    
    // Actions
    setNotification,
    setShowAddCustomer,
    setIsAddingAdmin,
    setNewCustomer,
    setAddModalKey,
    setAdminPasswordVerification,
    setShowAdminPassword,
  };
}
