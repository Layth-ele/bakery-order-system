import { safeParseJSON } from '../../utils/safeLocalStorage';
/**
 * 🍰 PRODUCTS DATA SERVICE
 * 
 * Firestore service for bakery products.
 * Replaces localStorage.getItem('bakery_products').
 * 
 * Version: 1.0
 * Created: February 12, 2026
 */

import {
  FirestoreDataService,
  COLLECTIONS,
  getFirestoreDataService,
} from './firestoreDataService';
import {where, serverTimestamp, Unsubscribe} from 'firebase/firestore'
import { isFirebaseConfigured } from '../../firebase/config'; // ✅ For fallback logic

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Use the canonical Product type from schemas (single source of truth)
import type { Product } from '../../schemas';

/**
 * Generate a crypto-secure 9-char base36 ID suffix.
 *
 * FIX T2R4-H3 (HIGH — collision-prone IDs): Was using
 * `Math.random().toString(36).substr(2, 9)` for the product ID random
 * portion. Two simultaneous product creates in the same millisecond
 * would collide on the ID, and the second `setDocument` would silently
 * overwrite the first product. Now uses crypto.getRandomValues().
 */
function cryptoIdSuffix(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}
import { logger } from '../../utils/logger';

export type { Product };

export interface CreateProductData {
  name: string;
  categoryId: string;
  price: number;
  unit: string;
  available?: boolean;
  image?: string;
  description?: string;
  order?: number;
}

export interface UpdateProductData {
  name?: string;
  categoryId?: string;
  price?: number;
  unit?: string;
  available?: boolean;
  image?: string;
  description?: string;
  order?: number;
}

// ============================================================================
// PRODUCTS DATA SERVICE
// ============================================================================

export class ProductsDataService {
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
   * Gets all products
   */
  async getAllProducts(): Promise<Product[]> {
    try {
      const products = await this.dataService.getAllDocuments<Product>(
        COLLECTIONS.PRODUCTS
      );
      
      // Sort by order field if available, otherwise by name
      return products.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.name.localeCompare((b.name ?? ""));
      });
    } catch (error) {
      console.error('❌ Failed to get products:', error);
      return [];
    }
  }

  /**
   * Gets a single product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    try {
      return await this.dataService.getDocument<Product>(
        COLLECTIONS.PRODUCTS,
        productId
      );
    } catch (error) {
      console.error(`❌ Failed to get product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Gets products by category
   */
  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    try {
      const products = await this.dataService.queryDocuments<Product>(
        COLLECTIONS.PRODUCTS,
        where('categoryId', '==', categoryId)
      );
      
      return products.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.name.localeCompare((b.name ?? ""));
      });
    } catch (error) {
      console.error(`❌ Failed to get products for category ${categoryId}:`, error);
      return [];
    }
  }

  /**
   * Gets available products only
   */
  async getAvailableProducts(): Promise<Product[]> {
    try {
      const products = await this.dataService.queryDocuments<Product>(
        COLLECTIONS.PRODUCTS,
        where('available', '==', true)
      );
      
      return products.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.name.localeCompare((b.name ?? ""));
      });
    } catch (error) {
      console.error('❌ Failed to get available products:', error);
      return [];
    }
  }

  // ==========================================================================
  // WRITE OPERATIONS
  // ==========================================================================

  /**
   * Creates a new product
   */
  async createProduct(data: CreateProductData, userId?: string): Promise<Product> {
    try {
      const productId = `product_${Date.now()}_${cryptoIdSuffix()}`;
      
      const newProduct: Product = {
        id: productId,
        ...data,
        available: data.available ?? true,
        order: data.order ?? 0,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        createdBy: userId,
        updatedBy: userId,
      } as any;

      await this.dataService.setDocument(
        COLLECTIONS.PRODUCTS,
        productId,
        newProduct
      );

      return newProduct;
    } catch (error) {
      console.error('❌ Failed to create product:', error);
      throw error;
    }
  }

  /**
   * Updates a product
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData,
    userId?: string
  ): Promise<void> {
    try {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp() as any,
        updatedBy: userId,
      };

      await this.dataService.updateDocument(
        COLLECTIONS.PRODUCTS,
        productId,
        updateData
      );

    } catch (error) {
      console.error(`❌ Failed to update product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a product
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.dataService.deleteDocument(
        COLLECTIONS.PRODUCTS,
        productId
      );

    } catch (error) {
      console.error(`❌ Failed to delete product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes all products in a category
   */
  async deleteProductsByCategory(categoryId: string): Promise<number> {
    try {
      const products = await this.getProductsByCategory(categoryId);
      
      const deleteOperations = products.map(product => ({
        type: 'delete' as const,
        collectionPath: COLLECTIONS.PRODUCTS,
        documentId: product.id,
      }));

      if (deleteOperations.length > 0) {
        await this.dataService.batchWrite(deleteOperations);
      }

      return deleteOperations.length;
    } catch (error) {
      console.error(`❌ Failed to delete products for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Toggles product availability
   */
  async toggleAvailability(productId: string): Promise<void> {
    try {
      const product = await this.getProduct(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

    } catch (error) {
      console.error(`❌ Failed to toggle availability for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk updates product orders
   */
  async updateProductOrders(productOrders: Array<{ id: string; order: number }>): Promise<void> {
    try {
      const updateOperations = productOrders.map(({ id, order }) => ({
        type: 'update' as const,
        collectionPath: COLLECTIONS.PRODUCTS,
        documentId: id,
        data: { order, updatedAt: Date.now() },
      }));

      await this.dataService.batchWrite(updateOperations);

    } catch (error) {
      console.error('❌ Failed to update product orders:', error);
      throw error;
    }
  }

  // ==========================================================================
  // REAL-TIME LISTENERS
  // ==========================================================================

  /**
   * Subscribes to all products
   */
  subscribeToProducts(
    callback: (products: Product[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.dataService.subscribeToCollection<Product>(
      COLLECTIONS.PRODUCTS,
      (products) => {
        // Sort products
        const sorted = products.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return a.name.localeCompare((b.name ?? ""));
        });
        callback(sorted);
      },
      onError
    );
  }

  /**
   * Subscribes to products in a category
   */
  subscribeToProductsByCategory(
    categoryId: string,
    callback: (products: Product[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.dataService.subscribeToCollection<Product>(
      COLLECTIONS.PRODUCTS,
      (products) => {
        const sorted = products.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return a.name.localeCompare((b.name ?? ""));
        });
        callback(sorted);
      },
      onError,
      where('categoryId', '==', categoryId)
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Checks if a product exists
   */
  async productExists(productId: string): Promise<boolean> {
    return await this.dataService.documentExists(COLLECTIONS.PRODUCTS, productId);
  }

  /**
   * Counts total products
   */
  async countProducts(): Promise<number> {
    return await this.dataService.countDocuments(COLLECTIONS.PRODUCTS);
  }

  /**
   * Counts products in a category
   */
  async countProductsByCategory(categoryId: string): Promise<number> {
    try {
      const products = await this.getProductsByCategory(categoryId);
      return products.length;
    } catch (error) {
      console.error(`❌ Failed to count products for category ${categoryId}:`, error);
      return 0;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let productsServiceInstance: ProductsDataService | null = null;

/**
 * Gets or creates a singleton products service instance
 * Returns null if Firebase not configured
 */
export function getProductsDataService(): ProductsDataService | null {
  // ✅ Don't initialize if Firebase not configured
  if (!isFirebaseConfigured) {
    return null;
  }
  
  if (!productsServiceInstance) {
    try {
      productsServiceInstance = new ProductsDataService();
    } catch (error) {
      logger.warn('⚠️ Failed to initialize ProductsDataService:', error);
      return null;
    }
  }
  return productsServiceInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetProductsDataService(): void {
  productsServiceInstance = null;
}

// ============================================================================
// CONVENIENCE EXPORTS WITH FALLBACK
// ============================================================================

/**
 * Safely gets products data service or returns null if Firebase not configured
 */
function getServiceSafely(): ProductsDataService | null {
  if (!isFirebaseConfigured) {
    return null;
  }
  
  try {
    return getProductsDataService();
  } catch (error) {
    logger.warn('⚠️ Firebase not configured, using localStorage fallback');
    return null;
  }
}

export const productsDataService = getServiceSafely();

/**
 * Gets all products from Firestore or localStorage
 * ✅ MIGRATION: Added localStorage fallback for demo mode
 */
export async function getAll(): Promise<Product[]> {
  const service = getServiceSafely();
  
  if (service && isFirebaseConfigured) {
    try {
      return await service.getAllProducts();
    } catch (error) {
      console.error('❌ [productsDataService] Firestore read failed:', error);
      // Fall through to localStorage
    }
  }

  return [];
}

// ✅ Convenience exports matching expected API
export const getAllProducts = getAll; // Alias
export const getProduct = (id: string) => productsDataService?.getProduct(id) ?? Promise.resolve(null);

/**
 * Create product with localStorage fallback
 */
export async function createProduct(data: CreateProductData | Product, userId?: string): Promise<Product> {
  const service = getServiceSafely();
  
  if (service && isFirebaseConfigured) {
    try {
      return await service.createProduct(data as CreateProductData, userId);
    } catch (error) {
      console.error('❌ [productsDataService] Firestore create failed:', error);
      // Fall through to localStorage
    }
  }
  
  // localStorage fallback
  const products = safeParseJSON<any[]>('bakery_products', []);
  const rawProduct = {
    ...data,
    id: (data as CreateProductData & { id?: string }).id || `prod-${Date.now()}`,
    available: (data as CreateProductData & { available?: boolean }).available ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };
  
  // ✅ SAFE: Validate product structure
  const newProduct: Product = {
    id: rawProduct.id,
    name: rawProduct.name || '',
    categoryId: rawProduct.categoryId || '',
    price: rawProduct.price || 0,
    unit: rawProduct.unit || 'each',
    available: rawProduct.available,
    image: rawProduct.image,
    description: rawProduct.description,
    order: rawProduct.order,
    createdAt: rawProduct.createdAt,
    updatedAt: rawProduct.updatedAt,
    createdBy: rawProduct.createdBy,
    updatedBy: (rawProduct as any).updatedBy,
    // Required schema fields with defaults
    cost: (rawProduct as any).cost ?? (rawProduct as any).price ?? 0,
    retail: (rawProduct as any).retail ?? (rawProduct as any).price ?? 0,
    wholesale: (rawProduct as any).wholesale ?? (rawProduct as any).price ?? 0,
    minQty: (rawProduct as any).minQty ?? 1,
    dailyMinOrder: (rawProduct as any).dailyMinOrder ?? 0,
  } as Product;
  
  products.push(newProduct);
  localStorage.setItem('bakery_products', JSON.stringify(products));
  return newProduct;
}

/**
 * Update product with localStorage fallback
 */
export async function updateProduct(idOrProduct: string | Product, data?: UpdateProductData | Product, userId?: string): Promise<Product> {
  const service = getServiceSafely();
  
  // Handle both function signatures: updateProduct(id, data) or updateProduct(product)
  let productId: string;
  let updateData: any;
  
  if (typeof idOrProduct === 'string') {
    productId = idOrProduct;
    updateData = data;
  } else {
    productId = idOrProduct.id;
    updateData = idOrProduct;
  }
  
  if (service && isFirebaseConfigured) {
    try {
      await service.updateProduct(productId, updateData, userId);
      // Return updated product
      const products = safeParseJSON<any[]>('bakery_products', []);
      const updated = products.find((p: Product) => p.id === productId);
      return updated || { ...updateData, id: productId };
    } catch (error) {
      console.error('❌ [productsDataService] Firestore update failed:', error);
      // Fall through to localStorage
    }
  }
  
  // localStorage fallback
  const products = safeParseJSON<any[]>('bakery_products', []);
  const index = products.findIndex((p: Product) => p.id === productId);
  if (index === -1) {
    throw new Error(`Product ${productId} not found`);
  }
  products[index] = {
    ...products[index],
    ...updateData,
    updatedAt: serverTimestamp() as any,
    updatedBy: userId,
  };
  localStorage.setItem('bakery_products', JSON.stringify(products));
  return products[index];
}

/**
 * Delete product with localStorage fallback
 */
export async function deleteProduct(id: string): Promise<void> {
  const service = getServiceSafely();
  
  if (service && isFirebaseConfigured) {
    try {
      await service.deleteProduct(id);
      return;
    } catch (error) {
      console.error('❌ [productsDataService] Firestore delete failed:', error);
      // Fall through to localStorage
    }
  }
  
  // Firebase only - no localStorage fallback
  throw new Error(`Product ${id} not found in Firestore`);
}
