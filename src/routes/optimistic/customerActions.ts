/**
 * routes/optimistic/customerActions.ts
 * 
 * Optimistic update hooks for customer actions.
 * Provides instant UI feedback for customer management operations.
 * 
 * Created: March 10, 2026
 */

import { getAllCustomers } from '../../services/customersService';
import { useState, useCallback } from 'react';
import type { Customer } from '../../types';
import {
  executeOptimisticUpdate,
  optimisticAdd,
  optimisticRemove,
  optimisticUpdate,
  createStateSnapshot,
} from './utils';

// Import your actual service functions
import {
  updateCustomer as updateCustomerService,
  updateCustomerStatus,
  deleteCustomer as deleteCustomerService,
} from '../../services/customersService';
import { logger } from '../../utils/logger';


// Wrapper functions
async function addCustomerAPI(customer: Omit<Customer, 'id'>): Promise<Customer> {
  // TODO: Implement add customer in your services
  logger.warn('Add customer: Not yet implemented');
  
  // ✅ SAFE: Construct customer with explicit fields
  return {
    id: `temp-${Date.now()}`,
    email: (customer.email ?? ""),
    storeName: customer.storeName || '',
    storeAddress: customer.storeAddress || '',
    contactPerson: customer.contactPerson || '',
    phone: customer.phone || '',
    status: customer.status || 'pending',
    customerType: customer.customerType || 'individual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Optional fields
    role: customer.role,
    notes: customer.notes,
    gstNumber: customer.gstNumber,
    preferredDeliveryDay: customer.preferredDeliveryDay,
    discount: customer.discount,
    deliveryInstructions: customer.deliveryInstructions,
  };
}

async function updateCustomerAPI(id: string, updates: Partial<Customer>): Promise<Customer> {
  return updateCustomerService({ id, ...updates });
}

async function deleteCustomerAPI(customerId: string): Promise<void> {
  return deleteCustomerService(customerId);
}

async function approveCustomerAPI(customerId: string): Promise<Customer> {
  // Use updateCustomerStatus to approve
  return updateCustomerStatus(customerId, 'approved', 'Approved via optimistic update');
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMISTIC CUSTOMER STATE
// ═══════════════════════════════════════════════════════════════════════════

class OptimisticCustomerState {
  private customers: Customer[] = [];
  private listeners: Set<() => void> = new Set();
  
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify() {
    this.listeners.forEach(listener => listener());
  }
  
  getAllCustomers(): Customer[] {
    return [...this.customers];
  }
  
  setCustomers(customers: Customer[]) {
    this.customers = customers;
    this.notify();
  }
  
  optimisticAdd(customer: Customer) {
    this.customers = optimisticAdd(this.customers, customer, 'start');
    this.notify();
  }
  
  optimisticUpdate(customerId: string, updates: Partial<Customer>) {
    // ✅ PASS 6: Removed unnecessary widening cast — Customer satisfies `{ id: string }`.
    this.customers = optimisticUpdate<Customer>(this.customers, customerId, updates);
    this.notify();
  }
  
  optimisticRemove(customerId: string) {
    this.customers = optimisticRemove<Customer>(this.customers, customerId);
    this.notify();
  }
}

const customerState = new OptimisticCustomerState();

export function getCustomerState(): OptimisticCustomerState {
  return customerState;
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for optimistic customer addition
 * 
 * @example
 * const addCustomer = useOptimisticAddCustomer();
 * 
 * <button onClick={() => addCustomer.mutate(newCustomerData)}>
 *   Add Customer
 * </button>
 */
export function useOptimisticAddCustomer() {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async (customer: Omit<Customer, 'id'>) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    // ✅ SAFE: Construct customer with explicit fields
    const optimisticCustomer: Customer = {
      id: tempId,
      email: (customer.email ?? ""),
      storeName: customer.storeName || '',
      storeAddress: customer.storeAddress || '',
      contactPerson: customer.contactPerson || '',
      phone: customer.phone || '',
      status: customer.status || 'pending',
      customerType: customer.customerType || 'individual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Optional fields
      role: customer.role,
      notes: customer.notes,
      gstNumber: customer.gstNumber,
      preferredDeliveryDay: customer.preferredDeliveryDay,
      discount: customer.discount,
      deliveryInstructions: customer.deliveryInstructions,
    } as any as any;
    
    const customersSnapshot = createStateSnapshot(customerState.getAllCustomers());
    
    try {
      await executeOptimisticUpdate(customer, {
        mutationFn: addCustomerAPI,
        
        onOptimisticUpdate: () => {
          customerState.optimisticAdd(optimisticCustomer);
        },
        
        onRollback: () => {
          customerState.setCustomers(customersSnapshot);
        },
        
        onSuccess: (newCustomer) => {
          // Replace temp customer with real one
          const customers = customerState.getAllCustomers();
          const updated = customers.map(c =>
            c.id === tempId ? newCustomer : c
          );
          customerState.setCustomers(updated);
          
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['customers'],
        successMessage: 'Customer added successfully',
        errorMessage: 'Failed to add customer',
      });
      
    } catch (error) {
      // Error handled
    }
  }, []);
  
  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false, error: null });
  }, []);
  
  return {
    mutate,
    mutateAsync: mutate,
    ...state,
    reset,
  };
}

/**
 * Hook for optimistic customer update
 * 
 * @example
 * const updateCustomer = useOptimisticUpdateCustomer();
 * 
 * <button onClick={() => updateCustomer.mutate({ id: customerId, updates })}>
 *   Save Changes
 * </button>
 */
export function useOptimisticUpdateCustomer() {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async ({ id, updates }: { 
    id: string; 
    updates: Partial<Customer>;
  }) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    const customersSnapshot = createStateSnapshot(customerState.getAllCustomers());
    
    try {
      await executeOptimisticUpdate({ id, updates }, {
        mutationFn: ({ id, updates }) => updateCustomerAPI(id, updates),
        
        onOptimisticUpdate: ({ id, updates }) => {
          customerState.optimisticUpdate(id, updates);
        },
        
        onRollback: () => {
          customerState.setCustomers(customersSnapshot);
        },
        
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['customers'],
        successMessage: 'Customer updated successfully',
        errorMessage: 'Failed to update customer',
      });
      
    } catch (error) {
      // Error handled
    }
  }, []);
  
  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false, error: null });
  }, []);
  
  return {
    mutate,
    mutateAsync: mutate,
    ...state,
    reset,
  };
}

/**
 * Hook for optimistic customer deletion
 * 
 * @example
 * const deleteCustomer = useOptimisticDeleteCustomer();
 * 
 * <button onClick={() => deleteCustomer.mutate(customerId)}>
 *   Delete Customer
 * </button>
 */
export function useOptimisticDeleteCustomer() {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async (customerId: string) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    const customersSnapshot = createStateSnapshot(customerState.getAllCustomers());
    
    try {
      await executeOptimisticUpdate(customerId, {
        mutationFn: deleteCustomerAPI,
        
        onOptimisticUpdate: (id) => {
          customerState.optimisticRemove(id);
        },
        
        onRollback: () => {
          customerState.setCustomers(customersSnapshot);
        },
        
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['customers'],
        successMessage: 'Customer deleted successfully',
        errorMessage: 'Failed to delete customer',
      });
      
    } catch (error) {
      // Error handled
    }
  }, []);
  
  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false, error: null });
  }, []);
  
  return {
    mutate,
    mutateAsync: mutate,
    ...state,
    reset,
  };
}

/**
 * Hook for optimistic customer approval
 * 
 * @example
 * const approveCustomer = useOptimisticApproveCustomer();
 * 
 * <button onClick={() => approveCustomer.mutate(customerId)}>
 *   Approve Customer
 * </button>
 */
export function useOptimisticApproveCustomer() {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async (customerId: string) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    const customersSnapshot = createStateSnapshot(customerState.getAllCustomers());
    
    try {
      await executeOptimisticUpdate(customerId, {
        mutationFn: approveCustomerAPI,
        
        onOptimisticUpdate: (id) => {
          customerState.optimisticUpdate(id, { 
            status: 'approved' as const,
            approvedAt: new Date().toISOString(),
          });
        },
        
        onRollback: () => {
          customerState.setCustomers(customersSnapshot);
        },
        
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['customers'],
        successMessage: 'Customer approved successfully',
        errorMessage: 'Failed to approve customer',
      });
      
    } catch (error) {
      // Error handled
    }
  }, []);
  
  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false, error: null });
  }, []);
  
  return {
    mutate,
    mutateAsync: mutate,
    ...state,
    reset,
  };
}

/**
 * Hook that provides all customer actions
 * 
 * @example
 * const { add, update, remove, approve } = useCustomerActions();
 */
export function useCustomerActions() {
  return {
    add: useOptimisticAddCustomer(),
    update: useOptimisticUpdateCustomer(),
    remove: useOptimisticDeleteCustomer(),
    approve: useOptimisticApproveCustomer(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  (window as any).__customerActions = {
    state: customerState,
    getCustomers: () => customerState.getAllCustomers(),
  };
  
  logger.log(
    '🔧 Customer actions available at window.__customerActions'
  );
}