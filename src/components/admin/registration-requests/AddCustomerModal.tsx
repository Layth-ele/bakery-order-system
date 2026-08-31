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
import { X, Save, Building2, User, Lock, Eye, EyeOff } from 'lucide-react';
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
  if (!isOpen) return null;
  
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 z-modal-backdrop"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col z-modal-content">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h2 className="text-[#333333] text-lg sm:text-xl font-bold">
            {isAddingAdmin ? 'ADD NEW ADMIN' : 'ADD NEW CUSTOMER'}
          </h2>
          <button
            onClick={onClose}
            className="text-[#333333] hover:text-white transition-colors"
            type="button"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Customer Type Tabs (Only for non-admin) */}
          {!isAddingAdmin && (
            <div className="mb-6 bg-gradient-to-br from-white to-[#F5E9D9] rounded-xl p-4 border-2 border-[#D4A574]/30">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onSelectCustomerType('commercial')}
                  className={`px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 ${
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
                  className={`px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 ${
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
                  className="px-3 sm:px-4 py-3 sm:py-4 rounded-lg border-2 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 bg-white border-[#D4A574]/50 text-[#333333] hover:border-[#FF9800]"
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
                {isAddingAdmin ? 'Admin Password' : 'Temporary Password'}
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={newCustomer.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onCustomerChange({ ...newCustomer, password: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#2196F3] text-sm sm:text-base pr-10"
                  placeholder="Minimum 6 characters"
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
                  ? 'Choose a secure password for the admin account'
                  : 'Customer can change this password after first login'}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t-2 border-[#E8C4A2]">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-neutral-700/50 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors font-medium"
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#4CAF50] to-[#45a049] text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2"
              type="button"
            >
              <Save className="w-4 h-4" />
              {isAddingAdmin ? 'Create Admin' : 'Create Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
