/**
 * 🎯 Notification Actions Hook
 * 
 * ✅ MAR 18, 2026: REACT 18 FIX - Wrapped modal opening in startTransition
 * - Prevents "component suspended during synchronous input" errors
 * - Modal opening with async data loading now uses React 18 transitions
 * 
 * ✅ FEB 16, 2026: STEP 4 - Smart routing for PAYMENT_REMINDER
 * - Conditionally opens SUBMIT_PAYMENT or PAYMENT_IN_REVIEW based on payment proof
 * - No type duplication - single PAYMENT_REMINDER type with dynamic behavior
 * 
 * ✅ FEB 11, 2026: MOVED TO /notifications/hooks/
 * - Complete consolidation: all notification files in /notifications/
 * - Updated imports to reflect new subdirectory structure
 * 
 * ✅ FEB 11, 2026: SINGLE RESPONSIBILITY - Extracts all action logic from bell components
 * 
 * PROBLEM SOLVED:
 * - Bell components had too many responsibilities (UI, state, routing, business logic)
 * - Hard to test, hard to refactor, easy to break
 * - Logic duplicated across Admin and Customer bells
 * 
 * SOLUTION:
 * - Centralized hook that provides all notification action handlers
 * - Bell components become thin orchestrators (just UI + basic wiring)
 * - Business logic moved to testable, reusable hook
 * 
 * Benefits:
 * - Single Responsibility Principle enforced
 * - Easy to test (mock hook, test logic separately)
 * - Easy to refactor (change logic in one place)
 * - Reusable across multiple components
 * - Clear separation: hooks = logic, components = UI
 * 
 * Created: February 11, 2026
 * Updated: March 18, 2026 - React 18 fix
 * Updated: February 16, 2026 - Step 4: PAYMENT_REMINDER smart routing
 */

import { useCallback, useMemo, startTransition, useRef } from 'react';
import { useModal } from '@/contexts/ModalContextNew';
import type { ModalType } from '@/types/modals'; // ✅ Using alias import
import type { Product, Category } from '@/types'; // ✅ PASS 5: explicit imports for noImplicitAny
import { NotificationItem, normalizeNotificationType } from '@/types/notification-contract';
import { getModalForNotification } from '../types/notification-modal-mapping';
import { resolveModalProps } from '@/utils/notification-modal-resolver';
import { getServerTimestamp } from '@/utils/timestamps'; // ✅ TIMESTAMP FIX
import { toast } from 'sonner'; // Add toast import
import { getOrders, getOrder } from '@/services/data/ordersDataService';
import { useNavigate } from 'react-router';
import { logger } from '../../utils/logger';
 // ✅ MAR 17: Use data service

/**
 * Configuration for notification actions hook
 */
interface UseNotificationActionsConfig {
  /** User object for context */
  user?: any;
  
  /** Mark notification as read */
  markAsRead: (id: string) => Promise<void>;
  
  /** Optional payment confirmation handler (admin only) */
  onConfirmPayment?: (notification: NotificationItem) => void;
  
  /** Optional orders map for button config (admin only) */
  ordersMap?: Map<string, any>;
}

/**
 * Return type for useNotificationActions hook
 */
interface NotificationActions {
  /** Opens the appropriate modal for a notification */
  openNotificationModal: (notification: NotificationItem, modalTypeOverride?: string | ModalType) => Promise<void>;
  
  /** Handles notification row click */
  handleNotificationClick: (notification: NotificationItem) => void;
  
  /** Handles action button click */
  handleActionClick: (action: any, notification: NotificationItem) => void;
  
  /** Gets button config for an action (admin only) */
  getActionButtonConfig: (action: any, orderId?: string) => { buttonLabel: string; buttonStyle: string };
  
  /** Formats timestamp for display */
  formatTimestamp: (timestamp: string) => string;
}

/**
 * ✅ SINGLE RESPONSIBILITY: All notification action logic in one place
 * 
 * Extracts business logic from bell components:
 * - Modal routing (which modal to open for each notification type)
 * - Data hydration (loading order/invoice data before opening modal)
 * - Action mapping (action type → modal type)
 * - Button configuration (dynamic labels/styles based on order status)
 * - Error handling (fallback modals)
 * 
 * @param config - Configuration object
 * @returns Action handlers and utilities
 * 
 * @example
 * // In AdminNotificationBell:
 * const actions = useNotificationActions({
 *   user,
 *   markAsRead,
 *   onConfirmPayment,
 *   ordersMap,
 * });
 * 
 * // Use handlers:
 * <button onClick={() => actions.handleNotificationClick(notification)} />
 */
export function useNotificationActions({
  user,
  markAsRead,
  onConfirmPayment,
  ordersMap,
}: UseNotificationActionsConfig): NotificationActions {
  const { openModal, closeModal, closeAllModals, modalStack } = useModal();
  const navigate = useNavigate();
  // ✅ Guard against re-entrant calls (prevents infinite loop with Firestore listeners)
  const isProcessingRef = useRef(false);
  
  /**
   * ✅ BUSINESS LOGIC: Create app context for modal resolver
   */
  const appContext = useMemo((): any => ({
    user,
    loadOrders: async () => {
      const orders = await getOrders();
      return orders;
    },
    loadProducts: (): Product[] => [],  // Firebase only — products loaded via useCachedProducts()
    loadCategories: (): Category[] => [],  // Firebase only — categories loaded via useCachedCategories()
    loadCustomers: async () => {
      try {
        // Only load customers if user is admin (to avoid permission errors)
        if (user?.customerType === 'admin') {
          const { getCustomers } = await import('@/services/dataService');
          return await getCustomers();
        }
        return []; // Return empty array for non-admin users
      } catch (error) {
        logger.warn('⚠️ [NotificationActions] Failed to load customers:', error);
        return []; // Return empty array on error
      }
    },
    openModal, // ✅ Pass openModal for stub callbacks
    closeModal, // ✅ Pass closeModal for stub callbacks  
    onConfirmPayment: onConfirmPayment ? (order: any) => {
      const notif = {
        id: '',
        type: 'PAYMENT_CONFIRMED_ADMIN',
        title: '',
        message: '',
        createdAt: getServerTimestamp() as any, // ✅ TIMESTAMP FIX
        read: false,
        orderId: order.id || ""
      };
      onConfirmPayment(notif as any);
    } : undefined
  }), [user, onConfirmPayment, openModal, closeModal]);
  
  /**
   * ✅ BUSINESS LOGIC: Action type to modal type mapping
   */
  const actionTypeToModalType = useMemo(() => ({
    'VIEW_ORDER': 'ADMIN_ORDER_VIEW',
    'REVIEW_PAYMENT': 'ADMIN_ORDER_VIEW', // Use ADMIN_ORDER_VIEW for payment review
    'REVIEW_UPDATE': 'ADMIN_ORDER_VIEW',
    'VIEW_INVOICE': 'COMPLETED_ORDER_INVOICE',
    'VIEW_INVOICE_DETAILS': 'COMPLETED_ORDER_INVOICE',
    'VIEW_HISTORY': 'ADMIN_ORDER_VIEW',
  }), []);
  
    /**
   * Open whatever a notification points to: a page (e.g. registrations) or
   * a modal whose data is loaded by the modal resolver.
   */
  const openNotificationModal = useCallback(async (
    notification: NotificationItem,
    modalTypeOverride?: string
  ) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      await markAsRead(notification.id);

      if (modalStack.length > 0) {
        closeAllModals();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const mapping = getModalForNotification(notification.type);

      // Page-based notifications (e.g. a new registration → Registrations).
      if (!modalTypeOverride && mapping.route) {
        navigate(mapping.route);
        return;
      }

      let modalType: string = modalTypeOverride || mapping.modalType;

      // Payment reminder: pay now, or show the payment already submitted.
      // Loads only this order — customers may read their own order, not list all.
      if (!modalTypeOverride && normalizeNotificationType(notification.type) === 'PAYMENT_REMINDER' && notification.orderId) {
        const order = await getOrder(notification.orderId).catch(() => null);
        modalType = order?.paymentSubmitted ? 'PAYMENT_IN_REVIEW' : 'SUBMIT_PAYMENT';
      }

      const resolvedProps = await resolveModalProps(modalType, notification, appContext);
      const finalModalType = resolvedProps._modalRedirect || modalType;
      delete resolvedProps._modalRedirect;

      startTransition(() => {
        openModal(finalModalType as ModalType, resolvedProps as any);
      });
    } catch (error) {
      console.error('❌ [notificationActions] Error opening notification:', error);
      openModal('NOTIFICATION_DETAILS' as ModalType, {
        notification,
        error: error instanceof Error ? error.message : 'Failed to load details',
        onClose: () => {}
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [markAsRead, appContext, openModal, closeAllModals, modalStack, navigate]);
  
  /**
   * ✅ SIMPLE HANDLER: Notification row click
   */
  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    openNotificationModal(notification);
  }, [openNotificationModal]);
  
  /**
   * ✅ BUSINESS LOGIC: Action button click
   * 
   * Maps action type to modal type and opens modal
   */
  const handleActionClick = useCallback((action: { type?: string; modalType?: string } | null | undefined, notification: NotificationItem) => {
    const lookupKey = action?.type as keyof typeof actionTypeToModalType | undefined;
    const modalType =
      action?.modalType ||
      (lookupKey ? actionTypeToModalType[lookupKey] : undefined) ||
      getModalForNotification(notification.type)?.modalType ||
      'NOTIFICATION_DETAILS';

    openNotificationModal(notification, modalType);
  }, [actionTypeToModalType, openNotificationModal]);
  
  /**
   * ✅ BUSINESS LOGIC: Get button config based on order status
   * 
   * Dynamically determines:
   * - Button label (e.g., "View Order" → "Review Payment" → "View Invoice")
   * - Button style (colors based on order state)
   * 
   * Status model: pending → approved → in_process → completed/rejected/cancelled
   */
  const getActionButtonConfig = useCallback((action: any, orderId?: string) => {
    let buttonLabel = action.label;
    let buttonStyle = 'bg-[#D4A574] text-white hover:bg-[#D4A574]';
    
    if (!orderId || !ordersMap) {
      return { buttonLabel, buttonStyle };
    }
    
    // O(1) lookup from cached Map
    const order = ordersMap.get(orderId);
    
    if (!order) {
      return { buttonLabel, buttonStyle };
    }
    
    // Use correct status values from the app
    const status = order.status; // pending, approved, in_process, completed, rejected, cancelled
    const paymentReceived = order.paymentReceived || false;
    const paymentSubmitted = order.paymentSubmitted || false;
    
    const isCompleted = status === 'completed';
    const isRejected = status === 'rejected';
    const isCancelled = status === 'cancelled';
    
    if (action.type === 'REVIEW_PAYMENT') {
      if (isCompleted || paymentReceived) {
        buttonLabel = 'View Invoice';
        buttonStyle = 'bg-green-600 text-white hover:bg-green-700';
      } else if (paymentSubmitted) {
        buttonLabel = 'Review Payment';
        buttonStyle = 'bg-orange-500 text-white hover:bg-orange-600';
      } else {
        buttonLabel = 'View Order';
        buttonStyle = 'bg-[#D4A574] text-white hover:bg-[#D4A574]';
      }
    } else if (action.type === 'VIEW_ORDER') {
      if (isRejected) {
        buttonLabel = 'View Rejected';
        buttonStyle = 'bg-red-500 text-white hover:bg-red-600';
      } else if (isCancelled) {
        buttonLabel = 'View Cancelled';
        buttonStyle = 'bg-gray-500 text-white hover:bg-gray-600';
      } else if (isCompleted || paymentReceived) {
        buttonLabel = 'View Invoice';
        buttonStyle = 'bg-green-600 text-white hover:bg-green-700';
      } else if (paymentSubmitted) {
        buttonLabel = 'Review Payment';
        buttonStyle = 'bg-orange-500 text-white hover:bg-orange-600';
      } else {
        buttonLabel = 'View Order';
        buttonStyle = 'bg-[#D4A574] text-white hover:bg-[#D4A574]';
      }
    } else if (action.type === 'VIEW_INVOICE' || action.type === 'VIEW_INVOICE_DETAILS') {
      buttonLabel = 'View Invoice';
      buttonStyle = 'bg-green-600 text-white hover:bg-green-700';
    } else if (action.type === 'REVIEW_UPDATE') {
      if (isCompleted || paymentReceived) {
        buttonLabel = 'View Completed';
        buttonStyle = 'bg-green-600 text-white hover:bg-green-700';
      } else {
        buttonLabel = 'Review Update';
        buttonStyle = 'bg-blue-500 text-white hover:bg-blue-600';
      }
    }
    
    return { buttonLabel, buttonStyle };
  }, [ordersMap]);
  
  /**
   * ✅ UTILITY: Format timestamp for display
   */
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, []);
  
  return {
    openNotificationModal,
    handleNotificationClick,
    handleActionClick,
    getActionButtonConfig,
    formatTimestamp,
  };
}