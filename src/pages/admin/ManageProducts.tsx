/**
 * ManageProducts.tsx
 * 🟢 PAGE - Product and category management
 *
 * REFACTORED - Phase 2: Data-Logic-View Separation Complete
 * - Extracted data layer to useManageProductsData hook
 * - Extracted product actions to useProductActions hook
 * - Extracted category actions to useCategoryActions hook
 * - Extracted view layer to ManageProductsView component
 * - Reduced from 1051 lines to ~200 lines (81% reduction)
 *
 * Route-level page component for admin product management.
 *
 * Used by: Admin routes
 * Location: /pages/admin/ManageProducts.tsx
 */

import React, { useCallback } from 'react';
import { User } from '../../hooks/useAuth';
import type { Product, Category } from '../../types';
import { useModal } from '../../contexts/ModalContextNew';
import { withAdminGuard } from '../../guards/adminGuards';

// ✅ PHASE 2 REFACTOR: Import extracted hooks
import { useManageProductsData } from '../../hooks/admin/useManageProductsData';
import { useProductActions } from '../../hooks/admin/useProductActions';
import { useCategoryActions } from '../../hooks/admin/useCategoryActions';

// ✅ PHASE 2 REFACTOR: Import extracted view component
import { ManageProductsView } from '../../components/admin/manage-products/ManageProductsView';

// ============================================================================
// TYPES
// ============================================================================

interface ManageProductsProps {
  isActive?: boolean;
  user: User;
  onLogout?: () => void;
  onBack: () => void;
  setCurrentPage?: (page: any) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

function ManageProductsBase({
  isActive,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: ManageProductsProps) {
  // ============================================================================
  // HOOKS - Data and logic layers
  // ============================================================================
  
  const { openModal, closeModal } = useModal();
  
  // Data layer - All data fetching and state management
  const {
    products,
    categories,
    filteredProducts,
    stats,
    productsLoading,
    categoriesLoading,
    loading,
    selectedCategory,
    notification,
    deletedProductId,
    setSelectedCategory,
    setNotification,
    setDeletedProductId,
    setLoading,
    invalidateProducts,
    invalidateCategories,
    refetchProducts,
    refetchCategories,
  } = useManageProductsData((isActive ?? false));

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchProducts(), refetchCategories()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchProducts, refetchCategories]);
  
  // ============================================================================
  // NOTIFICATION HELPERS
  // ============================================================================
  
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  }, [setNotification]);
  
  const handleDeleteSuccess = useCallback((productId: string) => {
    setDeletedProductId(productId);
    setTimeout(() => setDeletedProductId(null), 2000);
  }, [setDeletedProductId]);
  
  // ============================================================================
  // ACTION HOOKS - Business logic
  // ============================================================================
  
  // Product CRUD operations
  const { saveProduct, deleteProduct } = useProductActions({
    onSuccess: showNotification,
    onError: showNotification,
    onDeleteSuccess: handleDeleteSuccess,
    setLoading,
    invalidateProducts,
  });
  
  // Category CRUD operations
  const { saveCategory, deleteCategory } = useCategoryActions({
    onSuccess: showNotification,
    onError: showNotification,
    onCategoryDeleted: (newSelectedCategory) => {
      if (newSelectedCategory) {
        setSelectedCategory(newSelectedCategory);
      }
    },
    setLoading,
    invalidateCategories,
    invalidateProducts,
  });
  
  // ============================================================================
  // MODAL HANDLERS - Thin wrappers around action hooks
  // ============================================================================
  
  const openCategoryModal = useCallback(
    (category?: Category) => {
      openModal('EDIT_CATEGORY', {
        category: category || null,
        categoryCount: categories.length,
        onSave: async (categoryData: any) => {
          const isEditing = category !== undefined && category !== null;
          await saveCategory(categoryData, isEditing, user.id);
          closeModal();
        },
        onCancel: closeModal,
      });
    },
    [openModal, categories, closeModal, saveCategory, user.id]
  );
  
  const openProductModal = useCallback(
    (product?: Product) => {
      // If editing a discounted copy, find and edit the original product instead
      let productToEdit = product;
      if (product?.id.endsWith('-discounted')) {
        const originalId = product.id.replace('-discounted', '');
        const originalProduct = products.find((p) => p.id === originalId);
        if (originalProduct) {
          productToEdit = originalProduct;
        }
      }
      
      openModal('EDIT_PRODUCT', {
        product: productToEdit!,
        categories: categories.filter((c) => c.id !== 'cat-0'), // Exclude discounted category
        onSave: async (productData: any, isEditing?: boolean) => {
          // ✅ PASS 6: saveProduct expects required boolean; default to false.
          await saveProduct(productData, isEditing ?? false, products);
          closeModal();
        },
        onCancel: closeModal,
      });
    },
    [products, categories, openModal, closeModal, saveProduct]
  );
  
  const handleDeleteProduct = useCallback(
    (productId: string) => {
      deleteProduct(productId, products);
    },
    [deleteProduct, products]
  );
  
  const handleDeleteCategory = useCallback(
    (categoryId: string) => {
      deleteCategory(categoryId, products, selectedCategory, categories);
    },
    [deleteCategory, products, selectedCategory, categories]
  );
  
  // ============================================================================
  // RENDER - Delegate to view component
  // ============================================================================
  
  return (
    <ManageProductsView
      // Data
      categories={categories}
      filteredProducts={filteredProducts}
      stats={stats}
      
      // UI state
      selectedCategory={selectedCategory}
      notification={notification}
      deletedProductId={deletedProductId}
      
      // Actions
      onAddCategory={() => openCategoryModal()}
      onEditCategory={openCategoryModal}
      onDeleteCategory={handleDeleteCategory}
      onAddProduct={() => openProductModal()}
      onEditProduct={openProductModal}
      onDeleteProduct={handleDeleteProduct}
      onSelectCategory={setSelectedCategory}
      onCloseNotification={() => setNotification('')}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    />
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Wrap Base component with admin guard before exporting
export const ManageProducts = withAdminGuard(
  ManageProductsBase,
  'products management'
);
