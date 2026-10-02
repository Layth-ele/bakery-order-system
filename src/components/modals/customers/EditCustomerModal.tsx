/**
 * EditCustomerModal - Edit customer profile information
 *
 * ✅ FEB 21, 2026: Standardized loading states
 * ✅ FEB 19, 2026: MOVED to /components/modals/customers/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 */

import { useState, useEffect } from "react";
import { useAlert } from "../../../contexts/AlertContext";
import { ToastNotification } from "../../ToastNotification";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { SaveFooter } from "../../../ui/modals/ModalFooterButtons";
import { ModalLoading } from "../../../ui/modals/ModalLoadingState";
import { AddressAutocomplete } from "../../AddressAutocomplete";
import { Edit3, Building2, User, Lock } from "lucide-react";
import type { Customer } from "../../../types";

interface EditCustomerModalProps {
  customer: Customer;
  onSave: (customer: Customer) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function EditCustomerModal({
  customer,
  onSave,
  onCancel,
  onClose,
}: EditCustomerModalProps): JSX.Element | null {
  const { showAlert } = useAlert();

  const [editingCustomer, setEditingCustomer] =
    useState<Customer>({ ...customer });
  const [notification, setNotification] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ FIX: Use customer prop directly (already has fresh Firebase data from parent)
    setEditingCustomer({ ...customer });
    setIsLoading(false);
  }, [customer]);

  const handleSave = async () => {
    // Basic validation before saving
    if (!editingCustomer.storeName?.trim() && !editingCustomer.contactPerson?.trim()) {
      showAlert({ title: 'Validation Error', message: 'Please enter a store name or contact person.', icon: 'warning' });
      return;
    }
    if (!editingCustomer.email?.trim()) {
      showAlert({ title: 'Validation Error', message: 'Email address is required.', icon: 'warning' });
      return;
    }

    await onSave(editingCustomer);
  };

  if (isLoading) {
    return (
      <StyleModalShell
        width="xl"
        skinType="default"
        onClose={onClose ?? (() => {})}
        title="EDIT CUSTOMER"
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center shadow-lg">
            <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
      >
        <ModalLoading
          message="Loading customer data..."
        />
      </StyleModalShell>
    );
  }

  return (
    <>
      {notification && (
        <ToastNotification
          message={notification}
          onClose={() => setNotification("")}
        />
      )}

      <StyleModalShell
        onClose={onCancel || onClose || (() => {})}
        title="EDIT CUSTOMER"
        subtitle={
          editingCustomer.storeName ||
          editingCustomer.contactPerson
        }
        width="xl"
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#D4A574] flex items-center justify-center shadow-lg">
            <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
        footer={
          <SaveFooter
            onCancel={onCancel || onClose || (() => {})}
            onSave={handleSave}
            saveLabel="SAVE CHANGES"
          />
        }
      >
        <div className="space-y-6">
          {/* Customer Type Badge */}
          <div className="flex justify-end">
            {/* Customer Type Badge — handles admin / commercial / individual */}
            {(() => {
              const ct = editingCustomer.customerType;
              const isAdmin      = ct === 'admin' || (editingCustomer as any).role === 'admin';
              const isCommercial = ct === 'commercial';
              const badgeColor   = isAdmin ? '#FF9800' : isCommercial ? '#2196F3' : '#9C27B0';
              const BadgeIcon    = isAdmin ? Lock : isCommercial ? Building2 : User;
              const badgeLabel   = isAdmin ? 'Admin' : isCommercial ? 'Commercial' : 'Individual';
              return (
                <>
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
                    style={{ backgroundColor: badgeColor }}>
                    <BadgeIcon className="w-5 h-5 text-white" />
                    <span className="text-sm font-semibold text-white uppercase tracking-wide">{badgeLabel}</span>
                  </div>
                  <div className="md:hidden flex items-center justify-center w-10 h-10 rounded-full shadow-lg"
                    style={{ backgroundColor: badgeColor }}>
                    <BadgeIcon className="w-5 h-5 text-white" />
                  </div>
                </>
              );
            })()}
          </div>

          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={editingCustomer.email || ""}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                value={editingCustomer.storeName || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    storeName: e.target.value,
                  })
                }
                placeholder="Enter store name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={editingCustomer.contactPerson || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    contactPerson: e.target.value,
                  })
                }
                placeholder="Enter contact person name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editingCustomer.phone || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    phone: e.target.value,
                  })
                }
                placeholder="Enter phone number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Store Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Address
              </label>
              <AddressAutocomplete
                value={editingCustomer.storeAddress || ""}
                onChange={(value) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    storeAddress: value,
                  })
                }
                placeholder="Enter store address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>
          </div>

          <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Passwords aren't changed here. Use <strong>Reset Password</strong> on the customer's card to email them a link,
            or they can change it under <strong>My Profile</strong>.
          </p>
        </div>
      </StyleModalShell>
    </>
  );
}

export default EditCustomerModal;