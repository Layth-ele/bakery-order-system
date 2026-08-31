/**
 * Customer Helper Utilities
 * 
 * Created: March 10, 2026
 * 
 * Helper functions for customer management:
 * - Type badge generation
 * - Suspension status checks
 * - Date formatting
 */

import type { User } from '../services/firebase/authService';

/**
 * Get badge configuration for customer type
 */
export function getCustomerTypeBadge(customer: User): { label: string; color: string } {
  switch (customer.customerType) {
    case 'admin':
      return { label: 'ADMIN', color: '#FF9800' };
    case 'commercial':
      return { label: 'COMMERCIAL', color: '#2196F3' };
    case 'individual':
      return { label: 'INDIVIDUAL', color: '#9C27B0' };
    default:
      return { label: 'UNKNOWN', color: '#757575' };
  }
}

/**
 * Check if customer is suspended
 * ✅ FIXED: Check status field instead of isSuspended
 */
export function isCustomerSuspended(customer: User): boolean {
  // Treat both 'suspended' and 'archived' as suspended (archiveCustomer sets 'archived')
  return customer.status === 'suspended' || customer.status === 'archived';
}

export function isCustomerArchived(customer: User): boolean {
  return customer.status === 'archived';
}

/**
 * Format customer date (approval date, etc.)
 */
export function formatCustomerDate(timestamp: any): string {
  if (!timestamp) return 'N/A';
  
  try {
    // Handle Firestore Timestamp
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    console.error('Error formatting customer date:', error);
    return 'Invalid Date';
  }
}