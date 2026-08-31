/**
 * Edit Order Modal Component
 * 
 * ✅ FEB 16, 2026: Converted to StyleModalShell for premium design consistency
 * ✅ FEB 15, 2026: Refactored to use EditOrderPage component
 * 
 * Wraps EditOrderPage component with modal shell.
 *
 * Features:
 * - Customer direct save to pending orders
 * - Admin direct save to any editable order
 * - Navigation to order history
 */

import type { Order, Product, Category } from "../../../types";
import { EditOrderPage } from "../../order/EditOrderPage";
import { useModal } from "../../../contexts/ModalContextNew";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { Edit2 } from "lucide-react";
import { EditableItemsMap, EditOrderResult } from "../../../types/order-flow"; // Import proper types

interface EditOrderModalProps {
  order: Order;
  products: Product[];
  categories: Category[];
  onSave?: (editedItems: EditableItemsMap) => void | Promise<void | EditOrderResult>; // Properly typed
  onCancel?: () => void; // Already optional in types/modals.ts
  isAdmin: boolean;
  onNavigateToHistory?: (orderId: string) => void;
  onClose: () => void; // Added from ModalRoot
}

export function EditOrderModal({
  order,
  products,
  categories,
  onSave,
  onCancel,
  isAdmin,
  onNavigateToHistory,
  onClose,
}: EditOrderModalProps): JSX.Element | null {
  const { openModal } = useModal();

  // Provide a fallback onSave function if not provided
  const handleSave = (result: EditOrderResult | void) => { // Properly typed
    if (typeof onSave !== "function") {
      console.error(
        "❌ [EditOrderModal] onSave is not a function! Received:",
        typeof onSave,
        onSave,
      );
      console.error(
        "❌ [EditOrderModal] This is a critical error - modal will close without saving",
      );
      onClose(); // Close modal since we can't save
      return;
    }

    try {
      // Call parent's onSave handler
      onSave(result as any);
      
      // Close modal after successful save
      onClose();
    } catch (error) {
      console.error(
        "❌ [EditOrderModal] Error calling onSave:",
        error,
      );
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
      onClose={onClose}
      title="EDIT ORDER"
      subtitle={`${order.week || `Week ${order.deliveryWeek}`} • Update quantities and pricing`}
      hideBody={true}
      headerLeft={
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Edit2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
      }
    >
      <EditOrderPage
        order={order}
        products={products}
        categories={categories}
        onSave={handleSave}
        onCancel={onClose} // Use onClose from ModalRoot
        isAdmin={isAdmin}
        onNavigateToHistory={onNavigateToHistory}
      />
    </StyleModalShell>
  );
}