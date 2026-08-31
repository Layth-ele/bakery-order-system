import { safeParseJSON } from '../../utils/safeLocalStorage';
/**
 * 📁 CATEGORIES DATA SERVICE
 * 
 * Firestore service for product categories.
 * Firebase-backed categories service.
 * 
 * Version: 1.0
 * Created: February 12, 2026
 */

import {
  FirestoreDataService,
  COLLECTIONS,
  getFirestoreDataService,
} from './firestoreDataService';
import type { Unsubscribe } from 'firebase/firestore';

import { isFirebaseConfigured } from '../../firebase/config';
import { logger } from '../../utils/logger';

/**
 * Generate a crypto-secure 9-char base36 ID suffix.
 *
 * FIX T2R4-H3 (HIGH — collision-prone IDs): Was using
 * `Math.random().toString(36).substr(2, 9)` which is reverse-engineerable
 * in V8 and prone to collisions when two categories are created in the
 * same millisecond. Two simultaneous category creates would produce the
 * same ID, then `setDocument` would silently overwrite one with the
 * other. Now uses crypto.getRandomValues() for collision resistance.
 */
function cryptoIdSuffix(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}
 // ✅ MIGRATION: Added for fallback logic

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Category {
  id: string;
  name: string;
  order: number;
  description?: string;
  image?: string;
  active?: boolean;
  
  // Metadata
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateCategoryData {
  name: string;
  order: number;
  description?: string;
  image?: string;
  active?: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  order?: number;
  description?: string;
  image?: string;
  active?: boolean;
}

// ============================================================================
// CATEGORIES DATA SERVICE
// ============================================================================

export class CategoriesDataService {
  private dataService: FirestoreDataService;

  constructor(dataService?: FirestoreDataService) {
    const service = dataService || getFirestoreDataService();
    if (!service) {
      throw new Error('FirestoreDataService is not available. Firebase may not be configured.');
    }
    this.dataService = service;
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Gets all categories (sorted by order)
   */
  async getAllCategories(): Promise<Category[]> {
    try {
      const categories = await this.dataService.getAllDocuments<Category>(
        COLLECTIONS.CATEGORIES
      );
      
      // Sort by order field
      return categories.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('❌ Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Gets a single category by ID
   */
  async getCategory(categoryId: string): Promise<Category | null> {
    try {
      return await this.dataService.getDocument<Category>(
        COLLECTIONS.CATEGORIES,
        categoryId
      );
    } catch (error) {
      console.error(`❌ Failed to get category ${categoryId}:`, error);
      return null;
    }
  }

  /**
   * Gets active categories only
   */
  async getActiveCategories(): Promise<Category[]> {
    try {
      const categories = await this.getAllCategories();
      return categories.filter(cat => cat.active !== false);
    } catch (error) {
      console.error('❌ Failed to get active categories:', error);
      return [];
    }
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Creates a new category
   */
  async createCategory(data: CreateCategoryData, userId?: string): Promise<Category> {
    try {
      const categoryId = `category_${Date.now()}_${cryptoIdSuffix()}`;
      
      const newCategory: Category = {
        id: categoryId,
        ...data,
        active: data.active ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userId,
        updatedBy: userId,
      };

      await this.dataService.setDocument(
        COLLECTIONS.CATEGORIES,
        categoryId,
        newCategory
      );

      return newCategory;
    } catch (error) {
      console.error('❌ Failed to create category:', error);
      throw error;
    }
  }

  /**
   * Updates a category
   */
  async updateCategory(
    categoryId: string,
    data: UpdateCategoryData,
    userId?: string
  ): Promise<void> {
    try {
      const updateData = {
        ...data,
        updatedAt: Date.now(),
        updatedBy: userId,
      };

      await this.dataService.updateDocument(
        COLLECTIONS.CATEGORIES,
        categoryId,
        updateData
      );

    } catch (error) {
      console.error(`❌ Failed to update category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      await this.dataService.deleteDocument(
        COLLECTIONS.CATEGORIES,
        categoryId
      );

    } catch (error) {
      console.error(`❌ Failed to delete category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk updates category orders
   */
  async updateCategoryOrders(categoryOrders: Array<{ id: string; order: number }>): Promise<void> {
    try {
      const updateOperations = categoryOrders.map(({ id, order }) => ({
        type: 'update' as const,
        collectionPath: COLLECTIONS.CATEGORIES,
        documentId: id,
        data: { order, updatedAt: Date.now() },
      }));

      await this.dataService.batchWrite(updateOperations);

    } catch (error) {
      console.error('❌ Failed to update category orders:', error);
      throw error;
    }
  }

  /**
   * Toggles category active status
   */
  async toggleActive(categoryId: string): Promise<void> {
    try {
      const category = await this.getCategory(categoryId);
      if (!category) {
        throw new Error(`Category ${categoryId} not found`);
      }

    } catch (error) {
      console.error(`❌ Failed to toggle active status for ${categoryId}:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // REAL-TIME LISTENERS
  // ==========================================================================

  /**
   * Subscribes to all categories
   */
  subscribeToCategories(
    callback: (categories: Category[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.dataService.subscribeToCollection<Category>(
      COLLECTIONS.CATEGORIES,
      (categories) => {
        // Sort by order
        const sorted = categories.sort((a, b) => a.order - b.order);
        callback(sorted);
      },
      onError
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Checks if a category exists
   */
  async categoryExists(categoryId: string): Promise<boolean> {
    return await this.dataService.documentExists(COLLECTIONS.CATEGORIES, categoryId);
  }

  /**
   * Checks if a category name already exists
   */
  async categoryNameExists(name: string, excludeId?: string): Promise<boolean> {
    try {
      const categories = await this.getAllCategories();
      return categories.some(cat => 
        cat.name.toLowerCase() === name.toLowerCase() && cat.id !== excludeId
      );
    } catch (error) {
      console.error('❌ Failed to check category name:', error);
      return false;
    }
  }

  /**
   * Gets the next available order number
   */
  async getNextOrder(): Promise<number> {
    try {
      const categories = await this.getAllCategories();
      if (categories.length === 0) return 0;
      
      const maxOrder = Math.max(...categories.map(cat => cat.order));
      return maxOrder + 1;
    } catch (error) {
      console.error('❌ Failed to get next order:', error);
      return 0;
    }
  }

  /**
   * Counts total categories
   */
  async countCategories(): Promise<number> {
    return await this.dataService.countDocuments(COLLECTIONS.CATEGORIES);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let categoriesServiceInstance: CategoriesDataService | null = null;

/**
 * Gets or creates a singleton categories service instance
 * Returns null if Firebase not configured
 */
export function getCategoriesDataService(): CategoriesDataService | null {
  // ✅ Don't initialize if Firebase not configured
  if (!isFirebaseConfigured) {
    return null;
  }
  
  if (!categoriesServiceInstance) {
    try {
      categoriesServiceInstance = new CategoriesDataService();
    } catch (error) {
      logger.warn('⚠️ Failed to initialize CategoriesDataService:', error);
      return null;
    }
  }
  return categoriesServiceInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetCategoriesDataService(): void {
  categoriesServiceInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const categoriesDataService = getCategoriesDataService();

/**
 * Gets all categories from Firestore
 * ✅ 
 */
export async function getAllCategories(): Promise<Category[]> {
  const service = getCategoriesDataService();
  
  if (service && isFirebaseConfigured) {
    try {
      return await service.getAllCategories();
    } catch (error) {
      console.error('❌ [categoriesDataService] Firestore read failed:', error);
      // Fall back to localStorage
    }
  }

  // Fallback to localStorage
  try {

    return [];
    return [];
  } catch (error) {
    console.error('❌ [categoriesDataService] Read failed:', error);
    return [];
  }
}

export const getCategory = (id: string) => categoriesDataService?.getCategory(id) ?? Promise.resolve(null);
export const getAll = getAllCategories; // ✅ Alias for backward compatibility

/**
 * Create category in Firestore
 */
export async function createCategory(data: CreateCategoryData | Category, userId?: string): Promise<Category> {
  const service = getCategoriesDataService();
  
  if (service && isFirebaseConfigured) {
    try {
      return await service.createCategory(data, userId);
    } catch (error) {
      console.error('❌ [categoriesDataService] Firestore create failed:', error);
      // Fall through to localStorage
    }
  }
  
  // localStorage fallback
  const categories = safeParseJSON<any[]>('bakery_categories', []);
  const rawCategory = {
    ...data,
    id: (data as { id?: string }).id || `cat-${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: userId,
  };
  
  // ✅ SAFE: Validate category structure
  const newCategory: Category = {
    id: rawCategory.id,
    name: rawCategory.name || '',
    description: rawCategory.description,
    order: rawCategory.order,
    createdAt: rawCategory.createdAt,
    updatedAt: rawCategory.updatedAt,
    createdBy: rawCategory.createdBy,
    updatedBy: (rawCategory as { updatedBy?: string }).updatedBy,
  };
  
  categories.push(newCategory);

  return newCategory;
}

/**
 * Update category in Firestore
 */
export async function updateCategory(idOrCategory: string | Category, data?: UpdateCategoryData | Category, userId?: string): Promise<Category> {
  const service = getCategoriesDataService();
  
  // Handle both function signatures: updateCategory(id, data) or updateCategory(category)
  let categoryId: string;
  let updateData: any;
  
  if (typeof idOrCategory === 'string') {
    categoryId = idOrCategory;
    updateData = data;
  } else {
    categoryId = idOrCategory.id;
    updateData = idOrCategory;
  }
  
  if (service && isFirebaseConfigured) {
    try {
      await service.updateCategory(categoryId, updateData, userId);
      // Return updated category
      const categories = safeParseJSON<any[]>('bakery_categories', []);
      const updated = categories.find((c: Category) => c.id === categoryId);
      return updated || { ...updateData, id: categoryId };
    } catch (error) {
      console.error('❌ [categoriesDataService] Firestore update failed:', error);
      // Fall through to localStorage
    }
  }
  
  // localStorage fallback
  const categories = safeParseJSON<any[]>('bakery_categories', []);
  const index = categories.findIndex((c: Category) => c.id === categoryId);
  if (index === -1) {
    throw new Error(`Category ${categoryId} not found`);
  }
  categories[index] = {
    ...categories[index],
    ...updateData,
    updatedAt: Date.now(),
    updatedBy: userId,
  };

  return categories[index];
}

/**
 * Delete category in Firestore
 */
export async function deleteCategory(id: string): Promise<void> {
  const service = getCategoriesDataService();
  
  if (service && isFirebaseConfigured) {
    try {
      await service.deleteCategory(id);
      return;
    } catch (error) {
      console.error('❌ [categoriesDataService] Firestore delete failed:', error);
      // Fall through to localStorage
    }
  }
  
  // localStorage fallback
  const categories = safeParseJSON<any[]>('bakery_categories', []);
  const filtered = categories.filter((c: Category) => c.id !== id);

}