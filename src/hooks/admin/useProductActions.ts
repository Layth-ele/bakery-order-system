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
import { legacyDiscountCopiesOf } from '../../utils/productDiscount';
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
  // SAVE PRODUCT - Create or update
  // ============================================================================
  
  const saveProduct = useCallback(
    async (productData: any, isEditing: boolean, products: Product[]) => {
      try {
        setLoading(true);
        const cleanData = cleanProductData(productData);
        // One product document per product. A discount is a field on it; the
        // "Discounted items" filter shows every product with a discount.
        if (isEditing && productData.id) {
          await updateProductDS(productData.id, cleanData);
        } else {
          await createProductDS(cleanData as any);
        }
        // Remove copies the old "discounted copy" feature left behind.
        for (const copy of legacyDiscountCopiesOf(productData, products)) {
          await deleteProductDS(copy.id);
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
  // DELETE PRODUCT - With confirmation
  // ============================================================================
  
  const deleteProduct = useCallback(
    async (productId: string, products: Product[]) => {
      showConfirm(
        'Delete Product',
        'Are you sure you want to delete this product?\\n\\nThis action cannot be undone.',
        async () => {
          try {
            setLoading(true);
            
            await firestoreProducts.deleteProduct(productId);
            const product = products.find((p) => p.id === productId);
            for (const copy of product ? legacyDiscountCopiesOf(product, products) : []) {
              await deleteProductDS(copy.id);
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