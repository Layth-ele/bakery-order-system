/**
 * AddCustomerModal Component
 * 🟢 COMPONENT - Add customer/admin modal
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from RegistrationRequests.tsx (1081 lines)
 * - Pure presentation component for customer creation
 * 
 * Used by: RegistrationRequestsView
 * Location: /components/admin/registration-requests/AddCustomerModal.tsx
 */

import React from 'react';
import { Save, Building2, User, Lock, Eye, EyeOff } from 'lucide-react';
import { BaseModal } from '../../../ui/modals/BaseModal';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { SaveFooter } from '../../../ui/modals/ModalFooterButtons';
import { AddressAutocomplete } from '../../AddressAutocomplete';
import type { NewCustomer } from '../../../hooks/admin/useRegistrationRequestsData';

// ============================================================================
// TYPES
// ============================================================================

export interface AddCustomerModalProps {
  isOpen: boolean;
  isAddingAdmin: boolean;
  newCustomer: NewCustomer;
  showAdminPassword: boolean;
  onClose: () => void;
  onSave: () => void;
  onCustomerChange: (customer: NewCustomer) => void;
  onTogglePasswordVisibility: () => void;
  onSelectCustomerType: (type: 'commercial' | 'individual') => void;
  onStartAdminCreation: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddCustomerModal({
  isOpen,
  isAddingAdmin,
  newCustomer,
  showAdminPassword,
  onClose,
  onSave,
  onCustomerChange,
  onTogglePasswordVisibility,
  onSelectCustomerType,
  onStartAdminCreation,
}: AddCustomerModalProps): JSX.Element | null {
  // Rendered by RegistrationRequestsView (not ModalRoot), so it brings its
  // own BaseModal frame — same backdrop, sheet and panel as every modal.
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel={isAddingAdmin ? 'Add new admin' : 'Add new customer'}>
      <StyleModalShell
        width="xl"
        onClose={onClose}
        title={isAddingAdmin ? 'Add New Admin' : 'Add New Customer'}
        icon={isAddingAdmin ? Lock : User}
        footer={
          <SaveFooter
            onCancel={onClose}
            onSave={onSave}
            saveLabel={isAddingAdmin ? 'Create Admin' : 'Create Customer'}
            saveIcon={<Save className="w-4 h-4" />}
          />
        }
      >
          {/* Customer Type Tabs (Only for non-admin) */}
          {!isAddingAdmin && (
            <div className="mb-5 bg-gradient-to-br from-white to-[#F5E9D9] rounded-xl p-3 sm:p-4 border-2 border-[#D4A574]/30">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onSelectCustomerType('commercial')}
                  className={`min-h-[44px] px-2 sm:px-4 py-2.5 sm:py-4 rounded-lg border-2 transition-all text-[11px] sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                    newCustomer.customerType === 'commercial'
                      ? 'bg-[#2196F3] border-[#2196F3] text-white shadow-lg'
                      : 'bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#2196F3]'
                  }`}
                >
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>COMMERCIAL</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectCustomerType('individual')}
                  className={`min-h-[44px] px-2 sm:px-4 py-2.5 sm:py-4 rounded-lg border-2 transition-all text-[11px] sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                    newCustomer.customerType === 'individual'
                      ? 'bg-[#9C27B0] border-[#9C27B0] text-white shadow-lg'
                      : 'bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#9C27B0]'
                  }`}
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>INDIVIDUAL</span>
                </button>
                <button
                  type="button"
                  onClick={onStartAdminCreation}
                  className="min-h-[44px] px-2 sm:px-4 py-2.5 sm:py-4 rounded-lg border-2 transition-all text-[11px] sm:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#FF9800]"
                >
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>ADMIN</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Commercial Form - Show Business Legal Name */}
            {!isAddingAdmin && newCustomer.customerType === 'commercial' && (
              <div>
                <label className="block text-[#333333] mb-2 text-sm sm:text-base">
                  Business Legal Name
                </label>
                <input
                  type="text"
                  value={newCustomer.storeName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onCustomerChange({ ...newCustomer, storeName: e.target.value })
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
                    onCustomerChange({ ...newCustomer, storeName: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
                  placeholder="Enter admin full name"
                />
              </div>
            )}

            {/* Contact Person */}
            <div>
              <label className="block text-[#333333] mb-2 text-sm sm:text-base">
                {isAddingAdmin ? 'Full Name' : 'Contact Person'}
              </label>
              <input
                type="text"
                value={newCustomer.contactPerson}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onCustomerChange({ ...newCustomer, contactPerson: e.target.value })
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
                  onCustomerChange({ ...newCustomer, email: e.target.value })
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
                  onCustomerChange({ ...newCustomer, phone: e.target.value })
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
                  onCustomerChange({ ...newCustomer, storeAddress: value })
                }
                placeholder="Enter full address"
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#333333] mb-2 text-sm sm:text-base">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={newCustomer.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onCustomerChange({ ...newCustomer, password: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base pr-10"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D4A574] hover:text-[#8B7355]"
                  aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
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
                  ? 'They sign in with this password and can change it under My Profile.'
                  : 'Share it with the customer privately. They can change it under My Profile.'}
              </p>
            </div>
          </div>

      </StyleModalShell>
    </BaseModal>
  );
}
