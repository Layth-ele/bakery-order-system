/**
 * Customers List Component
 *
 * ✅ PHASE 2: Migrated to AdminPageLayout (March 10, 2026)
 *
 * CHANGES:
 * - Now uses AdminPageLayout component for consistent structure
 * - Replaced inline stat cards with shared StatCard component
 * - 100% design system compliance
 * - Reduced code by ~100 lines
 *
 * PREVIOUS REFACTORING:
 * - PHASE 2: Admin Pages Standardization - REFACTORED (March 8, 2026)
 * - BEFORE: ~600 lines (mixed concerns with embedded logic)
 * - AFTER: ~200 lines (thin orchestration layer only)
 *
 * ARCHITECTURE (Data-Logic-View Pattern):
 * - Data Layer: useCustomersData() hook
 * - Actions Layer: useCustomerActions() hook
 * - This file: Orchestration and presentation
 *
 * EXTRACTED MODULES:
 * - useCustomersData() - Filtering, sorting, statistics
 * - useCustomerActions() - Suspend, edit, delete, password reset
 */

import {Building2, Edit2, Eye, Key, Lock as LockIcon, Mail, MapPin, Phone, RefreshCw, Trash2, Unlock, Users, User as UserIcon} from 'lucide-react';
import { scrollToElement } from '../../utils/scrollUtils';
import {useState, useRef, useEffect} from "react"
import { useCustomersData } from "../../hooks/admin/useCustomersData"; // ✅ PHASE 2: Import hook
import { useCustomerActions } from "../../hooks/admin/useCustomerActions"; // ✅ PHASE 2: Import hook
import { useModal } from "../../contexts/ModalContextNew"; // ✅ PHASE 2: Import modal context
import { usePaginatedOrders } from "../../hooks/usePaginatedOrders";
import { Pagination } from "../../components/ui/pagination";
import type { User } from "../../services/firebase/authService"; // ✅ Import User type from authService
import { withAdminGuard } from "../../guards/adminGuards";
import { CopyButton } from '../../components/shared/CopyButton';
import { AdminPageLayout } from "../../components/admin/AdminPageLayout"; // ✅ PHASE 2: New layout
import { StatCard } from "../../components/shared/StatCard"; // ✅ PHASE 2: Shared component

import { SearchBar } from "../../components/ui/SearchBar";

// ✅ PHASE 2: Import helper functions (assuming they exist)
import {
  getCustomerTypeBadge,
  isCustomerSuspended,
  isCustomerArchived,
  formatCustomerDate,
} from "../../utils/customerHelpers";

interface CustomersListProps {
  isActive?: boolean;
  user: User;
  onLogout?: () => void;
  onBack: () => void;
  setCurrentPage?: (page: any) => void;
}

function CustomersListComponent({
  isActive,
  user,
  onBack,
}: CustomersListProps) {
  // ============================================================================
  // FILTER STATE (UI-only state stays in component)
  // ============================================================================

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "commercial" | "individual" | "admin"
  >("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "suspended" | "active" | "archived"
  >("all");

  // ============================================================================
  // DATA LAYER - Fetch and process customer data
  // ============================================================================

  const { allCustomers, customersLoading, processedCustomers, stats } =
    useCustomersData({
      isActive: isActive ?? false,
      searchTerm,
      filterType,
      filterStatus,
    });

  // ============================================================================
  // ACTIONS LAYER - Customer action handlers
  // ============================================================================

  const {
    copiedAddress,
    handleToggleSuspend,
    handleEditCustomer,
    handleDeleteCustomer,
    handleResetPassword,
    handleCopyAddress,
    handleRefresh,
  } = useCustomerActions({ user });

  // ============================================================================
  // MODAL CONTEXT (for nested modals in customer profile)
  // ============================================================================

  const { openModal } = useModal();
  const listTopRef = useRef<HTMLDivElement>(null);

  // ── Pagination ──────────────────────────────────────────────────────────
  const PAGE_SIZE = 15;
  const {
    currentItems: pagedCustomers,
    currentPage,
    totalPages,
    totalItems,
    handlePageChange,
  } = usePaginatedOrders(processedCustomers, PAGE_SIZE);
  
  // Smart scroll to list top on page change
  useEffect(() => {
    if (currentPage > 1 && listTopRef.current) {
      scrollToElement(listTopRef.current, 8);
    }
  }, [currentPage]);

  // ============================================================================
  // PRESENTATION LAYER
  // ============================================================================

  return (
    <>
      <AdminPageLayout
        icon={Users}
        title="Customer Management"
        subtitle="Manage all customer accounts and permissions"
        sectionTitle="Customer Overview"
        onRefresh={handleRefresh}
      >
        {/* Search Bar */}
        <div className="bg-white rounded-xl border border-[#D4A574]/30 shadow-sm p-3 sm:p-4 mb-4 sm:mb-5">
          <SearchBar
            placeholder="Search by name, email, phone, or ID..."
            value={searchTerm}
            onChange={setSearchTerm}
            variant="luxury"
          />
        </div>

        {/* ── Overview Cards — 5 clickable filters, fully responsive ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Active */}
          <StatCard
            icon={Users}
            label="Active"
            value={stats.active}
            color="tan"
            onClick={() => { setFilterType("all"); setFilterStatus("active"); }}
            isActive={filterType === "all" && filterStatus === "active"}
          />
          {/* Commercial */}
          <StatCard
            icon={Building2}
            label="Commercial"
            value={stats.commercial}
            color="blue"
            onClick={() => { setFilterType("commercial"); setFilterStatus("all"); }}
            isActive={filterType === "commercial"}
          />
          {/* Individual */}
          <StatCard
            icon={UserIcon}
            label="Individual"
            value={stats.individual}
            color="purple"
            onClick={() => { setFilterType("individual"); setFilterStatus("all"); }}
            isActive={filterType === "individual"}
          />
          {/* Suspended */}
          <StatCard
            icon={LockIcon}
            label="Suspended"
            value={stats.suspended}
            color="red"
            onClick={() => { setFilterType("all"); setFilterStatus("suspended"); }}
            isActive={filterType === "all" && filterStatus === "suspended"}
          />
          {/* Admin */}
          <StatCard
            icon={UserIcon}
            label="Admin"
            value={stats.admin}
            color="teal"
            onClick={() => { setFilterType("admin"); setFilterStatus("all"); }}
            isActive={filterType === "admin"}
          />
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4A574]" />
              <h2 className="text-base sm:text-lg font-bold text-[#8B6F47]">
                {filterType === "admin"
                  ? "Admin Accounts"
                  : filterType === "commercial"
                    ? "Commercial Accounts"
                    : filterType === "individual"
                      ? "Individual Accounts"
                      : filterStatus === "suspended"
                        ? "Suspended Accounts"
                        : filterStatus === "active"
                          ? "Active Accounts"
                          : filterStatus === "archived"
                            ? "Archived Accounts"
                            : "All Accounts"}{" "}
                ({processedCustomers.length})
              </h2>
            </div>
            {stats.archived > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterType("all");
                  setFilterStatus(filterStatus === "archived" ? "all" : "archived");
                }}
                className="text-xs font-semibold text-[#8B6F47] underline underline-offset-2 hover:text-[#5d4a2f]"
              >
                {filterStatus === "archived" ? "Back to all accounts" : `Archived accounts (${stats.archived})`}
              </button>
            )}
          </div>

          {customersLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 text-[#D4A574] animate-spin mx-auto mb-4" />
              <p className="text-gray-600">
                Loading customers...
              </p>
            </div>
          ) : processedCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                No Customers Found
              </h3>
              <p className="text-sm text-gray-500">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "No customers match the selected filters"}
              </p>
            </div>
          ) : (
            <div ref={listTopRef} className="scroll-mt-4 space-y-4">
              {pagedCustomers.map((customer) => {
                const typeBadge =
                  getCustomerTypeBadge(customer as any);
                const isSuspended =
                  isCustomerSuspended(customer as any);
                const isArchived =
                  isCustomerArchived(customer as any);

                return (
                  <div
                    key={customer.id}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      isSuspended
                        ? "border-[#F44336] bg-[#FFEBEE]"
                        : "border-[#D4A574]/30 bg-white hover:border-[#D4A574] hover:shadow-md"
                    }`}
                  >
                    {/* Header: Name + Badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center`}
                          style={{
                            backgroundColor: `${typeBadge.color}20`,
                          }}
                        >
                          {customer.customerType === "admin" ? (
                            <LockIcon
                              className="w-5 h-5"
                              style={{ color: typeBadge.color }}
                            />
                          ) : customer.customerType ===
                            "commercial" ? (
                            <Building2
                              className="w-5 h-5"
                              style={{ color: typeBadge.color }}
                            />
                          ) : (
                            <UserIcon
                              className="w-5 h-5"
                              style={{ color: typeBadge.color }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-[#333] truncate">
                            {customer.storeName}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {(customer as any).customerCode && (
                              <span className="inline-flex max-w-full items-center gap-1 bg-[#f5f0e8] border border-[#D4A574]/30 rounded-md pl-2 pr-0.5">
                                <span className="text-[11px] font-bold text-[#D4A574] uppercase tracking-wide">ID</span>
                                <span className="truncate whitespace-nowrap font-mono text-xs text-[#8B6F47] font-bold">{(customer as any).customerCode}</span>
                                <CopyButton text={(customer as any).customerCode} label="Customer ID" className="h-7 w-7 text-[#8B6F47] hover:bg-[#D4A574]/20" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        {/* Customer Type Badge - Icon only on mobile, full text on desktop */}
                        <span
                          className="px-2 sm:px-3 py-1 rounded-full text-white text-xs font-bold flex items-center justify-center gap-1.5"
                          style={{
                            backgroundColor: typeBadge.color,
                          }}
                        >
                          {/* Icon (always visible) */}
                          {customer.customerType === "admin" ? (
                            <LockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : customer.customerType === "commercial" ? (
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          {/* Label (hidden on mobile, visible on desktop) */}
                          <span className="hidden sm:inline whitespace-nowrap">
                            {typeBadge.label}
                          </span>
                        </span>
                        {isSuspended && (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-semibold">
                            {isArchived ? '📦 ARCHIVED' : '🔒 SUSPENDED'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      {/* Left Column */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                          <span className="text-xs text-gray-600">
                            Contact:
                          </span>
                          <span className="text-sm text-[#333] truncate">
                            {customer.contactPerson}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                          <span className="text-xs text-gray-600">
                            Email:
                          </span>
                          <span className="text-sm text-[#333] truncate">
                            {customer.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                          <span className="text-xs text-gray-600">
                            Phone:
                          </span>
                          <span className="text-sm text-[#333]">
                            {customer.phone}
                          </span>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-2.5">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-[#D4A574] flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <span className="text-xs text-gray-600">
                              Address:
                            </span>
                            <div className="flex items-start gap-2">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.storeAddress ?? '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 text-xs text-[#2196F3] hover:text-[#1976D2] underline break-words"
                                title={customer.storeAddress}
                              >
                                {customer.storeAddress}
                              </a>
                              <button
                                onClick={() =>
                                  handleCopyAddress(
                                    customer.storeAddress ?? '',
                                  )
                                }
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-[#D4A574]/20 text-[#8B6F47] border border-[#D4A574]/40 rounded-lg hover:bg-[#D4A574]/30 transition-all"
                                title="Copy address"
                              >
                                {copiedAddress ===
                                customer.storeAddress ? (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Approval Info */}
                    {customer.approvedAt && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-[#E3F2FD] to-[#F3E5F5] rounded-lg border-2 border-[#2196F3]/30">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-[#4CAF50]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-gray-600">
                              Approved:
                            </span>
                            <span className="font-semibold text-[#333]">
                              {formatCustomerDate(
                                customer.approvedAt,
                              )}
                            </span>
                          </div>
                          {(customer as any).approvedBy && (
                            <div className="flex items-center gap-2">
                              <UserIcon className="w-4 h-4 text-[#9C27B0]" />
                              <span className="text-gray-600">
                                By:
                              </span>
                              <span className="font-semibold text-[#333]">
                                {(customer as any).approvedBy}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons — archived accounts can only be viewed or deleted for good */}
                    {(() => {
                      const isSelf = customer.id === user.id;
                      const btn = "flex-1 min-w-[90px] min-h-[40px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg transition-all text-xs font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed";
                      return (
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          <button
                            onClick={() => openModal("CUSTOMER_PROFILE", {
                              customerEmail: customer.email || "",
                              onClose: () => {},
                              isAdmin: true,
                              openModal: openModal as any,
                            }, "lg")}
                            className={`${btn} bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C89968]`}
                          >
                            <Eye className="w-3.5 h-3.5 flex-shrink-0" /><span>View</span>
                          </button>
                          {!isArchived && (
                            <>
                              <button onClick={() => handleEditCustomer(customer)} className={`${btn} bg-neutral-700 text-white hover:bg-neutral-800`}>
                                <Edit2 className="w-3.5 h-3.5 flex-shrink-0" /><span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleToggleSuspend(customer)}
                                disabled={isSelf}
                                title={isSelf ? "You can't suspend your own account" : undefined}
                                className={`${btn} ${isSuspended ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-amber-500 text-white hover:bg-amber-600"}`}
                              >
                                {isSuspended
                                  ? <><Unlock className="w-3.5 h-3.5 flex-shrink-0" /><span>Reactivate</span></>
                                  : <><LockIcon className="w-3.5 h-3.5 flex-shrink-0" /><span>Suspend</span></>}
                              </button>
                              <button
                                onClick={() => handleResetPassword(customer)}
                                disabled={isSuspended}
                                title={isSuspended ? "Reactivate the account first" : "Email a password reset link"}
                                className={`${btn} bg-sky-700 text-white hover:bg-sky-800`}
                              >
                                <Key className="w-3.5 h-3.5 flex-shrink-0" /><span>Reset Password</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={isSelf}
                            title={isSelf ? "You can't delete your own account" : "Archive or delete this account"}
                            className={`${btn} bg-rose-600 text-white hover:bg-rose-700 ${isArchived ? "" : "col-span-2 sm:col-span-1"}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /><span>Delete</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
                itemLabel="customers"
                className="mt-6"
              />
            </div>
          )}
        </div>
      </AdminPageLayout>
    </>
  );
}

export const CustomersList = withAdminGuard(
  CustomersListComponent,
);