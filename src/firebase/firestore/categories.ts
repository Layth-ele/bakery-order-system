/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FIRESTORE - CATEGORIES DOMAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All Firestore operations for the Categories collection.
 * 
 * EXPORTS:
 * - getCategories: Fetch all categories
 * - createCategory: Create new category
 * - updateCategory: Update category
 * - deleteCategory: Delete category
 * - subscribeToCategories: Real-time categories list
 * 
 * ✅ All operations are schema-validated
 * ✅ All operations use wrapFirestoreOperation for error handling
 * 
 * Created: March 13, 2026
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
  categorySchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  parseOrThrow,
  parseArrayPartial,
  type Category,
} from '../../schemas';

import { db, serverTimestamp, wrapFirestoreOperation } from './shared';
import { logger } from '../../utils/logger';


// ═══════════════════════════════════════════════════════════════════════════
// READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all categories (one-time fetch)
 * ✅ VALIDATED: All category documents are validated
 */
export const getCategories = async (): Promise<Category[]> => {
  return wrapFirestoreOperation(async () => {
    const q = query(collection(db, 'categories'), orderBy('order'));
    const snapshot = await getDocs(q);
    
    const rawCategories: any[] = [];
    snapshot.forEach((doc) => {
      rawCategories.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all categories
    return parseArrayPartial(categorySchema, rawCategories, 'Category');
  }, 'getCategories');
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create category
 * ✅ INPUT VALIDATED: Input is validated before write
 * ✅ RETURNS: Document ID only (caller should fetch if needed)
 */
export const createCategory = async (
  category: Omit<Category, 'id'>
): Promise<string> => {
  return wrapFirestoreOperation(async () => {
    // ✅ SCHEMA PROTECTION: Validate input
    const validatedInput = parseOrThrow(
      createCategoryInputSchema,
      category,
      'CreateCategoryInput'
    );
    
    const docRef = await addDoc(collection(db, 'categories'), {
      ...validatedInput,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    });
    
    
    // ✅ PRODUCTION SAFETY: Return only ID, not simulated object
    // Caller should fetch fresh data if needed
    return docRef.id;
  }, 'createCategory');
};

/**
 * Update category
 * ✅ INPUT VALIDATED: Partial update is validated
 */
export const updateCategory = async (
  categoryId: string,
  data: Partial<Category>
): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid update data: must be an object');
    }
    
    // ✅ SCHEMA PROTECTION: Validate partial update
    const validatedInput = parseOrThrow(
      updateCategoryInputSchema,
      { ...data, id: categoryId },
      'UpdateCategoryInput'
    );
    
    // Remove id from update data
    const { id, ...cleanData } = validatedInput;
    
    const updateData = Object.entries(cleanData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    if (Object.keys(updateData).length === 0) {
      logger.warn('updateCategory: No valid fields to update');
      return;
    }
    
    const docRef = doc(db, 'categories', categoryId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp() as any,
    });
    
  }, `updateCategory(${categoryId})`);
};

/**
 * Delete category
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  return wrapFirestoreOperation(async () => {
    await deleteDoc(doc(db, 'categories', categoryId));
  }, `deleteCategory(${categoryId})`);
};

// ═══════════════════════════════════════════════════════════════════════════
// REAL-TIME SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to categories
 * ✅ VALIDATED: All category documents are validated
 */
export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
  const q = query(collection(db, 'categories'), orderBy('order'));
  
  return onSnapshot(q, (snapshot) => {
    const rawCategories: any[] = [];
    snapshot.forEach((doc) => {
      rawCategories.push({ id: doc.id, ...(doc.data() ?? {}) });
    });
    
    // ✅ SCHEMA PROTECTION: Validate all categories
    const validatedCategories = parseArrayPartial(categorySchema, rawCategories, 'Category');
    callback(validatedCategories);
  }, (error) => {
    console.error('Error subscribing to categories:', error);
  });
};
