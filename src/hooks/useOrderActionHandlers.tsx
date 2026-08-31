/**
 * useOrderActionHandlers.tsx
 * ✅ PHASE 1 REFACTORED: UI Coordination Layer
 * 
 * PURPOSE:
 * - Coordinate UI state for order actions
 * - Handle modal interactions
 * - Manage toast notifications
 * - Provide event handlers to components
 * 
 * DOES NOT CONTAIN:
 * - ❌ Business logic (moved to orderWorkflowService)
 * - ❌ Calculations (moved to orderWorkflowService)
 * - ❌ Complex workflows (moved to orderWorkflowService)
 * 
 * RESPONSIBILITIES:
 * - ✅ UI state (loading, edit mode, selected order)
 * - ✅ Modal coordination (open/close)
 * - ✅ Notification display (toast, alerts)
 * - ✅ Event handler delegation to services
 * 
 * Version: 2.0.0 - Refactored March 8, 2026
 */

import { useState, useCallback } from 'react';
import type { Order, Product, Category } from '../types';
import { User } from './useAuth';
import { useAlert } from '../contexts/AlertContext';
import { useModal } from '../contexts/ModalContextNew';
// ✅ PASS 3: excelExport intentionally NOT imported at top — see hot-handler
// dynamic import below in handleDownloadOrder. Keeps xlsx-js-style out of
// any chunk that imports this hook.
import {
  approveOrderWorkflow,
  completeApprovalWorkflow,
  approveOrderUpdateWorkflow,
  rejectOrderWorkflow,
  editOrderItemsWorkflow,
  updateDeliveryFeeWorkflow,
  toggleServiceChargeWorkflow,
} from '../services/orderWorkflowService';
import { displayOrderNumber, orderFilename } from '../utils/displayId';

interface UseOrderActionHandlersProps {
  user: User;
  allOrders: Order[];
  products: Product[];
  categories: Category[];
  showNotification: (message: string, duration?: number) => void;
}

export function useOrderActionHandlers({
  user,
  allOrders,
  products,
  categories,
  showNotification,
}: UseOrderActionHandlersProps) {
  const { showAlert } = useAlert();
  const { openModal, closeModal } = useModal();

  // ========================================
  // UI STATE - Order Editing
  // ========================================
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Order['items']>([]);
  const [editedDeliveryFee, setEditedDeliveryFee] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // ========================================
  // HANDLERS - Order Approval
  // ========================================

  /**
   * Initiate order approval
   * Delegates to workflow service, handles UI prompts
   */
  const handleApprove = useCallback(
    async (orderId: string) => {
      const result = await approveOrderWorkflow(orderId, user as any, {});

      // Check if delivery fee input is required
      if (result.requiresInput && result.inputType === 'DELIVERY_FEE') {
        (openModal as any)('DELIVERY_FEE', {
          orderId,
          suggestedFee: result.inputData?.suggestedFee,
          freeDeliveryQualified: result.inputData?.freeDeliveryQualified,
          onConfirm: completeApprovalHandler,
        });
        return;
      }

      // Handle result
      if (result.success) {
        setSelectedOrder(null);
        showNotification(result.message || 'Order approved successfully!', 3000);
      } else {
        showAlert({
          title: 'Approval Failed',
          message: result.error || result.message || 'Failed to approve order',
          icon: 'error',
        });
      }
    },
    [user, openModal, showNotification, showAlert]
  );

  /**
   * Complete approval after delivery fee is provided
   */
  const completeApprovalHandler = useCallback(
    async (orderId: string, deliveryFee: number) => {
      const result = await completeApprovalWorkflow(orderId, user, deliveryFee);

      if (result.success) {
        setSelectedOrder(null);
        closeModal();
        showNotification(result.message || 'Order approved successfully!', 3000);
      } else {
        showAlert({
          title: 'Approval Failed',
          message: result.error || result.message || 'Failed to approve order',
          icon: 'error',
        });
      }
    },
    [user, closeModal, showNotification, showAlert]
  );

  /**
   * Approve order update request
   */
  const completeUpdateApprovalHandler = useCallback(
    async (orderId: string) => {
      const result = await approveOrderUpdateWorkflow(orderId, user);

      if (result.success) {
        setSelectedOrder(null);
        showNotification(result.message || 'Order update approved!', 5000);

        if (result.message?.includes('Supplementary invoice')) {
          showAlert({
            title: 'Supplementary Invoice Created',
            message: result.message,
            icon: 'success',
          });
        }
      } else {
        showAlert({
          title: 'Update Approval Failed',
          message: result.error || result.message || 'Failed to approve update',
          icon: 'error',
        });
      }
    },
    [user, showNotification, showAlert]
  );

  /**
   * Reject order
   */
  const handleReject = useCallback(
    async (orderId: string) => {
      const result = await rejectOrderWorkflow(orderId, user as any);

      if (result.success) {
        setSelectedOrder(null);
        showNotification(result.message || 'Order rejected', 3000);
      } else {
        showAlert({
          title: 'Rejection Failed',
          message: result.error || result.message || 'Failed to reject order',
          icon: 'error',
        });
      }
    },
    [user, showNotification, showAlert]
  );

  // ========================================
  // HANDLERS - Order Editing
  // ========================================

  /**
   * Enter edit mode for selected order
   */
  const handleEditOrder = useCallback(() => {
    if (selectedOrder) {
      setEditedItems(structuredClone(selectedOrder.items));
      setIsEditMode(true);
    }
  }, [selectedOrder]);

  /**
   * Cancel edit mode
   */
  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    setEditedItems([]);
  }, []);

  /**
   * Update item quantity for a specific day
   */
  const updateItemQuantity = useCallback(
    (itemIndex: number, day: keyof Order['items'][0], value: number) => {
      const newItems = [...editedItems];
      newItems[itemIndex] = {
        ...newItems[itemIndex],
        [day]: value,
      };

      // Recalculate total for this item
      const total =
        (newItems[itemIndex].monday || 0) +
        (newItems[itemIndex].tuesday || 0) +
        (newItems[itemIndex].wednesday || 0) +
        (newItems[itemIndex].thursday || 0) +
        (newItems[itemIndex].friday || 0) +
        (newItems[itemIndex].saturday || 0) +
        (newItems[itemIndex].sunday || 0);
      newItems[itemIndex] = { ...newItems[itemIndex], total };
      setEditedItems(newItems);
    },
    [editedItems]
  );

  /**
   * Save order edits
   */
  const handleSaveOrder = useCallback(async () => {
    if (!selectedOrder || !editedItems.length) return;
    setIsSendingEmail(true);
    try {
      const result = await (await import('../services/orders/paidOrderEditService')).adminEditPaidOrder(
        selectedOrder,
        editedItems,
        user.email,
        'Admin order edit'
      );
      setIsSendingEmail(false);
      if (result && (result as any).success) {
        setIsEditMode(false);
        const updatedOrder: Order = {
          ...selectedOrder,
          items: editedItems,
          subtotal: (result as any).data?.subtotal ?? selectedOrder.subtotal,
          gst: (result as any).data?.gst ?? selectedOrder.gst,
          deliveryFee: (result as any).data?.deliveryFee ?? selectedOrder.deliveryFee,
          serviceCharge: (result as any).data?.serviceCharge ?? selectedOrder.serviceCharge,
          total: (result as any).data?.total ?? selectedOrder.total,
        };
        setSelectedOrder(updatedOrder);
        showNotification((result as any).message || 'Order updated!', 3000);
      } else {
        showAlert({
          title: 'Update Failed',
          message: (result as any)?.error || (result as any)?.message || 'Failed to update order',
          icon: 'error',
        });
      }
    } catch (err) {
      setIsSendingEmail(false);
      showAlert({ title: 'Update Failed', message: 'Failed to update order', icon: 'error' });
    }
  }, [selectedOrder, editedItems, user, showNotification, showAlert]);

  /**
   * Toggle service charge waived status
   */
  const toggleServiceChargeWaived = useCallback(async () => {
    if (!selectedOrder) return;

    const result = await toggleServiceChargeWorkflow(selectedOrder.id, user);

    if (result.success) {
      // Update selected order
      const updatedOrder: Order = {
        ...selectedOrder,
        serviceChargeWaived: result.data.serviceChargeWaived,
        gst: result.data.gst,
        total: result.data.total,
      };
      
      setSelectedOrder(updatedOrder);
      showNotification(result.message || 'Service charge updated', 3000);
    } else {
      showAlert({
        title: 'Update Failed',
        message: result.error || result.message || 'Failed to toggle service charge',
        icon: 'error',
      });
    }
  }, [selectedOrder, user, showNotification, showAlert]);

  /**
   * Save delivery fee changes
   */
  const handleSaveDeliveryFee = useCallback(async () => {
    if (!selectedOrder) return;

    const deliveryFee = parseFloat(editedDeliveryFee) || selectedOrder.deliveryFee || 0;

    const result = await updateDeliveryFeeWorkflow(selectedOrder.id, deliveryFee, user);

    if (result.success) {
      // Update selected order
      const updatedOrder: Order = {
        ...selectedOrder,
        deliveryFee: result.data.deliveryFee,
        gst: result.data.gst,
        total: result.data.total,
      };
      
      setSelectedOrder(updatedOrder);
      setEditedDeliveryFee('');
      showNotification(result.message || 'Delivery fee updated!', 3000);
    } else {
      showAlert({
        title: 'Update Failed',
        message: result.error || result.message || 'Invalid delivery fee',
        icon: 'warning',
      });
    }
  }, [selectedOrder, editedDeliveryFee, user, showNotification, showAlert]);

  // ========================================
  // HANDLERS - Download
  // ========================================

  /**
   * Download order as CSV
   */
  const handleDownloadOrder = useCallback(
    async (order: Order) => {
      // ✅ PASS 3: Dynamic import — xlsx-js-style only loaded when user clicks Download.
      const { exportOrderToExcel, downloadCSV } = await import('../utils/excelExport');
      const csv = exportOrderToExcel(order, products, categories);
      if (csv) { downloadCSV(csv, orderFilename(order, order.customerName, 'csv')); }
    },
    [products, categories]
  );

  // ========================================
  // RETURN API
  // ========================================

  return {
    // State - Order Editing
    selectedOrder,
    setSelectedOrder,
    isEditMode,
    editedItems,
    setEditedItems,
    editedDeliveryFee,
    setEditedDeliveryFee,
    isSendingEmail,

    // Handlers - Order Approval
    handleApprove,
    completeApprovalHandler,
    completeUpdateApprovalHandler,
    handleReject,

    // Handlers - Order Editing
    handleEditOrder,
    handleCancelEdit,
    updateItemQuantity,
    handleSaveOrder,
    toggleServiceChargeWaived,
    handleSaveDeliveryFee,

    // Handlers - Download
    handleDownloadOrder,
  };
}
