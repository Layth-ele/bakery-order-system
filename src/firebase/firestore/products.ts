/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - PRODUCTS DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Products collection.
 * 
 * EXPORTS:
 * - getProducts: Fetch all products
 * - createProduct: Create new product
 * - updateProduct: Update product
 * - deleteProduct: Delete product
 * - subscribeToProducts: Real-time products list
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';

import {
  productSchema,
  createProductInputSchema,
  updateProductInputSchema,
  parseOrThrow,
  parseArrayPartial,
  type Product,
} from '../../schemas';

import {db, serverTimestamp, wrapFirestoreOperation} from './shared'
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all products (one-time fetch)
 * ✅ VALIDATED: All product documents are validated
 */
export const getProducts = async (): Promise<Product[]> => {
  return wrapFirestoreOperation(async () => {
    // FIX R4-S4-F8 (CRITICAL): Was orderBy('category') — but the Product schema
    // canonical field is `categoryId`, not `category`.  Firestore orderBy on a
    // non-existent field excludes ALL documents missing that field, so the entire
    // products list was returned empty unless legacy docs happened to have both
    // fields.  Switched to orderBy('categoryId').
    const q = query(collection(db, 'products'), orderBy('categoryId'), orderBy('name'));
    const snapshot = await getDocs(q);
    
    const rawProducts: any[] = [];
    snapshot.forEach((doc) => {
      rawProducts.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all products
    return parseArrayPartial(productSchema, rawProducts, 'Product');
  }, 'getProducts');
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create product
 * ✅ INPUT VALIDATED: Input is validated before write
 * ✅ RETURNS: Document ID only (caller should fetch if needed)
 */
export const createProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    // ✅ SCHEMA PROTECTION: Validate input
    const validatedInput = parseOrThrow(createProductInputSchema, product, 'CreateProductInput');
    
    const docRef = await addDoc(collection(db, 'products'), {
      ...validatedInput,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    });
    
    // ✅ PRODUCTION SAFETY: Return only ID, not simulated object
    // Caller should fetch fresh data if needed
    return docRef.id;
  }, 'createProduct');
};

/**
 * Update product
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateProduct = async (productId: string, data: Partial<Product>): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update
    const validatedInput = parseOrThrow(updateProductInputSchema, data, 'UpdateProductInput');
    
    const cleanData = Object.entries(validatedInput).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    if (Object.keys(cleanData).length === 0) {
      logger.warn('updateProduct: No valid fields to update');
      return;
    }
    
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp() as any,
    });
  }, `updateProduct(${productId})`);
};

/**
 * Delete product
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    await deleteDoc(doc(db, 'products', productId));
  }, `deleteProduct(${productId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to products
 * ✅ VALIDATED: All product documents are validated
 */
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  // FIX R4-S4-F8 (CRITICAL, sibling): Same orderBy('category') vs schema 'categoryId'
  // mismatch as getProducts above. The realtime subscription was emitting an empty
  // list every refresh because Firestore filters out docs missing the orderBy field.
  const q = query(collection(db, 'products'), orderBy('categoryId'), orderBy('name'));
  
  return onSnapshot(q, (snapshot) => {
    const rawProducts: any[] = [];
    snapshot.forEach((doc) => {
      rawProducts.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all products
    const validatedProducts = parseArrayPartial(productSchema, rawProducts, 'Product');
    callback(validatedProducts);
  }, (error) => {
    console.error('Error subscribing to products:', error);
  });
};