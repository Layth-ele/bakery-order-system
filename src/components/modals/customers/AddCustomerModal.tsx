/**
 * AddCustomerModal - Admin can add new customer
 *
 * ✅ FEB 20, 2026: MOVED to /components/modals/customers/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 *
 * Allows admin to add new customers (commercial/individual) or create new admin accounts.
 * Includes customer type tabs, address autocomplete, and password visibility toggle.
 * Premium black and gold aesthetic matching the bakery theme.
 */

import React, { useState } from "react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { SaveFooter } from "../../../ui/modals/ModalFooterButtons";
import {
  UserPlus,
  Mail,
  Phone,
  User,
  MapPin,
  Building,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { AddressAutocomplete } from "../../AddressAutocomplete";

interface AddCustomerModalProps {
  isAddingAdmin: boolean;
  newCustomer: {
    storeName: string;
    email: string;
    storeAddress: string;
    contactPerson: string;
    phone: string;
    password: string;
    customerType: "commercial" | "individual" | "admin";
  };
  onCustomerChange: (customer: AddCustomerModalProps['newCustomer']) => void; // Properly typed
  onAddCustomer: () => void;
  onClose: () => void;
  onShowAdminSecurity: () => void;
  onSetIsAddingAdmin: (value: boolean) => void;
}

export const AddCustomerModal: React.FC<
  AddCustomerModalProps
> = ({
  isAddingAdmin,
  newCustomer,
  onCustomerChange,
  onAddCustomer,
  onClose,
  onShowAdminSecurity,
  onSetIsAddingAdmin,
}) => {
  const [showAdminPassword, setShowAdminPassword] =
    useState(false);

  const handleClose = () => {
    onClose();
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={handleClose}
      title={
        isAddingAdmin ? "ADD NEW ADMIN" : "ADD NEW CUSTOMER"
      }
      icon={<UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />}
      footer={
        <SaveFooter
          onCancel={handleClose}
          onSave={onAddCustomer}
          saveLabel={
            isAddingAdmin ? "Create Admin" : "Create Customer"
          }
        />
      }
    >
      <div className="space-y-4">
        {/* Customer Type Tabs (Only for non-admin) */}
        {!isAddingAdmin && (
          <div className="bg-gradient-to-br from-white to-[#F5E9D9] rounded-xl p-4 border-2 border-[#D4A574]/30">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() =>
                  onCustomerChange({
                    ...newCustomer,
                    customerType: "commercial",
                    storeName: "",
                  })
                }
                className={`px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 ${
                  newCustomer.customerType === "commercial"
                    ? "bg-[#2196F3] border-[#2196F3] text-white shadow-lg"
                    : "bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#2196F3]"
                }`}
              >
                <Building className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>COMMERCIAL</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onCustomerChange({
                    ...newCustomer,
                    customerType: "individual",
                    storeName: "",
                  })
                }
                className={`px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 ${
                  newCustomer.customerType === "individual"
                    ? "bg-[#9C27B0] border-[#9C27B0] text-white shadow-lg"
                    : "bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#9C27B0]"
                }`}
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>INDIVIDUAL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onShowAdminSecurity();
                  onSetIsAddingAdmin(true);
                }}
                className="px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#FF9800]"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>ADMIN</span>
              </button>
            </div>
          </div>
        )}

        {/* Commercial Form - Show Business Legal Name */}
        {!isAddingAdmin &&
          newCustomer.customerType === "commercial" && (
            <div>
              <label className="block text-[#333333] mb-2 text-sm sm:text-base">
                Business Legal Name
              </label>
              <input
                type="text"
                value={newCustomer.storeName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onCustomerChange({
                    ...newCustomer,
                    storeName: e.target.value,
                  })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
                placeholder="Enter business legal name"
              />
            </div>
          )}

        {/* Admin Form - Show Admin Name */}
        {isAddingAdmin && (
          <div>
            <label className="block text-[#333333] mb-2 text-sm sm:text-base">
              Admin Name
            </label>
            <input
              type="text"
              value={newCustomer.storeName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onCustomerChange({
                  ...newCustomer,
                  storeName: e.target.value,
                })
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
              placeholder="Enter admin full name"
            />
          </div>
        )}

        {/* Contact Person */}
        <div>
          <label className="block text-[#333333] mb-2 text-sm sm:text-base">
            {isAddingAdmin ? "Full Name" : "Contact Person"}
          </label>
          <input
            type="text"
            value={newCustomer.contactPerson}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCustomerChange({
                ...newCustomer,
                contactPerson: e.target.value,
              })
            }
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
            placeholder="Enter contact person name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-[#333333] mb-2 text-sm sm:text-base">
            Email
          </label>
          <input
            type="email"
            value={newCustomer.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCustomerChange({
                ...newCustomer,
                email: e.target.value,
              })
            }
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
            placeholder="Enter email address"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[#333333] mb-2 text-sm sm:text-base">
            Phone
          </label>
          <input
            type="tel"
            value={newCustomer.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onCustomerChange({
                ...newCustomer,
                phone: e.target.value,
              })
            }
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
            placeholder="604-123-4567"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-[#333333] mb-2 text-sm sm:text-base">
            Address
          </label>
          <AddressAutocomplete
            value={newCustomer.storeAddress}
            onChange={(value) =>
              onCustomerChange({
                ...newCustomer,
                storeAddress: value,
              })
            }
            placeholder="Enter full address"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-[#333333] mb-2 text-sm sm:text-base">
            {isAddingAdmin
              ? "Admin Password"
              : "Temporary Password"}
          </label>
          <div className="relative">
            <input
              type={showAdminPassword ? "text" : "password"}
              value={newCustomer.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onCustomerChange({
                  ...newCustomer,
                  password: e.target.value,
                })
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base pr-10"
              placeholder="Minimum 6 characters"
            />
            <button
              type="button"
              onClick={() =>
                setShowAdminPassword(!showAdminPassword)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D4A574] hover:text-[#8B7355]"
              aria-label={
                showAdminPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showAdminPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-[#666666] mt-1">
            {isAddingAdmin
              ? "Choose a secure password for the admin account"
              : "Customer can change this password after first login"}
          </p>
        </div>
      </div>
    </StyleModalShell>
  );
};