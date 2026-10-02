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
import { useCachedCustomers } from '../useCachedFirebase';
import { calculateCustomerStats } from '../../services/customersService';

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

/** Counts shown on the Accounts page (same definitions as Customer Management). */
export interface AccountStats {
  pending: number;
  active: number;
  admins: number;
  rejected: number;
}

export interface RegistrationRequestsData {
  allCustomers: any[];
  pendingRegistrations: PendingRegistration[];
  rejectedRegistrations: PendingRegistration[];
  stats: AccountStats;
  customersLoading: boolean;
  showAddCustomer: boolean;
  isAddingAdmin: boolean;
  newCustomer: NewCustomer;
  showAdminPassword: boolean;
  setShowAddCustomer: (show: boolean) => void;
  setIsAddingAdmin: (isAdmin: boolean) => void;
  setNewCustomer: (customer: NewCustomer) => void;
  setShowAdminPassword: (show: boolean) => void;
}

export const EMPTY_NEW_CUSTOMER: NewCustomer = {
  email: '',
  password: '',
  storeName: '',
  storeAddress: '',
  contactPerson: '',
  phone: '',
  customerType: 'commercial',
};

const asRequest = (c: any): PendingRegistration => ({ ...c, storeName: c.storeName || c.email || 'Unknown' });

export function useRegistrationRequestsData(): RegistrationRequestsData {
  const { data: allCustomers = [], isLoading: customersLoading } = useCachedCustomers(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>(EMPTY_NEW_CUSTOMER);

  const pendingRegistrations = useMemo(
    () => allCustomers.filter((c: any) => c.status === 'pending').map(asRequest),
    [allCustomers]
  );
  const rejectedRegistrations = useMemo(
    () => allCustomers.filter((c: any) => c.status === 'rejected').map(asRequest),
    [allCustomers]
  );
  const stats = useMemo<AccountStats>(() => {
    const s = calculateCustomerStats(allCustomers as any);
    return { pending: s.pending, active: s.active, admins: s.admin, rejected: s.rejected };
  }, [allCustomers]);

  return {
    allCustomers,
    pendingRegistrations,
    rejectedRegistrations,
    stats,
    customersLoading,
    showAddCustomer,
    isAddingAdmin,
    newCustomer,
    showAdminPassword,
    setShowAddCustomer,
    setIsAddingAdmin,
    setNewCustomer,
    setShowAdminPassword,
  };
}
