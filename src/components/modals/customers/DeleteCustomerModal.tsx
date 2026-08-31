/**
 * DeleteCustomerModal - Confirm customer deletion/archival
 *
 * ✅ FEB 21, 2026: Updated to use danger skin (skin system)
 * ✅ FEB 19, 2026: MOVED to /components/modals/customers/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 */

import { useState, useEffect, useRef } from "react";
import { useModal } from "../../../contexts/ModalContextNew"; // ✅ Import modal context
import {
  Trash2,
  AlertTriangle,
  Package,
  DollarSign,
  User,
  Archive,
  TrendingUp,
  FileText,
  AlertCircle,
  Shield,
} from "lucide-react";
import type { Order, Customer } from "../../../types";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { DeleteFooter } from "../../../ui/modals/ModalFooterButtons"; // ✅ FEB 21, 2026
import { getOrdersByCustomer } from "../../../services/data/ordersDataService";
import { toDate } from '../../../utils/timestampFormatting';

interface DeleteCustomerModalProps {
  customer: Customer;
  onConfirm: (customer: Customer, archiveOnly: boolean) => void;
  onCancel?: () => void;
  onClose?: () => void; // ✅ Support both onCancel and onClose for compatibility
}

// Customer statistics interface
interface CustomerStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
}

export function DeleteCustomerModal({
  customer,
  onConfirm,
  onCancel,
  onClose,
}: DeleteCustomerModalProps): JSX.Element | null {
  const { openModal } = useModal(); // ✅ Use modal context
  const [orderCount, setOrderCount] = useState(0);
  const [archiveInstead, setArchiveInstead] = useState(true); // Default to archive (safer option)
  const [confirmText, setConfirmText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [customerStats, setCustomerStats] =
    useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ PASS 6: storeName is optional — fall back to "this customer" if missing.
  const CONFIRMATION_TEXT = (customer.storeName ?? "this customer").toUpperCase();

  // Load customer orders and calculate statistics
  // FIX T2R3-H2 (HIGH): The previous pattern was broken:
  //   let cancelled = false;
  //   loadCustomerData(cancelled);          // passes VALUE false
  //   return () => { cancelled = true; };   // mutates outer var, useless
  // `loadCustomerData` took `cancelled` as a parameter (default false), so
  // it only ever saw the captured value `false`. The cleanup mutating the
  // outer `cancelled` had no effect inside the function — it was reading
  // its own parameter, not the outer scope. Result: stale customer stats
  // could overwrite fresh ones if the customer prop changed mid-fetch.
  //
  // Fix: use a ref. The ref is read live inside the async function, so
  // the cleanup actually cancels the in-flight write.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    loadCustomerData();
    return () => { cancelledRef.current = true; };
  }, [customer.id]);

  const loadCustomerData = async () => {
    try {
      const customerOrders = await getOrdersByCustomer(customer.id);
      if (cancelledRef.current) return;

      // Filter orders for this customer
      setOrderCount(customerOrders.length);

      // Calculate statistics
      const pendingOrders = customerOrders.filter(
        (o: Order) => o.status === "pending",
      ).length;
      const completedOrders = customerOrders.filter(
        (o: Order) => o.status === "completed",
      ).length;
      const totalRevenue = customerOrders
        .filter((o: Order) => o.status === "completed")
        .reduce((sum: number, o: Order) => sum + o.total, 0);
      const averageOrderValue =
        completedOrders > 0
          ? totalRevenue / completedOrders
          : 0;

      // Find last order date
      const sortedOrders = [...customerOrders].sort(
        (a, b) =>
          (toDate(b.createdAt)?.getTime() ?? 0) -
          (toDate(a.createdAt)?.getTime() ?? 0),
      );
      const lastOrderDate =
        sortedOrders.length > 0
          ? toDate(sortedOrders[0].createdAt)?.toISOString() || null
          : null;

      if (cancelledRef.current) return;
      setCustomerStats({
        totalOrders: customerOrders.length,
        pendingOrders,
        completedOrders,
        totalRevenue,
        averageOrderValue,
        lastOrderDate,
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading customer data:", error);
      if (!cancelledRef.current) setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!archiveInstead && confirmText !== CONFIRMATION_TEXT) return;

    openModal(
      'AUTH_GUARD',
      {
        title: archiveInstead ? 'Archive Customer' : 'Permanently Delete Customer',
        description: archiveInstead
          ? `Archive ${customer.storeName || customer.contactPerson}? They will no longer be able to log in.`
          : `Permanently delete ${customer.storeName || customer.contactPerson}? This cannot be undone.`,
        actionLabel: archiveInstead ? 'Archive Customer' : 'Delete Permanently',
        danger: true,
        onConfirm: async () => {
          await onConfirm(customer, archiveInstead);
        },
      },
      'md' as any,
      "sm",
      { replaceTop: true }
    );
  };

  const isConfirmDisabled =
    !archiveInstead && confirmText !== CONFIRMATION_TEXT;

  return (
    <StyleModalShell
      width="4xl"
      skinType="danger"
      onClose={onCancel || onClose || (() => {})}
      title="DELETE CUSTOMER"
      subtitle={(customer.storeName || customer.email || 'Customer')}
      headerLeft={
        <div
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shadow-lg ${
            archiveInstead ? "bg-[#FF9800]" : "bg-[#F44336]"
          }`}
        >
          {archiveInstead ? (
            <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          ) : (
            <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          )}
        </div>
      }
      footer={
        <DeleteFooter
          onCancel={onCancel || onClose || (() => {})}
          onDelete={handleConfirm}
          itemName={
            archiveInstead
              ? "Customer (Archive)"
              : "Customer (Permanently)"
          }
          isDeleting={false}
        />
      }
    >
      {/* ✅ FEB 21, 2026: Removed duplicate overflow/padding - StyleModalShell handles it */}
      <div className="space-y-6">
        {/* 1. CUSTOMER INFO - White Card */}
        <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-2">
            <User className="size-4 text-[#D4A574]" />
            <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
              Customer Information
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Store Name:</span>
              <span className="font-medium text-neutral-800">
                {customer.storeName || 'N/A'}
              </span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Email:</span>
                <span className="font-medium text-neutral-800">
                  {customer.email}
                </span>
              </div>
            )}
            {customer.customerType && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Type:</span>
                <span className="font-medium text-neutral-800">
                  {customer.customerType === "commercial"
                    ? "🏢 Commercial"
                    : "👤 Individual"}
                </span>
              </div>
            )}
            {customer.contactPerson && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">
                  Contact Person:
                </span>
                <span className="font-medium text-neutral-800">
                  {customer.contactPerson}
                </span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-600">Phone:</span>
                <span className="font-medium text-neutral-800">
                  {customer.phone}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 2. CUSTOMER STATISTICS - White Card */}
        {!isLoading && customerStats && (
          <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-2">
              <TrendingUp className="size-4 text-[#D4A574]" />
              <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
                Customer Impact Analysis
              </h3>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-[#2196F3] text-xs ml-auto hover:underline"
              >
                {showDetails ? "Hide" : "Show"} Details
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-neutral-50 rounded-lg p-3 text-center border border-neutral-100">
                <FileText className="w-5 h-5 text-[#D4A574] mx-auto mb-1" />
                <p className="text-lg font-bold text-neutral-800">
                  {customerStats.totalOrders}
                </p>
                <p className="text-neutral-600 text-xs">
                  Total Orders
                </p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3 text-center border border-neutral-100">
                <Package className="w-5 h-5 text-[#FF9800] mx-auto mb-1" />
                <p className="text-lg font-bold text-neutral-800">
                  {customerStats.pendingOrders}
                </p>
                <p className="text-neutral-600 text-xs">
                  Pending
                </p>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3 text-center border border-neutral-100">
                <DollarSign className="w-5 h-5 text-[#4CAF50] mx-auto mb-1" />
                <p className="text-lg font-bold text-neutral-800">
                  ${customerStats.totalRevenue.toFixed(0)}
                </p>
                <p className="text-neutral-600 text-xs">
                  Revenue
                </p>
              </div>
            </div>

            {/* Detailed Stats */}
            {showDetails && (
              <div className="space-y-2 pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">
                    Completed Orders:
                  </span>
                  <span className="text-neutral-800 font-medium">
                    {customerStats.completedOrders}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">
                    Average Order Value:
                  </span>
                  <span className="text-neutral-800 font-medium">
                    $
                    {customerStats.averageOrderValue.toFixed(2)}
                  </span>
                </div>
                {customerStats.lastOrderDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">
                      Last Order:
                    </span>
                    <span className="text-neutral-800 font-medium">
                      {new Date(
                        customerStats.lastOrderDate,
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {customerStats.pendingOrders > 0 && (
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-orange-800 text-sm">
                  <strong>
                    Customer has {orderCount} active order
                    {orderCount !== 1 ? "s" : ""}.
                  </strong>
                  <br />
                  These orders will remain in the system but the
                  customer record will be modified.
                </p>
              </div>
            )}
          </section>
        )}

        {/* 3. DELETION METHOD - White Card */}
        <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 pb-2">
            <Shield className="size-4 text-[#D4A574]" />
            <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
              Deletion Method
            </h3>
          </div>

          <div className="space-y-3">
            {/* Archive Option (Recommended) */}
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                archiveInstead
                  ? "bg-orange-50 border-orange-500"
                  : "bg-neutral-50 border-neutral-200 hover:border-orange-300"
              }`}
            >
              <input
                type="radio"
                checked={archiveInstead}
                onChange={() => {
                  setArchiveInstead(true);
                  setConfirmText(""); // Reset confirmation text
                }}
                className="mt-1 w-5 h-5 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Archive className="w-5 h-5 text-orange-500" />
                  <span className="text-neutral-800 font-bold">
                    Archive (Recommended)
                  </span>
                  <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">
                    SAFE
                  </span>
                </div>
                <p className="text-neutral-600 text-xs leading-relaxed">
                  Hide customer from active lists while
                  preserving all data. They won't be able to
                  login, but all orders and history remain
                  intact.{" "}
                  <strong className="text-neutral-800">
                    Can be restored later.
                  </strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded border border-green-200">
                    ✓ Reversible
                  </span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded border border-green-200">
                    ✓ Data Preserved
                  </span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded border border-green-200">
                    ✓ Login Disabled
                  </span>
                </div>
              </div>
            </label>

            {/* Permanent Delete Option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                !archiveInstead
                  ? "bg-red-50 border-red-500"
                  : "bg-neutral-50 border-neutral-200 hover:border-red-300"
              }`}
            >
              <input
                type="radio"
                checked={!archiveInstead}
                onChange={() => setArchiveInstead(false)}
                className="mt-1 w-5 h-5 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <span className="text-neutral-800 font-bold">
                    Permanent Delete
                  </span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                    DANGER
                  </span>
                </div>
                <p className="text-neutral-600 text-xs leading-relaxed">
                  Completely remove customer account and
                  credentials.{" "}
                  <strong className="text-red-600">
                    CANNOT BE UNDONE.
                  </strong>{" "}
                  Orders will remain for historical records, but
                  login access is permanently revoked.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded border border-red-200">
                    ✗ Irreversible
                  </span>
                  <span className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded border border-red-200">
                    ✗ No Restore
                  </span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] rounded border border-green-200">
                    ✓ Orders Kept
                  </span>
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* 4. CONFIRMATION INPUT (only for permanent delete) - White Card */}
        {!archiveInstead && (
          <section className="bg-red-50 rounded-xl p-5 border-2 border-red-500 shadow-sm">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-neutral-800 font-bold text-sm mb-1">
                  Confirmation Required
                </p>
                <p className="text-neutral-700 text-xs">
                  Type{" "}
                  <strong className="text-neutral-900 font-mono bg-white px-1.5 py-0.5 rounded border">
                    {CONFIRMATION_TEXT}
                  </strong>{" "}
                  to confirm permanent deletion:
                </p>
              </div>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
              placeholder={`Type "${CONFIRMATION_TEXT}" here`}
              className="w-full px-4 py-3 bg-white border-2 border-red-300 rounded-lg focus:outline-none focus:border-red-500 text-neutral-800 placeholder-neutral-400 font-mono"
            />
            {confirmText &&
              confirmText !== CONFIRMATION_TEXT && (
                <p className="text-red-600 text-xs mt-2">
                  ✗ Text doesn't match. Please type exactly:{" "}
                  {CONFIRMATION_TEXT}
                </p>
              )}
            {confirmText === CONFIRMATION_TEXT && (
              <p className="text-green-600 text-xs mt-2">
                ✓ Confirmation text matches
              </p>
            )}
          </section>
        )}

        {/* 5. ACTION SUMMARY - White Card */}
        <section className="bg-white rounded-xl p-5 border border-neutral-200 shadow-sm">
          <h4 className="text-neutral-800 font-bold text-sm mb-3">
            What happens next:
          </h4>
          <ul className="space-y-2 text-xs text-neutral-700">
            {archiveInstead ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">•</span>
                  <span>
                    Customer status changed to "archived"
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">•</span>
                  <span>Login access disabled immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500">•</span>
                  <span>
                    Hidden from customer lists (can be filtered)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>All orders and data preserved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Can be restored by admin anytime</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span>
                    Customer account permanently deleted
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span>Login credentials removed forever</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600">•</span>
                  <span>Customer cannot be restored</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>
                    Order history retained for records
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ</span>
                  <span>
                    Financial data preserved for accounting
                  </span>
                </li>
              </>
            )}
          </ul>
        </section>
      </div>
    </StyleModalShell>
  );
}

// Default export for lazy loading
export default DeleteCustomerModal;