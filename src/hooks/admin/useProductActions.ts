/**
 * useProductActions Hook
 * 🟢 HOOK - Product CRUD operations
 * 
 * REFACTORED - Phase 2: Business Logic Extraction
 * - Extracted from ManageProducts.tsx (1051 lines)
 * - Handles all product create/update/delete operations
 * - Manages discounted product copies
 * 
 * Responsibilities:
 * - Save product (create or update)
 * - Delete product
 * - Handle discounted product copies
 * - Sync with Firebase directly (no service layer)
 * 
 * Used by: /pages/admin/ManageProducts.tsx
 * Location: /hooks/admin/useProductActions.ts
 * 
 * ✅ FIXED: Now calls Firebase layer directly (March 13, 2026)
 */

import { useCallback } from 'react';
import type { Product } from '../../types';
import { useAlert } from '../../contexts/AlertContext';
import * as firestoreProducts from '../../firebase/firestore/products';
import { 
  createProduct as createProductDS,
  updateProduct as updateProductDS, 
  deleteProduct as deleteProductDS,
} from '../../services/data/productsDataService';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean product data by converting empty strings to undefined
 * This ensures optional fields pass Zod validation (optionalNonEmptyStringSchema)
 */
function cleanProductData(data: any) {
  return {
    name: (data.name ?? ""),
    categoryId: data.categoryId,
    cost: data.cost,
    retail: data.retail,
    wholesale: data.wholesale,
    dailyMinOrder: data.dailyMinOrder,
    discount: data.discount || 0,
    minQty: data.minQty || 0,
    // ✅ Convert empty strings to undefined for optional fields
    image: data.image?.trim() || undefined,
    description: data.description?.trim() || undefined,
    ingredients: data.ingredients?.trim() || undefined,
    storageDescription: data.storageDescription?.trim() || undefined,
    shelfLife: data.shelfLife?.trim() || undefined,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProductActions {
  saveProduct: (productData: any, isEditing: boolean, products: Product[]) => Promise<void>;
  deleteProduct: (productId: string, products: Product[]) => Promise<void>;
}

interface UseProductActionsOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onDeleteSuccess: (productId: string) => void;
  setLoading: (loading: boolean) => void;
  invalidateProducts: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useProductActions({
  onSuccess,
  onError,
  onDeleteSuccess,
  setLoading,
  invalidateProducts,
}: UseProductActionsOptions): ProductActions {
  const { showConfirm } = useAlert();
  
  // ============================================================================
  // SAVE PRODUCT - Create or update with discount handling
  // ============================================================================
  
  const saveProduct = useCallback(
    async (productData: any, isEditing: boolean, products: Product[]) => {
      try {
        setLoading(true);
        const discountValue = productData.discount || 0;
        
        if (isEditing && productData.id) {
          // ======================================================================
          // UPDATE EXISTING PRODUCT
          // ======================================================================
          
          // Handle discounted copy
          const discountedCopyId = `${productData.id}-discounted`;
          const hasDiscountedCopy = products.some((p) => p.id === discountedCopyId);
          
          // ✅ Clean data (convert empty strings to undefined)
          const cleanData = cleanProductData(productData);
          
          // ✅ Update main product in Firebase (correct signature)
          await updateProductDS(productData.id, cleanData);
          
          // Handle discounted copy
          if (discountValue > 0) {
            if (hasDiscountedCopy) {
              // ✅ Update existing discounted copy
              await firestoreProducts.updateProduct(discountedCopyId, {
                ...cleanData,
                categoryId: 'cat-0',
              });
            } else {
              // ✅ Create new discounted copy (no id in input)
              await createProductDS({
                ...cleanData,
                categoryId: 'cat-0',
              } as any);
            }
          } else if (hasDiscountedCopy) {
            // ✅ Remove discounted copy if discount is 0
            await deleteProductDS(discountedCopyId);
          }
        } else {
          // ======================================================================
          // CREATE NEW PRODUCT
          // ======================================================================
          
          // ✅ Clean data (convert empty strings to undefined)
          const cleanData = cleanProductData(productData);
          
          // ✅ Create main product (Firebase generates ID)
          await createProductDS(cleanData as any);
          
          // ✅ If product has discount, also create a copy in discounted category
          if (discountValue > 0) {
            await firestoreProducts.createProduct({
              ...cleanData,
              categoryId: 'cat-0', // DISCOUNTED ITEMS category
            });
          }
        }
        
        // Invalidate cache to trigger refetch
        await invalidateProducts();
        
        onSuccess(isEditing ? '✅ Product updated!' : '✅ Product added!');
      } catch (error) {
        console.error('❌ [useProductActions] Error saving product:', error);
        onError('❌ Failed to save product');
      } finally {
        setLoading(false);
      }
    },
    [setLoading, invalidateProducts, onSuccess, onError]
  );
  
  // ============================================================================
  // DELETE PRODUCT - With confirmation and discounted copy handling
  // ============================================================================
  
  const deleteProduct = useCallback(
    async (productId: string, products: Product[]) => {
      showConfirm(
        'Delete Product',
        'Are you sure you want to delete this product?\\n\\nThis action cannot be undone.',
        async () => {
          try {
            setLoading(true);
            
            // Also delete the discounted copy if it exists
            const discountedCopyId = `${productId}-discounted`;
            const hasDiscountedCopy = products.some((p) => p.id === discountedCopyId);
            
            // ✅ Delete from Firebase
            await firestoreProducts.deleteProduct(productId);
            
            if (hasDiscountedCopy) {
              await deleteProductDS(discountedCopyId);
            }
            
            // Invalidate cache to trigger refetch
            await invalidateProducts();
            
            onDeleteSuccess(productId);
            onSuccess('✅ Product deleted');
          } catch (error) {
            console.error('❌ [useProductActions] Error deleting product:', error);
            onError('❌ Failed to delete product');
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [showConfirm, setLoading, invalidateProducts, onSuccess, onError, onDeleteSuccess]
  );
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    saveProduct,
    deleteProduct,
  };
}