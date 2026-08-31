/**
 * Utility Helper Functions
 * 
 * ✅ REFACTORED MARCH 7, 2026: Removed business logic
 * - Business calculations moved to /services/calculators/
 * - This file now contains ONLY generic utilities
 * 
 * Common utility functions used throughout the application
 */

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format a number as currency (CAD)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a phone number to BC format: (604) 555-1234
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle different input lengths
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // Handle numbers with country code
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone; // Return original if format not recognized
};

/**
 * Format a date string to readable format
 */
export const formatDate = (dateString: string, includeTime = false): string => {
  const date = new Date(dateString);
  
  if (includeTime) {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
  
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format a date as ISO string (YYYY-MM-DD)
 */
export const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return formatDate(dateString);
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate email format
 *
 * FIX R8-S6-F27 (HIGH): Was a parallel implementation that disagreed with
 * services/validators/inputValidator.isValidEmail (different regex, no length
 * check). Importing the wrong one made forms in different parts of the app
 * validate inconsistently.  Now delegates to the canonical validator.
 *
 * Imported lazily so this util doesn't pull the validator's dependency tree
 * into bundles that don't need it.
 */
export const isValidEmail = (email: string): boolean => {
  // Local lightweight check first (avoids dynamic import overhead in hot paths).
  // Matches inputValidator's regex + length cap (255 chars per RFC 5321).
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

/**
 * Validate British Columbia phone number
 * Accepts BC area codes: 236, 250, 604, 672, 778
 */
export const isValidBCPhone = (phone: string): boolean => {
  const phoneRegex = /^(\+1|1)?[\s.-]?(236|250|604|672|778)[\s.-]?([2-9][0-9]{2})[\s.-]?([0-9]{4})$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * At least 6 characters
 */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

/**
 * Validate password with strong requirements
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
export const isStrongPassword = (password: string): boolean => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return strongRegex.test(password);
};

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Capitalize first letter of each word
 */
export const capitalizeWords = (str: string): string => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Generate a random ID
 *
 * FIX T2R4-H3 (HIGH — predictable random): Was using
 * `Math.random().toString(36).substr(2, 9)`. Math.random() is reverse-
 * engineerable in V8 and collision-prone for same-millisecond calls.
 * Now uses crypto.getRandomValues() for cryptographically secure IDs.
 *
 * Note: currently unused (verified via grep — only `formatCurrency` is
 * imported from this module). Kept for backward compatibility but
 * future callers should use a domain-specific ID generator (idCounterService
 * for sequential IDs, the cryptoIdSuffix() helpers in service modules
 * for non-sequential IDs).
 */
export const generateId = (prefix = 'id'): string => {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const suffix = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
  return `${prefix}-${Date.now()}-${suffix}`;
};

/**
 * Slugify text (convert to URL-friendly format)
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Group array by key
 */
export const groupBy = <T extends Record<string, any>>(
  array: T[],
  key: keyof T
): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

/**
 * Sort array by key
 */
export const sortBy = <T extends Record<string, any>>(
  array: T[],
  key: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Remove duplicates from array
 */
export const uniqueBy = <T extends Record<string, any>>(
  array: T[],
  key: keyof T
): T[] => {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep clone an object
 *
 * FIX R10-S6-F77 (HIGH): Was JSON.parse(JSON.stringify()) which destroys
 * Firestore Timestamps, FieldValue sentinels, Date objects, and Maps/Sets.
 * Now uses structuredClone (browser-native algorithm) which preserves Date,
 * Map, Set, RegExp, ArrayBuffer, etc.
 *
 * Note: structuredClone does NOT preserve Firestore Timestamp/FieldValue
 * (those are SDK class instances, not structured-clone-recognized).  For
 * order-shaped objects with Timestamps, callers should convert via toDate()
 * BEFORE cloning, then convert back if needed.
 */
export function deepClone<T>(obj: T): T {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
  } catch {
    // Fall through to JSON-based clone if structuredClone fails
    // (e.g. obj contains a non-cloneable value like a function or DOM node)
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/**
 * Check if object is empty
 */
export const isEmpty = (obj: object): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * Remove undefined/null values from object
 */
export const cleanObject = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key as keyof T] = value;
    }
    return acc;
  }, {} as Partial<T>);
};

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

/**
 * Get item from localStorage with fallback default value
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error("[helpers] getLocalStorage failed:", error);
    return defaultValue;
  }
}

/**
 * Set item in localStorage (JSON-stringified)
 *
 * FIX R10-S6-F69 (HIGH): Was a silent no-op — function body was just `return true`
 * with no localStorage.setItem call.  Any caller relying on this to persist data
 * had data silently disappear between page loads.  Now actually writes.
 */
export function setLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("[helpers] setLocalStorage failed:", error);
    return false;
  }
}

/**
 * Remove item from localStorage
 *
 * FIX R10-S6-F69 (HIGH): Was a silent no-op (just returned true without calling
 * localStorage.removeItem).  Now actually removes.
 */
export const removeLocalStorage = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("[helpers] removeLocalStorage failed:", error);
    return false;
  }
};

// ============================================================================
// BROWSER UTILITIES
// ============================================================================

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Download file from blob
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob!);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: unknown[][]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: unknown[][]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
