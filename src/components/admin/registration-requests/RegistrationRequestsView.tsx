/**
 * Customer registration requests view.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Pagination } from '../../ui/pagination';
import {
  UserPlus,
  CheckCircle,
  XCircle,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Lock
} from 'lucide-react';
import { ToastNotification } from '../../ToastNotification';
import { StatCard } from '../../shared/StatCard';
import { AddCustomerModal } from './AddCustomerModal';
import { AdminPageLayout } from '../AdminPageLayout';
import type {
  PendingRegistration,
  NewCustomer,
  AccountStats,
} from '../../../hooks/admin/useRegistrationRequestsData';

// ============================================================================
// TYPES
// ============================================================================

export interface RegistrationRequestsViewProps {
  // Data
  pendingRegistrations: PendingRegistration[];
  stats: AccountStats;
  
  // UI state
  notification: string;
  showAddCustomer: boolean;
  isAddingAdmin: boolean;
  newCustomer: NewCustomer;
  showAdminPassword: boolean;
  
  // Actions
  onAddAccount: () => void;
  onApprove: (registration: PendingRegistration) => void;
  onReject: (registrationId: string) => void;
  onCloseNotification: () => void;
  
  // Modal actions
  onCloseAddCustomer: () => void;
  onSaveCustomer: () => void;
  onCustomerChange: (customer: NewCustomer) => void;
  onTogglePasswordVisibility: () => void;
  onSelectCustomerType: (type: 'commercial' | 'individual') => void;
  onStartAdminCreation: () => void;
  
  // User info
  user: any;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RegistrationRequestsView({
  pendingRegistrations: allPendingRegistrations,
  stats,
  notification,
  showAddCustomer,
  isAddingAdmin,
  newCustomer,
  showAdminPassword,
  onAddAccount,
  onApprove,
  onReject,
  onCloseNotification,
  onCloseAddCustomer,
  onSaveCustomer,
  onCustomerChange,
  onTogglePasswordVisibility,
  onSelectCustomerType,
  onStartAdminCreation,
  user,
}: RegistrationRequestsViewProps): JSX.Element | null {
  
  const formatDate = (dateString: any) => {
    if (!dateString) return 'Date not available';
    // Handle Firestore Timestamp objects
    let date: Date;
    if (dateString?.toDate) {
      date = dateString.toDate();
    } else if (dateString?.seconds) {
      date = new Date(dateString.seconds * 1000);
    } else {
      date = new Date(dateString);
    }
    if (isNaN(date.getTime())) return 'Date not available';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // ── Pagination ────────────────────────────────────────────────────────
  const REG_PAGE_SIZE = 10;
  const [regPage, setRegPage] = useState(1);
  const regTotalPages = Math.max(1, Math.ceil(allPendingRegistrations.length / REG_PAGE_SIZE));
  // Reset to page 1 when list changes (after approve/reject)
  useEffect(() => { setRegPage(1); }, [allPendingRegistrations.length]);
  const pendingRegistrations = useMemo(() => {
    const start = (regPage - 1) * REG_PAGE_SIZE;
    return allPendingRegistrations.slice(start, start + REG_PAGE_SIZE);
  }, [allPendingRegistrations, regPage]);

  return (
    <AdminPageLayout
      icon={UserPlus}
      title="Customer Accounts"
      subtitle="Review and approve customer accounts"
      sectionTitle="Accounts Overview"
      onRefresh={undefined}
    >
      {/* Notification - Portal-based, always visible in viewport */}
      {notification && (
        <ToastNotification
          message={notification}
          onClose={onCloseNotification}
        />
      )}

      {/* Action button kept as page-level CTA while shell remains shared */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={onAddAccount}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#D4A574] text-white font-medium rounded-lg hover:shadow-md transition-all flex-shrink-0"
        >
          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Add Account</span>
        </button>
      </div>

      {/* Statistics Cards - Shared StatCard component */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard icon={Building2} label="Commercial" value={stats.commercialCount} color="orange" />
        <StatCard icon={User}      label="Individuals" value={stats.individualCount} color="blue" />
        <StatCard icon={Lock}      label="Admins"      value={stats.adminCount}      color="green" />
      </div>

      {/* Account Requests List */}
      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">
            Pending Accounts ({allPendingRegistrations.length})
          </h2>
        </div>

        <div className="p-6">
          {allPendingRegistrations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-[#E8C4A2] bg-opacity-30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-[#4CAF50]" />
              </div>
              <h3 className="text-neutral-700 text-xl font-bold mb-2">
                No New Account Requests
              </h3>
              <p className="text-neutral-500">
                All account requests have been processed
              </p>
            </div>
          ) : (
            <div data-reg-list-top="" className="scroll-mt-4 space-y-4">
              {pendingRegistrations.map((registration) => (
                <div
                  key={registration.id}
                  className="border-2 border-[#E8C4A2] rounded-lg p-6 hover:border-[#D4A574] transition-colors bg-gradient-to-br from-white to-[#F5E9D9]"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-5 h-5 text-[#D4A574]" />
                          <span className="text-[#333333] opacity-70 text-sm">
                            Store/Business Name
                          </span>
                        </div>
                        <div className="text-[#333333] font-bold text-lg">
                          {registration.storeName}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-5 h-5 text-[#D4A574]" />
                          <span className="text-[#333333] opacity-70 text-sm">
                            Contact Person
                          </span>
                        </div>
                        <div className="text-[#333333]">
                          {registration.contactPerson}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="w-5 h-5 text-[#D4A574]" />
                          <span className="text-[#333333] opacity-70 text-sm">
                            Email
                          </span>
                        </div>
                        <div className="text-[#333333]">
                          {registration.email}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-5 h-5 text-[#D4A574]" />
                          <span className="text-[#333333] opacity-70 text-sm">
                            Phone
                          </span>
                        </div>
                        <div className="text-[#333333]">
                          {registration.phone}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-5 h-5 text-[#D4A574]" />
                          <span className="text-[#333333] opacity-70 text-sm">
                            Address
                          </span>
                        </div>
                        <div className="text-[#333333]">
                          {registration.storeAddress}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[#333333] opacity-70 text-xs flex-shrink-0">
                          Type:
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-semibold ${
                            registration.customerType === 'commercial'
                              ? 'bg-[#2196F3]'
                              : 'bg-[#9C27B0]'
                          }`}
                        >
                          {registration.customerType === 'commercial'
                            ? '🏢 Commercial'
                            : '👤 Individual'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#E8C4A2]">
                    <div className="text-[#333333] opacity-60 text-sm">
                      Requested on:{' '}
                      {formatDate(
                        registration.registeredAt || registration.requestedAt || ''
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mt-6">
                    <button
                      onClick={() => onApprove(registration)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#4CAF50] text-white rounded-xl hover:bg-[#45a049] active:scale-95 transition-all shadow-md font-semibold text-sm tracking-wide"
                    >
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      Approve & Activate
                    </button>
                    <button
                      onClick={() => onReject(registration.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#F44336] text-white rounded-xl hover:bg-[#da190b] active:scale-95 transition-all shadow-md font-semibold text-sm tracking-wide"
                    >
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      Reject Request
                    </button>
                  </div>
                </div>
              ))}
              <Pagination
                currentPage={regPage}
                totalPages={regTotalPages}
                totalItems={allPendingRegistrations.length}
                pageSize={REG_PAGE_SIZE}
                onPageChange={(p) => { 
                  setRegPage(p);
                  const el = document.querySelector('[data-reg-list-top]');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                itemLabel="requests"
                className="mt-6"
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        isAddingAdmin={isAddingAdmin}
        newCustomer={newCustomer}
        showAdminPassword={showAdminPassword}
        onClose={onCloseAddCustomer}
        onSave={onSaveCustomer}
        onCustomerChange={onCustomerChange}
        onTogglePasswordVisibility={onTogglePasswordVisibility}
        onSelectCustomerType={onSelectCustomerType}
        onStartAdminCreation={onStartAdminCreation}
      />

      {/* Admin creation is now protected by AuthGuardModal — no inline verification needed */}
    </AdminPageLayout>
  );
}