/**
 * AdminOrderDetailsModal.tsx
 * ✅ FEB 22, 2026: Converted to StyleModalShell + ModalFooterButtons
 * ✅ FEB 19, 2026: MOVED to /components/modals/orders/ (consolidation project)
 *
 * This modal was ~760 lines inline in AdminDashboard
 * Now extracted for better maintainability
 */

import { useState } from "react";
import { useCachedSettings } from "../../../hooks/useCachedFirebase";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ModalFooterButtons } from "../../../ui/modals/ModalFooterButtons";
import {
  DollarSign,
  AlertTriangle,
  Edit2,
  Download,
  FileDown,
  XCircle,
  CheckCircle as CheckCircleIcon,
  Check,
  X,
  Package,
  FileText,
} from "lucide-react";
import type { Order, Product, Category } from "../../../types";
import { formatRelativeDate } from "../../../utils/dateUtils";
import { toDate } from "../../../utils/timestampFormatting";
import { ModalThreeSections } from './ModalOrderSections';
import {
  downloadOrderPDF,
  downloadBakeryProductionPDF,
} from "../../../utils/pdf";
import { useAlert } from "../../../contexts/AlertContext";
import { displayOrderNumber } from '../../../utils/displayId';

interface AdminOrderDetailsModalProps {
  selectedOrder: Order;
  products: Product[];
  categories: Category[];
  isEditMode: boolean;
  editedItems: Order["items"];
  editedDeliveryFee: string;
  isSendingEmail: boolean;
  onClose: () => void;
  onEditOrder: () => void;
  onCancelEdit: () => void;
  onSaveOrder: () => void;
  onApprove: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onDownloadOrder: (order: Order) => void;
  updateItemQuantity: (
    productId: string,
    change: number,
  ) => void;
  toggleServiceChargeWaived: () => void;
  setEditedDeliveryFee: (fee: string) => void;
}

export function AdminOrderDetailsModal({
  selectedOrder,
  products,
  categories,
  isEditMode,
  editedItems,
  editedDeliveryFee,
  isSendingEmail,
  onClose,
  onEditOrder,
  onCancelEdit,
  onSaveOrder,
  onApprove,
  onReject,
  onDownloadOrder,
  updateItemQuantity,
  toggleServiceChargeWaived,
  setEditedDeliveryFee,
}: AdminOrderDetailsModalProps): JSX.Element | null {
  const { showAlert } = useAlert();
  const { data: liveSettings } = useCachedSettings();
  const paymentEmail = liveSettings?.businessEmail || 'orders@example.com';
  const [invoiceOrderNumber, setInvoiceOrderNumber] =
    useState<string>("");
  const [transferPassword, setTransferPassword] =
    useState<string>("");

  const handleSubmitPayment = () => {
    if (
      !invoiceOrderNumber.trim() ||
      !transferPassword.trim()
    ) {
      showAlert({
        title: "Missing Information",
        message:
          "Please enter both invoice order number and transfer password.",
        icon: "warning",
      });
      return;
    }
    // FIX T2R3-C4 (CRITICAL — admin security): Was echoing the transferPassword
    // back to the admin in plaintext via showAlert. Same anti-pattern as
    // T2R2-C7. The success message must NEVER include the password — only
    // confirm receipt.
    //
    // Note (separate concern, not fixed here): this handler does NOT currently
    // persist the entered values to the order document — the inputs are
    // captured only in local component state, then cleared. If the intent is
    // for admin to record the customer's e-transfer password against the
    // order, the handler must call updateOrder(order.id, { invoiceNumber,
    // transferPassword }) — but that contradicts the PIPEDA-compliance fix in
    // R5-S5-F16 which deletes transferPassword on payment confirm. This UI
    // appears to be a partially-built flow; flagging for product review.
    showAlert({
      title: "Payment Information Recorded",
      message: `Invoice details captured for order ${displayOrderNumber(selectedOrder)}.`,
      icon: "success",
    });
    setInvoiceOrderNumber("");
    setTransferPassword("");
  };

  // Build footer buttons based on mode
  const footerContent = isEditMode ? (
    <ModalFooterButtons
      cancelButton={{
        label: "CANCEL",
        onClick: onCancelEdit,
        variant: "danger",
        disabled: isSendingEmail,
      }}
      confirmButton={{
        label: isSendingEmail
          ? "SAVING..."
          : "SAVE CHANGES & NOTIFY",
        onClick: onSaveOrder,
        variant: "success",
        disabled: isSendingEmail,
        loading: isSendingEmail,
        icon: !isSendingEmail && (
          <CheckCircleIcon className="icon-button" />
        ),
      }}
    />
  ) : (
    <ModalFooterButtons
      leftAction={{
        label:
          (selectedOrder.status === "approved" ? "EDIT ORDER" : "") as string,
        onClick: onEditOrder,
        variant: "primary",
        icon: <Edit2 className="icon-button" />,
        disabled: selectedOrder.status !== "approved",
      }}
      cancelButton={{
        label: "CLOSE",
        onClick: onClose,
        variant: "secondary",
      }}
      confirmButton={{
        label: "APPROVE",
        onClick: () => onApprove(selectedOrder.id),
        variant: "success",
        icon: <CheckCircleIcon className="icon-button" />,
      }}
      extraButtons={[
        {
          label: "REJECT",
          onClick: () => onReject(selectedOrder.id),
          variant: "danger",
          icon: <XCircle className="icon-button" />,
        },
        {
          label: "DOWNLOAD EXCEL",
          onClick: () => onDownloadOrder(selectedOrder),
          variant: "ghost",
          icon: <Download className="icon-button" />,
        },
        {
          label: "DOWNLOAD PDF",
          onClick: () =>
            downloadOrderPDF(
              selectedOrder,
              products,
              categories,
            ),
          variant: "ghost",
          icon: <FileDown className="icon-button" />,
        },
        {
          label: "BAKERY PDF",
          onClick: () =>
            downloadBakeryProductionPDF(
              selectedOrder,
              products,
              categories,
            ),
          variant: "ghost",
          icon: <FileDown className="icon-button" />,
        },
      ]}
    />
  );

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={() => {
        onClose();
        onCancelEdit();
      }}
      title={`ORDER #${displayOrderNumber(selectedOrder)}`}
      headerLeft={
        <Package className="icon-modal-header text-[#333333]" />
      }
      footer={footerContent}
    >
      {/* STATUS BADGE - Show at top for approved orders */}
      {selectedOrder.status === "approved" && (
        <div
          className={`mb-6 rounded-xl p-4 shadow-lg text-center ${
            selectedOrder.paymentSubmitted
              ? "bg-gradient-to-r from-[#4CAF50] to-[#45a049]"
              : "bg-gradient-to-r from-[#FFC107] to-[#FFB300]"
          }`}
        >
          <h2 className="modal-title text-white">
            ✓ STATUS:{" "}
            {selectedOrder.paymentSubmitted
              ? "APPROVED - PAYMENT SUBMITTED"
              : "APPROVED - PAYMENT REQUIRED"}
          </h2>
        </div>
      )}

      <ModalThreeSections order={selectedOrder} products={products}>
      </ModalThreeSections>

      {/* Submit Payment Information Section - Only show for approved orders */}
      {selectedOrder.status === "approved" && (
        <div className="mb-6 bg-gradient-to-br from-[#FFF8E1] to-[#FFECB3] border-2 border-[#D4A574] rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-white bg-opacity-70 p-2 rounded-lg">
              <DollarSign className="icon-lg text-[#D4A574]" />
            </div>
            <h3 className="heading-4 text-[#333333]">
              💳 SUBMIT PAYMENT INFORMATION
            </h3>
          </div>

          {/* Payment Email Box */}
          <div className="bg-white rounded-lg p-4 mb-5 border border-[#E8C4A2] shadow-sm">
            <div className="text-center">
              <div className="body-sm text-[#666666] mb-2">
                Send order payment to this email:
              </div>
              <div className="heading-4 text-[#D4A574]">
                {paymentEmail}
              </div>
            </div>
          </div>

          {/* Invoice Order Number */}
          <div className="mb-4">
            <label className="form-label text-[#333333] mb-2">
              Invoice Order #
            </label>
            <input
              type="text"
              value={invoiceOrderNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInvoiceOrderNumber(e.target.value)
              }
              placeholder="Enter invoice order number"
              className="form-input w-full px-4 py-3 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#D4A574] bg-white"
            />
          </div>

          {/* Transfer Password */}
          <div className="mb-5">
            <label className="form-label text-[#333333] mb-2">
              Transfer Password
            </label>
            <input
              type="text"
              value={transferPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTransferPassword(e.target.value)
              }
              placeholder="Enter transfer password"
              className="form-input w-full px-4 py-3 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#D4A574] bg-white"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitPayment}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#D4A574] text-white rounded-lg hover:bg-[#C4956A] transition-colors shadow-md button-text-lg"
          >
            <span>✓</span>
            Submit Payment Information
          </button>
        </div>
      )}

      {/* Customer Note */}
      {selectedOrder.note && (
        <div className="mb-6 bg-[#FF9800] bg-opacity-10 border border-[#FF9800] rounded-lg p-4">
          <h3 className="modal-label text-[#333333] mb-2">
            📝 Customer Note:
          </h3>
          <p className="body-base text-[#333333]">{selectedOrder.note}</p>
        </div>
      )}

      {/* Update Request Summary */}
      {selectedOrder.updateRequested &&
        selectedOrder.originalItems && (
          <div className="mb-6 bg-gradient-to-br from-[#FF9800] to-[#FFB74D] rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-white bg-opacity-30 p-2 rounded-lg">
                <AlertTriangle className="icon-lg text-white" />
              </div>
              <div>
                <h3 className="heading-4 text-white">
                  UPDATE REQUEST
                </h3>
                <p className="body-sm text-white opacity-90">
                  Requested:{" "}
                  {selectedOrder.updateRequestedAt
                    ? formatRelativeDate(
                        toDate(selectedOrder.updateRequestedAt)?.toISOString() || "",
                      )
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Price Comparison */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-white bg-opacity-90 rounded-lg p-4 text-center">
                <div className="caption-text text-[#333333] opacity-70 mb-1">
                  Original Total
                </div>
                <div className="stat-value-sm text-[#333333]">
                  ${selectedOrder.originalTotal?.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="heading-2 text-white">
                  →
                </div>
              </div>
              <div className="bg-white bg-opacity-90 rounded-lg p-4 text-center">
                <div className="caption-text text-[#333333] opacity-70 mb-1">
                  New Total
                </div>
                <div className="stat-value-sm text-[#FF9800]">
                  $
                  {selectedOrder.total != null
                    ? selectedOrder.total.toFixed(2)
                    : "0.00"}
                </div>
              </div>
            </div>

            {/* Difference Badge */}
            <div className="text-center mb-5">
              <div
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold shadow-md ${
                  selectedOrder.total >
                  (selectedOrder.originalTotal || 0)
                    ? "bg-white text-[#4CAF50]"
                    : selectedOrder.total <
                        (selectedOrder.originalTotal || 0)
                      ? "bg-white text-[#F44336]"
                      : "bg-white text-[#333333]"
                }`}
              >
                {selectedOrder.total >
                (selectedOrder.originalTotal || 0) ? (
                  <>
                    <span className="text-xl">↑</span>
                    <span>
                      +$
                      {(
                        selectedOrder.total -
                        (selectedOrder.originalTotal || 0)
                      ).toFixed(2)}{" "}
                      INCREASE
                    </span>
                  </>
                ) : selectedOrder.total <
                  (selectedOrder.originalTotal || 0) ? (
                  <>
                    <span className="text-xl">↓</span>
                    <span>
                      -$
                      {(
                        (selectedOrder.originalTotal || 0) -
                        selectedOrder.total
                      ).toFixed(2)}{" "}
                      DECREASE
                    </span>
                  </>
                ) : (
                  <span>NO CHANGE IN TOTAL</span>
                )}
              </div>
            </div>

            {/* Item Changes */}
            <div className="bg-white bg-opacity-90 rounded-lg p-4">
              <h4 className="text-[#333333] font-bold mb-3">
                📦 Item Changes
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedOrder.items.map((item) => {
                  const originalItem =
                    selectedOrder.originalItems?.find(
                      (orig) =>
                        orig.productId === item.productId,
                    );
                  const hasChanged =
                    !originalItem ||
                    originalItem.quantity !== (item.quantity ?? item.total);

                  if (!hasChanged) return null;

                  return (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm text-[#333333]">
                        {item.productName}
                      </span>
                      <span className="text-sm font-bold text-[#FF9800]">
                        {originalItem?.quantity || 0} →{" "}
                        {(item.quantity ?? item.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* Order Items Table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#E8C4A2]">
              <th className="table-header px-3 py-2 text-left text-[#333333]">
                Item
              </th>
              <th className="table-header px-3 py-2 text-center text-[#333333]">
                Qty
              </th>
              <th className="table-header px-3 py-2 text-right text-[#333333]">
                Price
              </th>
              <th className="table-header px-3 py-2 text-right text-[#333333]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {(isEditMode
              ? editedItems
              : selectedOrder.items
            ).map((item) => (
              <tr
                key={item.productId}
                className="border-b border-gray-200"
              >
                <td className="table-cell px-3 py-2 text-[#333333]">
                  {item.productName}
                </td>
                <td className="px-3 py-2 text-center text-[#333333]">
                  {isEditMode ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          updateItemQuantity(item.productId, -1)
                        }
                        className="w-7 h-7 bg-[#F44336] text-white rounded hover:bg-[#da190b] transition-colors"
                      >
                        -
                      </button>
                      <span className="font-semibold w-8 text-center">
                        {(item.quantity ?? item.total)}
                      </span>
                      <button
                        onClick={() =>
                          updateItemQuantity(item.productId, 1)
                        }
                        className="w-7 h-7 bg-[#4CAF50] text-white rounded hover:bg-[#45a049] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="font-semibold">
                      {(item.quantity ?? item.total)}
                    </span>
                  )}
                </td>
                <td className="table-cell px-3 py-2 text-right text-[#333333]">
                  ${item.price?.toFixed(2)}
                </td>
                <td className="table-cell-emphasis px-3 py-2 text-right text-[#333333]">
                  $
                  {((item.price || 0) * (item.quantity ?? item.total)).toFixed(
                    2,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order Totals */}
      <div className="bg-[#F5F5F5] rounded-lg p-4 mb-6">
        <div className="flex justify-between mb-2">
          <span className="body-base text-[#333333]">Subtotal:</span>
          <strong className="body-base text-[#333333]">
            $
            {(() => {
              const items = isEditMode
                ? editedItems
                : selectedOrder.items;
              return items
                .reduce(
                  (sum, item) =>
                    sum + (item.price || 0) * (item.quantity ?? item.total),
                  0,
                )
                .toFixed(2);
            })()}
          </strong>
        </div>
        <div className="flex justify-between mb-2">
          <span className="body-base text-[#333333]">
            Service Charge (10%):
          </span>
          <strong className="body-base text-[#333333]">
            ${selectedOrder.serviceCharge?.toFixed(2)}
          </strong>
        </div>
        <div className="flex justify-between mb-2">
          <span className="body-base text-[#333333]">Delivery Fee:</span>
          <strong className="body-base text-[#333333]">
            ${selectedOrder.deliveryFee?.toFixed(2)}
          </strong>
        </div>
        {/* GST row */}
        {(selectedOrder.gst ?? 0) > 0 && (
          <div className="flex justify-between mb-2">
            <span className="body-base text-[#333333]">GST (5%):</span>
            <strong className="body-base text-[#333333]">
              ${(selectedOrder.gst ?? 0).toFixed(2)}
            </strong>
          </div>
        )}
        {/* Discount row */}
        {(selectedOrder.discount ?? 0) > 0 && (
          <div className="flex justify-between mb-2">
            <span className="body-base text-green-700">Discount:</span>
            <strong className="body-base text-green-700">
              −${(selectedOrder.discount ?? 0).toFixed(2)}
            </strong>
          </div>
        )}
        <div className="flex justify-between heading-5 font-bold border-t-2 border-[#D4A574] pt-2 mt-2">
          <span className="text-[#333333]">TOTAL:</span>
          <strong className="text-[#D4A574]">
            $
            {isEditMode
              ? (() => {
                  const subtotal = editedItems.reduce(
                    (sum, item) =>
                      sum + (item.price || 0) * (item.quantity ?? item.total),
                    0,
                  );
                  const serviceCharge =
                    selectedOrder.serviceChargeWaived
                      ? 0
                      : subtotal * 0.1;
                  const deliveryFee =
                    parseFloat(editedDeliveryFee) ||
                    selectedOrder.deliveryFee ||
                    0;
                  return (
                    subtotal +
                    serviceCharge +
                    deliveryFee
                  ).toFixed(2);
                })()
              : selectedOrder.total != null
                ? selectedOrder.total.toFixed(2)
                : "0.00"}
          </strong>
        </div>
        {/* Credit Applied row — below TOTAL */}
        {((selectedOrder as any).creditApplied ?? 0) > 0 && (
          <>
            <div className="flex justify-between mt-2 pt-2 border-t border-dashed border-emerald-300">
              <span className="body-base text-emerald-700 font-medium">💳 Credit Applied:</span>
              <strong className="body-base text-emerald-700">
                −${((selectedOrder as any).creditApplied ?? 0).toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between mt-1 bg-emerald-50 rounded-lg px-3 py-2">
              <span className="body-base font-bold text-emerald-900">AMOUNT DUE:</span>
              <strong className="body-base font-bold text-emerald-900">
                ${Math.max(0, (selectedOrder.total ?? 0) - ((selectedOrder as any).creditApplied ?? 0)).toFixed(2)}
              </strong>
            </div>
          </>
        )}
      </div>
    </StyleModalShell>
  );
}