/**
 * 🎨 CompleteOrdersView - Presentational Component
 * 
 * ✅ UPDATED: March 10, 2026 - Migrated to AdminPageLayout + StatCard
 * 
 * CHANGES:
 * - Now uses AdminPageLayout for consistent structure
 * - Replaced 4 inline stat cards with StatCard component
 * - 100% design system compliance
 * - Consistent sizing with all other pages
 * 
 * ✅ PHASE 2: Business Logic Extraction
 * ✅ PERFORMANCE OPTIMIZED (March 7, 2026)
 * 
 * PURPOSE:
 * - Pure presentational component for complete/rejected/cancelled orders
 * - No business logic, no data fetching
 * - Receives data and callbacks via props
 * - Easy to test and maintain
 * 
 * ARCHITECTURE:
 * - Props in → JSX out
 * - All logic delegated to parent/hooks
 * - Reusable across different contexts
 * 
 * PERFORMANCE:
 * - React.memo to prevent unnecessary re-renders
 * - Static action buttons (not recreated per order)
 * - Optimized memoization dependencies
 */

import React, { useMemo } from 'react';
import {CheckCircle, XCircle, Ban, FileText, RefreshCw, History} from 'lucide-react'
import { UnifiedOrderList, ActionButtonSection } from './UnifiedOrderList';
import { AdminPageLayout } from '../admin/AdminPageLayout'; // ✅ Import layout
import { StatCard } from '../shared/StatCard'; // ✅ Import shared component
import { SearchBar } from '../ui/SearchBar'; // ✅ Import SearchBar
import type { Order, Product, Category, Customer } from '../../types';

interface CompleteOrdersStatistics {
  completed: Order[];
  rejected: Order[];
  cancelled: Order[];
  totalRevenue: number;
  totalOrders: number;
}

export interface CompleteOrdersViewProps {
  /** Filtered and sorted orders to display */
  orders: Order[];
  
  /** Products for display */
  products: Product[];
  
  /** Categories for display */
  categories: Category[];
  
  /** Statistics (counts, revenue) */
  statistics: CompleteOrdersStatistics;
  
  /** Search query */
  searchQuery: string;
  
  /** Selected year */
  selectedYear: number | 'all';
  
  /** Selected status */
  selectedStatus: string | 'all';
  
  /** Selected customer */
  selectedCustomer: string | 'all';
  
  /** Customers with historical orders */
  customersWithHistoricalOrders: Customer[];
  
  /** Available year options */
  yearOptions: number[];
  
  /** Action button sections for UnifiedOrderList */
  actionButtonSections: ActionButtonSection[];
  
  /** Loading state */
  loading: boolean;
  
  /** Set search query */
  onSearchChange: (query: string) => void;
  
  /** Set year filter */
  onYearChange: (year: number | 'all') => void;
  
  /** Set status filter */
  onStatusChange: (status: string | 'all') => void;
  
  /** Set customer filter */
  onCustomerChange: (customerId: string | 'all') => void;
  
  /** Refresh orders */
  onRefresh: () => void;
}

/**
 * Presentational component for displaying order history
 * 
 * @example
 * ```typescript
 * <CompleteOrdersView
 *   orders={filteredOrders}
 *   products={products}
 *   categories={categories}
 *   statistics={statistics}
 *   searchQuery={searchQuery}
 *   onSearchChange={setSearchQuery}
 *   onRefresh={handleRefresh}
 *   // ... other props
 * />
 * ```
 */
export function CompleteOrdersView({
  orders,
  products,
  categories,
  statistics,
  searchQuery,
  selectedYear,
  selectedStatus,
  selectedCustomer,
  customersWithHistoricalOrders,
  yearOptions,
  actionButtonSections,
  loading,
  onSearchChange,
  onYearChange,
  onStatusChange,
  onCustomerChange,
  onRefresh,
}: CompleteOrdersViewProps): JSX.Element | null {
  
  // ✅ Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 animate-spin text-gray-400" />
          <p className="text-gray-600">Loading order history...</p>
        </div>
      </div>
    );
  }
  
  // Check if filters are active
  const hasActiveFilters =
    searchQuery ||
    selectedYear !== 'all' ||
    selectedStatus !== 'all' ||
    selectedCustomer !== 'all';
  
  return (
    <AdminPageLayout
      icon={History}
      title="Order History"
      subtitle="View completed, rejected, and cancelled orders"
      sectionTitle="Historical Orders"
      onRefresh={onRefresh}
      isRefreshing={loading}
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Total Orders */}
          <StatCard
            label="Total Orders"
            value={statistics.totalOrders}
            icon={FileText}
            color="tan"
          />

          {/* Completed */}
          <StatCard
            label="Completed"
            value={statistics.completed.length}
            icon={CheckCircle}
            color="green"
          />

          {/* Rejected */}
          <StatCard
            label="Rejected"
            value={statistics.rejected.length}
            icon={XCircle}
            color="red"
          />

          {/* Cancelled */}
          <StatCard
            label="Cancelled"
            value={statistics.cancelled.length}
            icon={Ban}
            color="orange"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#D4A574]/30 shadow-sm p-3 sm:p-5 mb-3 sm:mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-1">
              <SearchBar
                placeholder="Search by order ID or week..."
                value={searchQuery}
                onChange={onSearchChange}
                variant="luxury"
                showClearButton
              />
            </div>

            {/* Year Filter */}
            <div>
              <select
                value={selectedYear}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onYearChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              >
                <option value="all">All Years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onStatusChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <select
                value={selectedCustomer}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCustomerChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              >
                <option value="all">All Customers</option>
                {customersWithHistoricalOrders
                  .filter((customer) => customer?.storeName || customer?.contactPerson)
                  .sort((a, b) =>
                    (a.storeName || a.contactPerson || '').localeCompare(
                      b.storeName || b.contactPerson || ''
                    )
                  )
                  .map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.storeName || customer.contactPerson}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              Historical Orders ({orders.length})
            </h2>
          </div>

          <div className="p-6">
            <UnifiedOrderList
              orders={orders}
              products={products}
              categories={categories}
              statusFilter="all"
              actionButtonSections={actionButtonSections}
              emptyStateMessage="No orders found"
              emptyStateSubtext={
                hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Historical orders will appear here'
              }
              emptyStateIcon={<History className="w-16 h-16 text-gray-300" />}
              hideSearch={true}
              sortOldestFirst={false}
              showHeader={false}
              useCompactLayout={true}
              hideCustomerName={false}
              isAdmin={true}
              pageTitle=""
              pageIcon={null}
            />
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}