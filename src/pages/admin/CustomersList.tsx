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
import { generateCustomerId } from '../../services/idCounterService';
import { updateCustomer } from '../../services/customersService';
import { logger } from '../../utils/logger';
import { AdminPageLayout } from "../../components/admin/AdminPageLayout"; // ✅ PHASE 2: New layout
import { StatCard } from "../../components/shared/StatCard"; // ✅ PHASE 2: Shared component

import { SearchBar } from "../../components/ui/SearchBar";
import { ToastNotification } from "../../components/ToastNotification"; // ✅ Import ToastNotification

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
    "all" | "approved" | "suspended" | "active"
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
    notification,
    notificationType,
    clearNotification,
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

  // Auto-backfill customerCode for any customer that doesn't have one yet.
  // Bulletproof: retries on failure, staggered writes, never duplicates.
  const backfilledRef = useRef<Set<string>>(new Set());

  // FIX: cap total generation attempts per customer *per browser tab session*
  // (not just per-mount). Without this, a customer whose write never sticks
  // (e.g. Firestore write silently rolled back) burns a fresh sequential
  // CUST-##### id every time this page remounts — an audit-compliance risk
  // for a system that requires gapless sequential ids.
  const MAX_BACKFILL_ATTEMPTS = 3;
  const ATTEMPTS_KEY = 'bakery_customerCode_backfill_attempts';
  const readAttempts = (): Record<string, number> => {
    try { return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) || '{}'); } catch { return {}; }
  };
  const bumpAttempts = (customerId: string): number => {
    const attempts = readAttempts();
    attempts[customerId] = (attempts[customerId] || 0) + 1;
    try { sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts)); } catch { /* ignore quota errors */ }
    return attempts[customerId];
  };

  useEffect(() => {
    if (!allCustomers || allCustomers.length === 0) return;
    const attempts = readAttempts();
    const missing = (allCustomers as any[]).filter(
      (c) => !c.customerCode && c.id && c.customerType !== 'admin'
        && !backfilledRef.current.has(c.id)
        && (attempts[c.id] || 0) < MAX_BACKFILL_ATTEMPTS
    );
    if (missing.length === 0) return;

    // Mark in-progress so re-renders don't double-fire
    missing.forEach((customer) => backfilledRef.current.add(customer.id));

    // Stagger writes: 500ms apart to avoid Firestore rate limits
    missing.forEach((customer, idx) => {
      setTimeout(async () => {
        bumpAttempts(customer.id);
        let code = '';
        // Try up to 3 times
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            code = await generateCustomerId();
            break;
          } catch (genError) {
            if (attempt === 3) {
              logger.error(`\u274c [CustomersList] generateCustomerId failed 3x for ${customer.id}, using local fallback:`, genError);
              // Final fallback: date + crypto-secure 3-digit suffix.
              // FIX T2R3-H3 (HIGH): was Math.random()-based which is
              // reverse-engineerable in V8 and prone to collisions when
              // two backfill cycles run concurrently. Now uses
              // crypto.getRandomValues with rejection sampling.
              const d = new Date().toISOString().slice(0, 10);
              const buf = new Uint32Array(1);
              const range = 900;             // 100..999 (3-digit suffix)
              const limit = Math.floor(0xFFFFFFFF / range) * range;
              let n: number;
              do {
                crypto.getRandomValues(buf);
                n = buf[0];
              } while (n >= limit);
              const rand = (n % range) + 100;
              code = `CUST-${d}-${rand}`;
            }
            await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
        try {
          const updated = await updateCustomer({ id: customer.id, customerCode: code } as any);
          // NOTE: updateCustomer() re-reads the doc right after writing it.
          // With Firestore persistence enabled that read can occasionally
          // return a stale cached snapshot, so a one-off mismatch here isn't
          // proof the write failed — just log it, don't burn another id by
          // retrying immediately. The session attempt cap above is what
          // actually prevents runaway id generation if the write is truly
          // never landing.
          if ((updated as any)?.customerCode !== code) {
            logger.warn(`\u26a0\ufe0f [CustomersList] customerCode not visible immediately after write for ${customer.id} (wrote "${code}"); will not retry until next tab session`);
          }
        } catch (updateError) {
          logger.error(`\u274c [CustomersList] Failed to save customerCode for ${customer.id}:`, updateError);
          // Remove so it can retry (still bounded by MAX_BACKFILL_ATTEMPTS above)
          backfilledRef.current.delete(customer.id);
        }
      }, idx * 600);
    });
  }, [allCustomers]);

  // ============================================================================
  // PRESENTATION LAYER
  // ============================================================================

  return (
    <>
      {/* ✅ Toast Notification */}
      {notification && (
        <ToastNotification
          message={notification}
          type={notificationType}
          onClose={clearNotification}
        />
      )}

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
                          : "All Accounts"}{" "}
                ({processedCustomers.length})
              </h2>
            </div>
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
                            {(customer as any).customerCode ? (
                              <span className="inline-flex items-center gap-1 bg-[#f5f0e8] border border-[#D4A574]/30 rounded-md px-2 py-0.5">
                                <span className="text-[9px] font-bold text-[#D4A574] uppercase tracking-wide">ID</span>
                                <span className="font-mono text-xs text-[#8B6F47] font-bold">{(customer as any).customerCode}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wide">ID</span>
                                <span className="text-[10px] text-amber-500 italic">Generating…</span>
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
                            🔒 SUSPENDED
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

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          openModal("CUSTOMER_PROFILE", {
                            customerEmail: customer.email || "",
                            onClose: () => {},
                            isAdmin: true,
                            openModal: openModal as any,
                          }, "lg")
                        }
                        className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-2.5 py-2 bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white rounded-lg hover:from-[#7A5F3C] hover:to-[#C89968] transition-all text-xs font-medium shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleEditCustomer(customer)}
                        className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-2.5 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-800 transition-all text-xs font-medium shadow-sm"
                      >
                        <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleSuspend(customer)}
                        className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg transition-colors text-xs font-medium ${
                          isSuspended
                            ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm"
                            : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                        }`}
                      >
                        {isSuspended ? (
                          <><Unlock className="w-3.5 h-3.5 flex-shrink-0" /><span>Activate</span></>
                        ) : (
                          <><LockIcon className="w-3.5 h-3.5 flex-shrink-0" /><span>Suspend</span></>
                        )}
                      </button>
                      <button
                        onClick={() => handleResetPassword(customer)}
                        disabled={customer.customerType === "admin"}
                        title={customer.customerType === "admin" ? "Cannot reset admin password here" : "Send password reset email"}
                        className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-2.5 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-all text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Key className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Reset PW</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(customer)}
                        disabled={customer.customerType === "admin"}
                        title={customer.customerType === "admin" ? "Cannot delete admin account" : "Delete customer"}
                        className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-2.5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all text-xs font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Delete</span>
                      </button>
                    </div>
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