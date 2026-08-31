/**
 * useOrderNotificationHandlers.ts
 * ✅ PHASE 2 REFACTORED: UI Coordination Layer
 * 
 * PURPOSE:
 * - Handle notification action coordination
 * - Route to appropriate modals based on order status
 * - Delegate data fetching to services
 * 
 * DOES NOT CONTAIN:
 * - ❌ Business logic
 * 
 * RESPONSIBILITIES:
 * - ✅ Modal routing based on order status
 * - ✅ Error handling for UI
 * - ✅ Service delegation for data
 * 
 * Version: 2.0.0 - Refactored March 8, 2026
 */

import { useCallback } from 'react';
import { getAll as getProductsFromDataService } from '../services/data/productsDataService'; // Use data service
import { getAllCategories } from '../services/data/categoriesDataService'; // Use data service
import { getOrder } from '@/services/data/ordersDataService'; // v2.0
import { downloadCompleteOrderPDF } from '@/utils/pdf';
import { toast } from 'sonner';
import type { ModalType, ModalProps } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';
import { displayOrderNumber } from '../utils/displayId';
import { logger } from '../utils/logger';


interface UseOrderNotificationHandlersProps {
  openModal: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
}

interface UseOrderNotificationHandlersReturn {
  handleViewOrderFromNotification: (
    orderId: string,
    onCloseCallback?: () => void
  ) => void;
  handleDownloadInvoiceFromNotification: (orderId: string) => void;
}

export function useOrderNotificationHandlers({
  openModal,
}: UseOrderNotificationHandlersProps): UseOrderNotificationHandlersReturn {
  /**
   * Handle viewing an order from a notification
   * 
   * Routes to appropriate modal based on order status:
   * - pending: Pending order view (not yet implemented)
   * - approved: Submit payment modal
   * - completed: Completed order invoice
   * - cancelled: Cancelled order details
   */
  const handleViewOrderFromNotification = useCallback(
    async (orderId: string, onCloseCallback?: () => void) => {
      try {
        const order = await getOrder(orderId);
        
        if (!order) {
          logger.warn(`Order ${orderId} not found`);
          (openModal as any)('NOTIFICATION_DETAILS', {
            error: 'Order Not Found: We couldn\'t find the order. It may have been deleted.',
          });
          return;
        }


        // ✅ REFACTOR: Fetch products and categories from services
        const [products, categories] = await Promise.all([
          getProductsFromDataService(),
          getAllCategories(),
        ]);

        // Route to appropriate modal based on order status
        switch (order.status) {
          case 'pending':
            logger.warn('Pending order view from notification not yet implemented');
            (openModal as any)('NOTIFICATION_DETAILS', {
              error: 'Pending order view is not available from notifications.',
            });
            break;

          case 'approved':
            (openModal as any)('SUBMIT_PAYMENT', {
              order,
              products,
              categories,
              onPaymentSubmitted: () => {
                if (onCloseCallback) onCloseCallback();
              },
            });
            break;

          case 'in_process':
            // Show order details for in-process orders
            (openModal as any)('PAID_ORDER_DETAILS', {
              order,
              products,
              categories,
              onClose: onCloseCallback,
            });
            break;

          case 'completed':
            (openModal as any)('COMPLETED_ORDER_INVOICE', {
              order,
              products,
              categories,
              onClose: onCloseCallback,
            });
            break;

          case 'cancelled':
 // Show toast notification instead of modal for cancelled orders
            toast.success(`Order ${displayOrderNumber(order)} has been cancelled`, {
              description: order.cancellationReason ? `Reason: ${order.cancellationReason}` : 'The customer has been notified.',
              duration: 5000,
            });
            // Close the notification panel
            if (onCloseCallback) onCloseCallback();
            break;

          default:
            logger.warn(`Unknown order status: ${order.status}`);
            (openModal as any)('NOTIFICATION_DETAILS', {
              error: `Order status "${order.status}" is not recognized.`,
            });
        }
      } catch (error) {
        console.error('❌ Error viewing order from notification:', error);
        (openModal as any)('NOTIFICATION_DETAILS', {
          error: 'Error Loading Order: We couldn\'t load the order details. Please try again.',
        });
      }
    },
    [openModal]
  );

  /**
   * Handle downloading an invoice from a notification
   * 
   * Fetches order data and generates PDF invoice
   */
  const handleDownloadInvoiceFromNotification = useCallback(
    async (orderId: string) => {
      try {
        const order = await getOrder(orderId);
        
        if (!order) {
          logger.warn(`Order ${orderId} not found for download`);
          return;
        }

        // ✅ REFACTOR: Fetch products and categories from services
        const [products, categories] = await Promise.all([
          getProductsFromDataService(),
          getAllCategories(),
        ]);

        // Generate and download PDF
        downloadCompleteOrderPDF(order, products, categories);
        
      } catch (error) {
        console.error('❌ Error downloading invoice from notification:', error);
      }
    },
    []
  );

  return {
    handleViewOrderFromNotification,
    handleDownloadInvoiceFromNotification,
  };
}