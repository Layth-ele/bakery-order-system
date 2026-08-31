/**
 * routes/optimistic/orderActions.ts
 * 
 * Optimistic update hooks for order actions.
 * Provides instant UI feedback for order operations.
 * 
 * Features:
 * - Approve orders instantly
 * - Reject orders instantly
 * - Cancel orders instantly
 * - Update order status instantly
 * - Automatic rollback on errors
 * - Background server sync
 * 
 * Created: March 10, 2026
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { Order } from '../../types';
import { 
  executeOptimisticUpdate, 
  optimisticMove, 
  optimisticRemove,
  optimisticUpdate,
  createStateSnapshot,
} from './utils';

// Import your actual service functions
import { 
  approveOrder as approveOrderService,
  rejectOrder as rejectOrderService,
} from '../../services/ordersService';
import { logger } from '../../utils/logger';


// PASS 12 FIX: The wrapper functions previously hardcoded the audit identity
// as `{ email: 'admin', role: 'admin' }`. That meant any consumer of these
// optimistic hooks would write `'admin'` (a literal string) into the order's
// audit trail instead of the actual admin's email — undermining the
// accountability that Pass 1 set up server-side.
//
// Fix: each wrapper now takes a `WorkflowActor` argument and the hooks
// require the caller to pass it. The hooks also reject calls where
// `actor.email` is missing or not an admin, which makes the
// "forgot to pass an actor" failure mode loud at runtime instead of silent.
//
// These optimistic hooks are not yet wired into any component (the active
// admin pages use `useOrderActions` from `hooks/orders/useOrderActions.ts`),
// so this fix is preventative — it removes a footgun before someone wires
// these up to a production button.

interface WorkflowActor {
  email: string;
  name?: string;
  role?: 'admin' | 'customer';
  storeName?: string;
}

function assertAdmin(actor: WorkflowActor | undefined, fnName: string): asserts actor is WorkflowActor {
  if (!actor || !actor.email) {
    throw new Error(
      `[optimistic/${fnName}] called without an actor — pass the admin user from useAuth() ` +
      `into the optimistic hook so the audit log records who performed the action.`
    );
  }
}

async function approveOrderAPI(orderId: string, actor: WorkflowActor) {
  assertAdmin(actor, 'approveOrderAPI');
  const { approveOrderWorkflow } = await import('../../services/orderWorkflowService');
  const { getOrder } = await import('../../services/data/ordersDataService');
  const order = await getOrder(orderId);
  if (!order) return { success: false, error: 'Order not found' };
  const result = await approveOrderWorkflow(
    orderId,
    { email: actor.email, role: actor.role ?? 'admin' },
    { skipDeliveryFeeCheck: true }
  );
  return result;
}

async function rejectOrderAPI(orderId: string, actor: WorkflowActor, _reason?: string) {
  assertAdmin(actor, 'rejectOrderAPI');
  const { rejectOrderWorkflow } = await import('../../services/orderWorkflowService');
  const result = await rejectOrderWorkflow(orderId, {
    email: actor.email,
    role: actor.role ?? 'admin',
    storeName: actor.storeName ?? '',
  });
  return result;
}

async function cancelOrderAPI(orderId: string, actor: WorkflowActor) {
  assertAdmin(actor, 'cancelOrderAPI');
  const { cancelOrderAction } = await import('../../services/orderActionService');
  const { getOrder } = await import('../../services/data/ordersDataService');
  const order = await getOrder(orderId);
  if (!order) return { success: false, error: 'Order not found' };
  return cancelOrderAction(
    order,
    { email: actor.email, name: actor.name ?? actor.email, storeName: actor.storeName ?? '' },
    'Cancelled via admin'
  );
}

async function updateOrderStatusAPI(orderId: string, status: Order['status']) {
  const { updateOrder } = await import('../../services/data/ordersDataService');
  await updateOrder(orderId, { status });
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface OptimisticMutationResult<T> {
  mutate: (variables: T) => Promise<void>;
  mutateAsync: (variables: T) => Promise<void>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple state manager for optimistic updates
 * This works with route loaders and local state
 */
class OptimisticOrderState {
  private pendingOrders: Order[] = [];
  private approvedOrders: Order[] = [];
  private rejectedOrders: Order[] = [];
  private listeners: Set<() => void> = new Set();
  
  // Subscribe to state changes
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  // Notify listeners of changes
  private notify() {
    this.listeners.forEach(listener => listener());
  }
  
  // Get orders by status
  getPending(): Order[] {
    return [...this.pendingOrders];
  }
  
  getApproved(): Order[] {
    return [...this.approvedOrders];
  }
  
  getRejected(): Order[] {
    return [...this.rejectedOrders];
  }
  
  // Set orders (from route loader or API)
  setPending(orders: Order[]) {
    this.pendingOrders = orders;
    this.notify();
  }
  
  setApproved(orders: Order[]) {
    this.approvedOrders = orders;
    this.notify();
  }
  
  setRejected(orders: Order[]) {
    this.rejectedOrders = orders;
    this.notify();
  }
  
  // Optimistic operations
  optimisticApprove(orderId: string) {
    // ✅ PASS 6: Removed `as any` casts that defeated optimisticMove's
    // generic <T extends { id: string }> inference. Order satisfies the
    // constraint, so direct passing works.
    const result = optimisticMove<Order>(
      this.pendingOrders,
      this.approvedOrders,
      orderId,
      { status: 'approved' as const }
    );

    this.pendingOrders = result.source;
    this.approvedOrders = result.target;
    this.notify();
  }

  optimisticReject(orderId: string) {
    const result = optimisticMove<Order>(
      this.pendingOrders,
      this.rejectedOrders,
      orderId,
      { status: 'rejected' as const }
    );

    this.pendingOrders = result.source;
    this.rejectedOrders = result.target;
    this.notify();
  }
  
  optimisticCancel(orderId: string) {
    this.pendingOrders = optimisticRemove(this.pendingOrders as any, orderId);
    this.approvedOrders = optimisticRemove(this.approvedOrders as any, orderId);
    this.notify();
  }
  
  optimisticUpdateStatus(orderId: string, status: Order['status']) {
    // Update in all arrays
    this.pendingOrders = optimisticUpdate(this.pendingOrders as any, orderId, { status } as any);
    this.approvedOrders = optimisticUpdate(this.approvedOrders as any, orderId, { status } as any);
    this.rejectedOrders = optimisticUpdate(this.rejectedOrders as any, orderId, { status } as any);
    this.notify();
  }
  
  // Rollback operations
  rollbackApprove(orderId: string, order: Order) {
    this.approvedOrders = optimisticRemove(this.approvedOrders as any, orderId);
    this.pendingOrders = [...this.pendingOrders, order];
    this.notify();
  }
  
  rollbackReject(orderId: string, order: Order) {
    this.rejectedOrders = optimisticRemove(this.rejectedOrders as any, orderId);
    this.pendingOrders = [...this.pendingOrders, order];
    this.notify();
  }
}

// Global state instance
const orderState = new OptimisticOrderState();

/**
 * Get the global order state (for integration with route loaders)
 */
export function getOrderState(): OptimisticOrderState {
  return orderState;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMISTIC UPDATE HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook for optimistic order approval
 * 
 * @example
 * const approve = useOptimisticApprove();
 * 
 * <button onClick={() => approve.mutate(orderId)}>
 *   Approve Order
 * </button>
 */
export function useOptimisticApprove(actor: WorkflowActor): OptimisticMutationResult<string> {
  const navigate = useNavigate();
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async (orderId: string) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    // Get the order before we remove it
    const pendingOrders = orderState.getPending();
    const order = pendingOrders.find(o => o.id === orderId);
    const orderSnapshot = order ? createStateSnapshot(order) : null;
    
    try {
      await executeOptimisticUpdate(orderId, {
        // PASS 12: actor threaded through so the audit trail records the
        // real admin who clicked, not the literal string 'admin'.
        mutationFn: (id: string) => approveOrderAPI(id, actor),
        
        // ✅ Optimistic update (instant)
        onOptimisticUpdate: (id) => {
          orderState.optimisticApprove(id);
        },
        
        // ❌ Rollback on error
        onRollback: () => {
          if (orderSnapshot) {
            orderState.rollbackApprove(orderId, orderSnapshot);
          }
        },
        
        // ✅ Success
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
          
          // Optional: Navigate to approved orders page
          if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          }
        },
        
        // ❌ Error
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        // Invalidate caches
        invalidateKeys: ['orders-pending', 'orders-approved'],
        
        successMessage: 'Order approved successfully',
        errorMessage: 'Failed to approve order',
      });
      
    } catch (error) {
      // Error handled in executeOptimisticUpdate
    }
  }, [actor]);
  
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
 * Hook for optimistic order rejection
 * 
 * @example
 * const reject = useOptimisticReject();
 * 
 * <button onClick={() => reject.mutate({ orderId, reason })}>
 *   Reject Order
 * </button>
 */
export function useOptimisticReject(actor: WorkflowActor): OptimisticMutationResult<{
  orderId: string;
  reason?: string;
}> {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async ({ orderId, reason }: { orderId: string; reason?: string }) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    const pendingOrders = orderState.getPending();
    const order = pendingOrders.find(o => o.id === orderId);
    const orderSnapshot = order ? createStateSnapshot(order) : null;
    
    try {
      await executeOptimisticUpdate({ orderId, reason }, {
        // PASS 12: actor threaded through (was hardcoded 'admin' string).
        mutationFn: ({ orderId, reason }) => rejectOrderAPI(orderId, actor, reason),
        
        // ✅ Optimistic update
        onOptimisticUpdate: ({ orderId }) => {
          orderState.optimisticReject(orderId);
        },
        
        // ❌ Rollback
        onRollback: () => {
          if (orderSnapshot) {
            orderState.rollbackReject(orderId, orderSnapshot);
          }
        },
        
        // ✅ Success
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        // ❌ Error
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['orders-pending', 'orders-rejected'],
        successMessage: 'Order rejected successfully',
        errorMessage: 'Failed to reject order',
      });
      
    } catch (error) {
      // Error handled
    }
  }, [actor]);
  
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
 * Hook for optimistic order cancellation
 * 
 * @example
 * const cancel = useOptimisticCancel();
 * 
 * <button onClick={() => cancel.mutate(orderId)}>
 *   Cancel Order
 * </button>
 */
export function useOptimisticCancel(actor: WorkflowActor): OptimisticMutationResult<string> {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async (orderId: string) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    // Create snapshot of all order lists for rollback
    const pendingSnapshot = createStateSnapshot(orderState.getPending());
    const approvedSnapshot = createStateSnapshot(orderState.getApproved());
    
    try {
      await executeOptimisticUpdate(orderId, {
        // PASS 12: actor threaded through (was hardcoded 'admin' string).
        mutationFn: (id: string) => cancelOrderAPI(id, actor),
        
        // ✅ Optimistic update
        onOptimisticUpdate: (id) => {
          orderState.optimisticCancel(id);
        },
        
        // ❌ Rollback
        onRollback: () => {
          orderState.setPending(pendingSnapshot);
          orderState.setApproved(approvedSnapshot);
        },
        
        // ✅ Success
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        // ❌ Error
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['orders'],
        successMessage: 'Order cancelled successfully',
        errorMessage: 'Failed to cancel order',
      });
      
    } catch (error) {
      // Error handled
    }
  }, [actor]);
  
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
 * Hook for optimistic status update
 * 
 * @example
 * const updateStatus = useOptimisticStatusUpdate();
 * 
 * <button onClick={() => updateStatus.mutate({ orderId, status: 'complete' })}>
 *   Mark Complete
 * </button>
 */
export function useOptimisticStatusUpdate(): OptimisticMutationResult<{
  orderId: string;
  status: Order['status'];
}> {
  const [state, setState] = useState({
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
  });
  
  const mutate = useCallback(async ({ orderId, status }: { 
    orderId: string; 
    status: Order['status'];
  }) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });
    
    // Create snapshots for rollback
    const pendingSnapshot = createStateSnapshot(orderState.getPending());
    const approvedSnapshot = createStateSnapshot(orderState.getApproved());
    const rejectedSnapshot = createStateSnapshot(orderState.getRejected());
    
    try {
      await executeOptimisticUpdate({ orderId, status }, {
        mutationFn: ({ orderId, status }) => updateOrderStatusAPI(orderId, status),
        
        // ✅ Optimistic update
        onOptimisticUpdate: ({ orderId, status }) => {
          orderState.optimisticUpdateStatus(orderId, status);
        },
        
        // ❌ Rollback
        onRollback: () => {
          orderState.setPending(pendingSnapshot);
          orderState.setApproved(approvedSnapshot);
          orderState.setRejected(rejectedSnapshot);
        },
        
        // ✅ Success
        onSuccess: () => {
          setState({ isPending: false, isSuccess: true, isError: false, error: null });
        },
        
        // ❌ Error
        onError: (error) => {
          setState({ 
            isPending: false, 
            isSuccess: false, 
            isError: true, 
            error: error as Error 
          });
        },
        
        invalidateKeys: ['orders'],
        successMessage: `Order status updated to ${status}`,
        errorMessage: 'Failed to update order status',
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

// ═══════════════════════════════════════════════════════════════════════════
// COMPOUND HOOKS (Multiple operations)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook that provides all order actions
 * 
 * @example
 * const { approve, reject, cancel, updateStatus } = useOrderActions();
 * 
 * <button onClick={() => approve.mutate(orderId)}>Approve</button>
 * <button onClick={() => reject.mutate({ orderId, reason })}>Reject</button>
 */
export function useOrderActions(actor: WorkflowActor) {
  return {
    approve: useOptimisticApprove(actor),
    reject: useOptimisticReject(actor),
    cancel: useOptimisticCancel(actor),
    updateStatus: useOptimisticStatusUpdate(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  // Expose for debugging
  (window as any).__orderActions = {
    state: orderState,
    getPending: () => orderState.getPending(),
    getApproved: () => orderState.getApproved(),
    getRejected: () => orderState.getRejected(),
  };
  
  logger.log(
    '🔧 Order actions available at window.__orderActions'
  );
}