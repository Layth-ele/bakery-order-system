/**
 * useManageProductsData Hook
 * 🟢 HOOK - Data layer for ManageProducts page
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from ManageProducts.tsx (1051 lines)
 * - Manages all data fetching and state
 * - Uses TanStack Query for caching
 * 
 * Responsibilities:
 * - Product and category data fetching
 * - Loading states
 * - Category filtering
 * - Product statistics calculation
 * - UI state (notifications, deleted items)
 * 
 * Used by: /pages/admin/ManageProducts.tsx
 * Location: /hooks/admin/useManageProductsData.ts
 */

import { useState, useMemo, useEffect } from 'react';
import type { Product, Category } from '../../types';
import { useCachedProducts } from '../useCachedProducts';
import { useCachedCategories } from '../useCachedCategories';
import { useCacheInvalidation } from '../useCacheInvalidation';
import { DISCOUNTED_FILTER_ID, isLegacyDiscountCopy, isOnSale } from '../../utils/productDiscount';

/** Filter id for products whose category was deleted. */
export const NO_CATEGORY_FILTER_ID = '__no_category__';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductStats {
  totalCategories: number;
  totalProducts: number;
  discountedProducts: number;
  activeProducts: number;
}

export interface ManageProductsData {
  // Data
  products: Product[];
  categories: Category[];
  filteredProducts: Product[];
  /** Products whose category no longer exists. */
  orphanCount: number;
  stats: ProductStats;
  
  // Loading states
  productsLoading: boolean;
  categoriesLoading: boolean;
  loading: boolean;
  
  // UI state
  selectedCategory: string;
  notification: string;
  deletedProductId: string | null;
  
  // Actions
  setSelectedCategory: (categoryId: string) => void;
  setNotification: (message: string) => void;
  setDeletedProductId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Cache invalidation
  invalidateProducts: () => Promise<void>;
  invalidateCategories: () => Promise<void>;
  refetchProducts: () => Promise<any>;
  refetchCategories: () => Promise<any>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useManageProductsData(isActive: boolean): ManageProductsData {
  // ============================================================================
  // DATA FETCHING - TanStack Query cache
  // ============================================================================
  
  const {
    data: products = [],
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useCachedProducts();
  
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useCachedCategories();
  
  const { invalidateProducts, invalidateCategories } = useCacheInvalidation();
  
  // ============================================================================
  // LOCAL STATE - UI only
  // ============================================================================
  
  // BUG 5 FIX (HIGH): Was initialised to the hardcoded string 'cat-1', which breaks any
  // environment where Firestore category IDs are auto-generated (not 'cat-1').
  // The products table showed an empty list with no error. Fix: start empty and
  // set to the first real category once data arrives.
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Auto-select the first available category on first load
  useEffect(() => {
    if (selectedCategory === '' && categories.length > 0) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);
  const [notification, setNotification] = useState<string>('');
  const [deletedProductId, setDeletedProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Initialize demo data when page becomes active
  useEffect(() => {
    if (isActive) {
    }
  }, [isActive]);
  
  // ============================================================================
  // COMPUTED DATA - Memoized for performance
  // ============================================================================
  
  // Filter products based on selected category
  // Products whose category no longer exists — invisible under every
  // category tab, so they get their own "No category" filter to fix them.
  const orphanProducts = useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return products.filter((p) => !isLegacyDiscountCopy(p) && !ids.has(p.categoryId));
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    const real = products.filter((p) => !isLegacyDiscountCopy(p));
    if (selectedCategory === NO_CATEGORY_FILTER_ID) return orphanProducts;
    return selectedCategory === DISCOUNTED_FILTER_ID
      ? real.filter(isOnSale)
      : real.filter((p) => p.categoryId === selectedCategory);
  }, [products, selectedCategory, orphanProducts]);
  
  // Calculate statistics
  const stats = useMemo<ProductStats>(() => {
    const real = products.filter((p) => !isLegacyDiscountCopy(p));
    return {
      totalCategories: categories.filter((c) => c.id !== DISCOUNTED_FILTER_ID).length,
      totalProducts: real.length,
      discountedProducts: real.filter(isOnSale).length,
      activeProducts: real.filter((p) => p.available !== false).length,
    };
  }, [categories, products]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // Data
    products,
    categories,
    filteredProducts,
    orphanCount: orphanProducts.length,
    stats,
    
    // Loading states
    productsLoading,
    categoriesLoading,
    loading,
    
    // UI state
    selectedCategory,
    notification,
    deletedProductId,
    
    // Actions
    setSelectedCategory,
    setNotification,
    setDeletedProductId,
    setLoading,
    
    // Cache invalidation
    invalidateProducts,
    invalidateCategories,
    refetchProducts,
    refetchCategories,
  };
}
