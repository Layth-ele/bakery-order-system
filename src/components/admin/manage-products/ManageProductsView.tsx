/**
 * ManageProductsView Component
 * 🟢 COMPONENT - View layer for ManageProducts page
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from ManageProducts.tsx (1051 lines)
 * - Pure presentation component
 * - No business logic
 * 
 * Responsibilities:
 * - Render products management UI
 * - Statistics cards
 * - Categories grid
 * - Products table/cards
 * - Action buttons
 * 
 * Used by: /pages/admin/ManageProducts.tsx
 * Location: /components/admin/manage-products/ManageProductsView.tsx
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Pagination } from '../../ui/pagination';
import { Package, Plus, Edit2, Trash2, LayoutGrid, Tag, CheckCircle2, RefreshCw } from 'lucide-react';
import { StatCard } from '../../shared/StatCard';
import type { Product, Category } from '../../../types';
import type { ProductStats } from '../../../hooks/admin/useManageProductsData';
import { ToastNotification } from '../../ToastNotification';

// ============================================================================
// TYPES
// ============================================================================

export interface ManageProductsViewProps {
  // Data
  categories: Category[];
  filteredProducts: Product[];
  stats: ProductStats;
  
  // UI state
  selectedCategory: string;
  notification: string;
  deletedProductId: string | null;
  
  // Actions
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onCloseNotification: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ManageProductsView({
  categories,
  filteredProducts,
  stats,
  selectedCategory,
  notification,
  deletedProductId,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onSelectCategory,
  onCloseNotification,
  onRefresh,
  isRefreshing = false,
}: ManageProductsViewProps): JSX.Element | null {
  // ── Pagination ────────────────────────────────────────────────────────
  const MGMT_PAGE_SIZE = 15;
  const [mgmtPage, setMgmtPage] = useState(1);
  const mgmtTotalPages = Math.max(1, Math.ceil(filteredProducts.length / MGMT_PAGE_SIZE));
  // Reset to page 1 when filtered list changes (category/search filter applied)
  useEffect(() => { setMgmtPage(1); }, [filteredProducts.length]);
  const pagedMgmtProducts = useMemo(() => {
    const start = (mgmtPage - 1) * MGMT_PAGE_SIZE;
    return filteredProducts.slice(start, start + MGMT_PAGE_SIZE);
  }, [filteredProducts, mgmtPage]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Notification - Portal-based, always visible in viewport */}
      {notification && (
        <ToastNotification
          message={notification}
          onClose={onCloseNotification}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 sm:mb-6">
          {/* Top Section */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="icon-container-lg md:icon-container-xl flex-shrink-0 bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex items-center justify-center">
                <Package className="icon-lg md:icon-xl text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="heading-3 md:heading-2 font-bold text-[#8B6F47] leading-tight truncate">
                  Product Management
                </h1>
                <p className="body-xs text-neutral-500 truncate mt-0.5 hidden sm:block">
                  Manage all products and categories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#D4A574]/10 border border-[#D4A574]/40 rounded-xl transition-all shadow-sm disabled:opacity-50 active:scale-95"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`icon-md text-[#D4A574] transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="body-xs text-[#8B6F47] font-semibold hidden md:inline whitespace-nowrap">Refresh</span>
                </button>
              )}
              <button
                onClick={onAddCategory}
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 bg-gradient-to-r from-[#D4A574] to-[#C5956A] text-white font-medium rounded-lg hover:shadow-md transition-all text-sm"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Add Category</span>
              </button>
            </div>
          </div>

          {/* Section Header Bar */}
          <div className="rounded-b-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                Product Overview
              </h2>
            </div>
          </div>
        </div>

        {/* Statistics Cards — shared StatCard component */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          <StatCard icon={LayoutGrid}   label="Categories"  value={stats.totalCategories}   color="tan"    />
          <StatCard icon={Package}      label="Products"    value={stats.totalProducts}      color="blue"   />
          <StatCard icon={Tag}          label="On Sale"     value={stats.discountedProducts} color="orange" />
          <StatCard icon={CheckCircle2} label="Active"      value={stats.activeProducts}     color="green"  />
        </div>

        {/* Categories Management */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-[#D4A574]/30 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-[#D4A574]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h2 className="text-base sm:text-lg font-bold text-[#8B6F47]">
                CATEGORIES
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="border-2 border-[#E8C4A2] rounded-lg p-3 sm:p-4 hover:border-[#D4A574] transition-colors bg-gradient-to-br from-white to-[#FFF8F0]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm sm:text-base font-bold text-[#D4A574] flex-shrink-0">
                      {index + 1}.
                    </span>
                    <span className="text-sm sm:text-base font-medium text-[#333333] truncate">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => onEditCategory(category)}
                      className="p-1.5 sm:p-2 text-[#D4A574] hover:bg-[#E8C4A2] rounded transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteCategory(category.id)}
                      className="p-1.5 sm:p-2 text-[#F44336] hover:bg-[#F44336] hover:bg-opacity-10 rounded transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-[#D4A574]/30 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-6">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4A574]" />
            <h2 className="text-base sm:text-lg font-bold text-[#8B6F47]">
              PRODUCTS
            </h2>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm font-medium ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white shadow-md'
                    : 'bg-[#F5E9D9] text-[#333333] hover:bg-[#E8C4A2]'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Add Product Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onAddProduct}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm font-medium"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              ADD NEW PRODUCT
            </button>
          </div>

          <div className="overflow-x-auto">
            {/* Desktop Table View - Hidden on Mobile */}
            <table data-mgmt-list-top="" className="w-full hidden lg:table scroll-mt-4">
              <thead className="bg-[#E8C4A2]">
                <tr>
                  <th className="px-4 py-3 text-left text-[#333333]">Product</th>
                  <th className="px-4 py-3 text-left text-[#333333]">Cost</th>
                  <th className="px-4 py-3 text-left text-[#333333]">Retail</th>
                  <th className="px-4 py-3 text-left text-[#333333]">Discount</th>
                  <th className="px-4 py-3 text-left text-[#333333]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedMgmtProducts.map((product, index) => {
                  const hasDiscount = !!product.discount && product.discount > 0;
                  const discountedRetail: number = hasDiscount
                    ? (product.retail ?? product.price ?? 0) * (1 - product.discount! / 100)
                    : (product.retail ?? product.price ?? 0);

                  return (
                    <tr
                      key={product.id}
                      className={
                        index % 2 === 0
                          ? 'bg-white'
                          : 'bg-[#F5E9D9] bg-opacity-30'
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#333333]">{product.name}</span>
                          {hasDiscount && (
                            <span className="text-lg" title={`${product.discount}% OFF`}>
                              🔥
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#333333]">
                        ${(product.cost ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {hasDiscount ? (
                          <div>
                            <div className="text-[#888888] line-through text-sm">
                              ${(product.retail ?? 0).toFixed(2)}
                            </div>
                            <div className="text-[#FF5722] font-bold">
                              ${(discountedRetail ?? 0).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#333333]">
                            ${(product.retail ?? 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasDiscount ? (
                          <span className="text-[#FF5722] font-bold">
                            {product.discount}%
                          </span>
                        ) : (
                          <span className="text-[#888888]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 relative">
                          <button
                            onClick={() => onEditProduct(product)}
                            className="flex-1 px-4 py-2 bg-[#D4A574] text-white rounded-lg hover:bg-[#E8C4A2] transition-colors font-medium"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            className="flex-1 px-4 py-2 bg-[#F44336] text-white rounded-lg hover:bg-[#da190b] transition-colors font-medium"
                          >
                            DELETE
                          </button>

                          {/* Local Delete Notification */}
                          {deletedProductId === product.id && (
                            <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-[#F44336] text-white text-sm rounded-lg shadow-lg whitespace-nowrap animate-fade-in z-50">
                              🗑️ Product deleted!
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              currentPage={mgmtPage}
              totalPages={mgmtTotalPages}
              totalItems={filteredProducts.length}
              pageSize={MGMT_PAGE_SIZE}
              onPageChange={(p) => { 
                setMgmtPage(p);
                const el = document.querySelector('[data-mgmt-list-top]');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              itemLabel="products"
              className="mt-4 px-4 pb-4"
            />

            {/* Mobile Card View - Shown on Small Devices */}
            <div className="lg:hidden space-y-4">
              {pagedMgmtProducts.map((product) => {
                const hasDiscount = !!product.discount && product.discount > 0;
                const discountedRetail: number = hasDiscount
                  ? (product.retail ?? product.price ?? 0) * (1 - product.discount! / 100)
                  : (product.retail ?? product.price ?? 0);

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg border-2 border-[#E8C4A2] p-4 shadow-sm relative"
                  >
                    {/* Product Name */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-[#F5E9D9]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#333333] font-bold">
                          {product.name}
                        </span>
                        {hasDiscount && (
                          <span className="text-lg" title={`${product.discount}% OFF`}>
                            🔥
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Product Details Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {/* Cost */}
                      <div>
                        <div className="text-[#333333] opacity-60 text-xs mb-1">
                          Cost
                        </div>
                        <div className="text-[#333333] font-bold">
                          ${(product.cost ?? 0).toFixed(2)}
                        </div>
                      </div>

                      {/* Retail */}
                      <div>
                        <div className="text-[#333333] opacity-60 text-xs mb-1">
                          Retail
                        </div>
                        {hasDiscount ? (
                          <div>
                            <div className="text-[#888888] line-through text-xs">
                              ${(product.retail ?? 0).toFixed(2)}
                            </div>
                            <div className="text-[#FF5722] font-bold">
                              ${(discountedRetail ?? 0).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[#333333] font-bold">
                            ${(product.retail ?? 0).toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Discount */}
                      <div>
                        <div className="text-[#333333] opacity-60 text-xs mb-1">
                          Discount
                        </div>
                        {hasDiscount ? (
                          <div className="text-[#FF5722] font-bold">
                            {product.discount}%
                          </div>
                        ) : (
                          <div className="text-[#888888]">-</div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 relative">
                      <button
                        onClick={() => onEditProduct(product)}
                        className="flex-1 px-4 py-2 bg-[#D4A574] text-white rounded-lg hover:bg-[#E8C4A2] transition-colors font-medium"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => onDeleteProduct(product.id)}
                        className="flex-1 px-4 py-2 bg-[#F44336] text-white rounded-lg hover:bg-[#da190b] transition-colors font-medium"
                      >
                        DELETE
                      </button>

                      {/* Local Delete Notification */}
                      {deletedProductId === product.id && (
                        <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-[#F44336] text-white text-sm rounded-lg shadow-lg whitespace-nowrap animate-fade-in z-50">
                          🗑️ Product deleted!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
