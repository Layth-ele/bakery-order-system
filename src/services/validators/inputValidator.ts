/**
 * Input Validator - Pure Validation Logic
 * 
 * ✅ MARCH 10, 2026: Extracted from /constants/validation.ts
 * - All validation functions moved here
 * - Constants remain in /constants/validation.ts
 * - Pure functions with no side effects
 * - Fully testable
 * 
 * PURPOSE:
 * - Validate email addresses
 * - Validate phone numbers
 * - Validate file uploads (size, type)
 * - Validate business rules
 * 
 * @author Bakery Order Management System
 */

import { VALIDATION_RULES } from '../../constants/validation';

/**
 * Validate email address
 * 
 * @param email - Email address to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  return (
    VALIDATION_RULES.customer.emailRegex.test(email) &&
    email.length <= VALIDATION_RULES.customer.emailMaxLength
  );
}

/**
 * Validate phone number
 * 
 * @param phone - Phone number to validate
 * @returns True if phone is valid
 */
export function isValidPhone(phone: string): boolean {
  return (
    VALIDATION_RULES.customer.phoneRegex.test(phone) &&
    phone.length >= VALIDATION_RULES.customer.phoneMinLength &&
    phone.length <= VALIDATION_RULES.customer.phoneMaxLength
  );
}

/**
 * Validate file size
 * 
 * @param fileSizeBytes - File size in bytes
 * @param maxSizeMB - Maximum allowed size in MB
 * @returns True if file size is within limit
 */
export function isValidFileSize(fileSizeBytes: number, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSizeBytes <= maxSizeBytes;
}

/**
 * Validate file type
 * 
 * @param fileType - MIME type of the file
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 */
export function isValidFileType(fileType: string, allowedTypes: readonly string[]): boolean {
  return allowedTypes.includes(fileType);
}

/**
 * Get file size in MB
 * 
 * @param fileSizeBytes - File size in bytes
 * @returns File size in MB (rounded to 2 decimals)
 */
export function getFileSizeMB(fileSizeBytes: number): number {
  return Number((fileSizeBytes / (1024 * 1024)).toFixed(2));
}

/**
 * Validate payment proof file
 * 
 * @param file - File object to validate
 * @returns Object with validation result and error message
 */
export function validatePaymentProofFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  const { paymentProof } = VALIDATION_RULES.fileUpload;
  
  // Check file size
  if (!isValidFileSize(file.size, paymentProof.maxSizeMB)) {
    return {
      isValid: false,
      error: `File size must be less than ${paymentProof.maxSizeMB}MB. Current size: ${getFileSizeMB(file.size)}MB`,
    };
  }
  
  // Check file type
  if (!isValidFileType(file.type, paymentProof.allowedTypes)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${paymentProof.allowedExtensions.join(', ')}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate product image file
 * 
 * @param file - File object to validate
 * @returns Object with validation result and error message
 */
export function validateProductImageFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  const { productImage } = VALIDATION_RULES.fileUpload;
  
  // Check file size
  if (!isValidFileSize(file.size, productImage.maxSizeMB)) {
    return {
      isValid: false,
      error: `File size must be less than ${productImage.maxSizeMB}MB. Current size: ${getFileSizeMB(file.size)}MB`,
    };
  }
  
  // Check file type
  if (!isValidFileType(file.type, productImage.allowedTypes)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${productImage.allowedExtensions.join(', ')}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate customer name
 * 
 * @param name - Customer name to validate
 * @returns Object with validation result and error message
 */
export function validateCustomerName(name: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = name.trim();
  
  if (trimmed.length < VALIDATION_RULES.customer.nameMinLength) {
    return {
      isValid: false,
      error: `Name must be at least ${VALIDATION_RULES.customer.nameMinLength} characters`,
    };
  }
  
  if (trimmed.length > VALIDATION_RULES.customer.nameMaxLength) {
    return {
      isValid: false,
      error: `Name must be less than ${VALIDATION_RULES.customer.nameMaxLength} characters`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate order subtotal
 * 
 * @param subtotal - Order subtotal to validate
 * @returns Object with validation result and error message
 */
export function validateOrderSubtotal(subtotal: number): {
  isValid: boolean;
  error?: string;
} {
  if (subtotal < VALIDATION_RULES.order.minSubtotal) {
    return {
      isValid: false,
      error: `Order subtotal must be at least $${VALIDATION_RULES.order.minSubtotal}`,
    };
  }
  
  if (subtotal > VALIDATION_RULES.order.maxSubtotal) {
    return {
      isValid: false,
      error: `Order subtotal cannot exceed $${VALIDATION_RULES.order.maxSubtotal}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate order quantity
 * 
 * @param quantity - Quantity to validate
 * @returns Object with validation result and error message
 */
export function validateOrderQuantity(quantity: number): {
  isValid: boolean;
  error?: string;
} {
  if (quantity < VALIDATION_RULES.order.minQuantityPerItem) {
    return {
      isValid: false,
      error: `Quantity must be at least ${VALIDATION_RULES.order.minQuantityPerItem}`,
    };
  }
  
  if (quantity > VALIDATION_RULES.order.maxQuantityPerItem) {
    return {
      isValid: false,
      error: `Quantity cannot exceed ${VALIDATION_RULES.order.maxQuantityPerItem}`,
    };
  }
  
  return { isValid: true };
}
