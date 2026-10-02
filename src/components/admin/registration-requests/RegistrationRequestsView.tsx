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
  Lock,
  Clock
} from 'lucide-react';
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
  rejectedRegistrations: PendingRegistration[];
  stats: AccountStats;
  
  // UI state
  showAddCustomer: boolean;
  isAddingAdmin: boolean;
  newCustomer: NewCustomer;
  showAdminPassword: boolean;
  
  // Actions
  onAddAccount: () => void;
  onApprove: (registration: PendingRegistration) => void;
  onReject: (registration: PendingRegistration) => void;
  
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
  rejectedRegistrations,
  stats,
  showAddCustomer,
  isAddingAdmin,
  newCustomer,
  showAdminPassword,
  onAddAccount,
  onApprove,
  onReject,
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
      <div className="mb-4 flex justify-end">
        <button
          onClick={onAddAccount}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B6F47] to-[#D4A574] px-4 py-2 font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Counts — same definitions as Customer Management */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard icon={Clock} label="Pending" value={stats.pending} color="orange" />
        <StatCard icon={User} label="Active" value={stats.active} color="green" />
        <StatCard icon={Lock} label="Admins" value={stats.admins} color="teal" />
      </div>

      {/* Account Requests List */}
      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">
            Pending Accounts ({allPendingRegistrations.length})
          </h2>
        </div>

        <div className="p-3 sm:p-6">
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
                  className="border-2 border-[#E8C4A2] rounded-xl p-4 sm:p-6 hover:border-[#D4A574] transition-colors bg-gradient-to-br from-white to-[#F5E9D9]"
                >
                  <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
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
                      onClick={() => onReject(registration)}
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

      {/* Rejected requests — approve here if one was rejected by mistake */}
      {rejectedRegistrations.length > 0 && (
        <details className="mt-5 rounded-xl border-2 border-neutral-200 bg-white shadow-sm">
          <summary className="cursor-pointer select-none px-5 py-3.5 text-sm font-bold uppercase tracking-widest text-neutral-600">
            Rejected requests ({rejectedRegistrations.length})
          </summary>
          <ul className="divide-y divide-neutral-100 px-5 pb-3">
            {rejectedRegistrations.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-800">{r.storeName}</p>
                  <p className="truncate text-sm text-neutral-500">{r.contactPerson} · {r.email}</p>
                </div>
                <button
                  onClick={() => onApprove(r)}
                  className="flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#4CAF50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#45a049]"
                >
                  <CheckCircle className="h-4 w-4" /> Approve
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

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