/**
 * useOptimizedProducts Hook
 * 🟢 HOOK - Shared optimized product operations
 * 
 * REFACTORED - Phase 3: Shared Logic Extraction
 * - Reusable across customer and admin pages
 * - Performance optimized with useMemo
 * - Category filtering and search
 * 
 * Responsibilities:
 * - Product filtering by category
 * - Product search functionality
 * - Product sorting
 * - Memoized for performance
 * 
 * Performance Optimizations:
 * - useMemo for expensive filtering operations
 * - Prevents unnecessary recalculations
 * - Optimized for large product catalogs
 * 
 * Used by: Customer dashboard, Admin product management
 * Location: /hooks/shared/useOptimizedProducts.ts
 */

import { useMemo } from 'react';
import type { Product } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductFilters {
  categoryId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'price' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface OptimizedProducts {
  filteredProducts: Product[];
  productCount: number;
  categories: string[];
}

// ============================================================================
// HOOK
// ============================================================================

export function useOptimizedProducts(
  products: Product[],
  filters: ProductFilters = {}
): OptimizedProducts {
  
  const {
    categoryId,
    searchTerm,
    sortBy = 'name',
    sortOrder = 'asc',
  } = filters;
  
  // ============================================================================
  // MEMOIZED FILTERING - Performance optimization
  // ============================================================================
  
  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    // Filter by category
    if (categoryId && categoryId !== 'all') {
      result = result.filter((p) => p.categoryId === categoryId);
    }
    
    // Filter by search term
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }
    
    // Sort products
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare((b.name ?? ""));
          break;
        case 'price':
          comparison = (a.price ?? a.retail ?? a.cost ?? 0) - (b.price ?? b.retail ?? b.cost ?? 0);
          break;
        case 'category':
          comparison = a.categoryId.localeCompare(b.categoryId);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return result;
  }, [products, categoryId, searchTerm, sortBy, sortOrder]);
  
  // ============================================================================
  // MEMOIZED METADATA
  // ============================================================================
  
  const productCount = useMemo(
    () => filteredProducts.length,
    [filteredProducts]
  );
  
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.categoryId))),
    [products]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    filteredProducts,
    productCount,
    categories,
  };
}
