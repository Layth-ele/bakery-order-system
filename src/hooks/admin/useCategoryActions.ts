/**
 * useCategoryActions Hook
 * 🟢 HOOK - Category CRUD operations
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from ManageProducts.tsx (1051 lines)
 * - Handles all category create/update/delete operations
 * - Manages cascade delete of products
 * 
 * Responsibilities:
 * - Save category (create or update)
 * - Delete category with products
 * - Sync with Firebase directly (no service layer)
 * 
 * Used by: /pages/admin/ManageProducts.tsx
 * Location: /hooks/admin/useCategoryActions.ts
 * 
 * ✅ FIXED: Now calls Firebase layer directly (March 13, 2026)
 */

import { useCallback } from 'react';
import type { Category, Product } from '../../types';
import { useAlert } from '../../contexts/AlertContext';
import * as firestoreCategories from '../../firebase/firestore/categories';
import * as firestoreProducts from '../../firebase/firestore/products';

// ============================================================================
// TYPES
// ============================================================================

export interface CategoryActions {
  saveCategory: (categoryData: Category, isEditing: boolean, userId: string) => Promise<void>;
  deleteCategory: (categoryId: string, products: Product[], selectedCategory: string, categories: Category[]) => Promise<void>;
}

interface UseCategoryActionsOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onCategoryDeleted: (newSelectedCategory: string | null) => void;
  setLoading: (loading: boolean) => void;
  invalidateCategories: () => Promise<void>;
  invalidateProducts: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCategoryActions({
  onSuccess,
  onError,
  onCategoryDeleted,
  setLoading,
  invalidateCategories,
  invalidateProducts,
}: UseCategoryActionsOptions): CategoryActions {
  const { showConfirm } = useAlert();
  
  // ============================================================================
  // SAVE CATEGORY - Create or update
  // ============================================================================
  
  const saveCategory = useCallback(
    async (categoryData: Category, isEditing: boolean, userId: string) => {
      try {
        setLoading(true);
        
        if (isEditing) {
          // ✅ Update category in Firebase (correct signature)
          await firestoreCategories.updateCategory(categoryData.id, {
            name: (categoryData.name ?? ""),
            order: categoryData.order,
          });
        } else {
          // ✅ Create category in Firebase (no id in input)
          await firestoreCategories.createCategory({
            name: (categoryData.name ?? ""),
            order: categoryData.order,
          });
        }
        
        // Invalidate cache to trigger refetch
        await invalidateCategories();
        
        onSuccess(isEditing ? '✅ Category updated!' : '✅ Category added!');
      } catch (error) {
        console.error('❌ [useCategoryActions] Error saving category:', error);
        onError('❌ Failed to save category');
      } finally {
        setLoading(false);
      }
    },
    [setLoading, invalidateCategories, onSuccess, onError]
  );
  
  // ============================================================================
  // DELETE CATEGORY - With confirmation and cascade delete
  // ============================================================================
  
  const deleteCategory = useCallback(
    async (categoryId: string, products: Product[], selectedCategory: string, categories: Category[]) => {
      showConfirm(
        'Delete Category',
        'Are you sure you want to delete this category?\\n\\nAll products in this category will also be deleted.',
        async () => {
          try {
            setLoading(true);
            
            const updatedCategories = categories.filter((c) => c.id !== categoryId);
            const productsToDelete = products.filter((p) => p.categoryId === categoryId);
            
            // ✅ Delete category from Firebase
            await firestoreCategories.deleteCategory(categoryId);
            
            // ✅ Delete all products in this category from Firebase
            for (const product of productsToDelete) {
              await firestoreProducts.deleteProduct(product.id);
            }
            
            // Invalidate cache to trigger refetch
            await Promise.all([
              invalidateCategories(),
              invalidateProducts(), // Products also need update since category deleted
            ]);
            
            // Update selected category if needed
            if (selectedCategory === categoryId && updatedCategories.length > 0) {
              onCategoryDeleted(updatedCategories[0].id);
            } else {
              onCategoryDeleted(null);
            }
            
            onSuccess('✅ Category deleted');
          } catch (error) {
            console.error('❌ [useCategoryActions] Error deleting category:', error);
            onError('❌ Failed to delete category');
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [showConfirm, setLoading, invalidateCategories, invalidateProducts, onSuccess, onError, onCategoryDeleted]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    saveCategory,
    deleteCategory,
  };
}
