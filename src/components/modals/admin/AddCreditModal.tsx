/**
 * AddCreditModal - Admin tool to manually add credit to customer account
 *
 * ✅ MAR 3, 2026: Created for admin manual credit issuance
 */

import { useState } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { Wallet, AlertCircle, CheckCircle } from "lucide-react";
import { Customer } from "../../../types";
import { formatCreditAmount } from "../../../services/creditService";
import { issueStoreCreditViaCloudFunction, callableErrorMessage } from "../../../services/firebase/cloudFunctions";
import { invalidateCache } from "../../../hooks/useCachedFirebase";
import { SaveFooter, submitForm } from "../../../ui/modals/ModalFooterButtons";


interface AddCreditModalProps {
  customer: Customer;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCreditModal({
  customer,
  onClose,
  onSuccess,
}: AddCreditModalProps): JSX.Element | null {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [type, setType] = useState<"refund" | "overpayment" | "admin_edit">("refund");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate amount
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      setError("Please enter a valid amount greater than $0.00");
      return;
    }

    // Validate reason
    if (!reason.trim()) {
      setError("Please provide a reason for the credit");
      return;
    }

    setLoading(true);

    try {
      // issueStoreCredit Cloud Function: creates the credit note and the
      // customer's notification together.
      await issueStoreCreditViaCloudFunction({
        customerId: customer.id || "",
        amount: Math.round(creditAmount * 100) / 100,
        reason: reason.trim(),
        type,
      });

      // Invalidate credit cache so CreditBalanceWidget updates immediately
      invalidateCache.credit(customer.id);
      invalidateCache.all(); // also refresh creditNotes query used by CreditReceivedModal

      // Show success
      setSuccess(true);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Auto-close after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error adding credit:", err);
      setError(callableErrorMessage(err, "add the credit"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyleModalShell
      width="xl"
      skinType="default"
      onClose={onClose}
      title="ADD CREDIT"
      subtitle={`Add credit to ${customer.storeName || customer.contactPerson || customer.email}`}
      icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6" />}
      footer={
        success ? undefined : (
          <SaveFooter
            onCancel={onClose}
            onSave={() => submitForm("add-credit-form")}
            isSaving={loading}
            saveDisabled={!amount || !reason.trim()}
            saveLabel={`Add ${amount ? formatCreditAmount(parseFloat(amount)) : "Credit"}`}
          />
        )
      }
    >
      {success ? (
        // Success State
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Credit Added Successfully!
          </h3>
          <p className="text-gray-600 mb-2">
            {formatCreditAmount(parseFloat(amount))} has been added to the customer's account.
          </p>
          <p className="text-sm text-gray-500">
            Closing modal...
          </p>
        </div>
      ) : (
        // Form
        <form id="add-credit-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Customer Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Customer</div>
            <div className="font-semibold text-gray-900">{customer.storeName || customer.contactPerson}</div>
            <div className="text-sm text-gray-500">{customer.email}</div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Amount *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D4A574] focus:outline-none text-lg font-semibold"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Credit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Type *
            </label>
            <select
              value={type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value as typeof type)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D4A574] focus:outline-none"
              required
              disabled={loading}
            >
              <option value="refund">Refund</option>
              <option value="overpayment">Overpayment</option>
              <option value="admin_edit">Admin Edit</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              {type === "refund" && "Credit issued for returned items or order cancellation"}
              {type === "overpayment" && "Customer paid more than the order total"}
              {type === "admin_edit" && "Credit issued due to admin order edit or adjustment"}
            </p>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason *
            </label>
            <textarea
              id="credit-reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Enter the reason for adding this credit..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D4A574] focus:outline-none resize-none"
              rows={4}
              required
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be visible to the customer in their credit history
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 text-sm">Error</div>
                <div className="text-red-700 text-sm">{error}</div>
              </div>
            </div>
          )}

          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </StyleModalShell>
  );
}