/**
 * Permission Constants
 * ✅ FEB 18, 2026: Centralized role-based access control
 * 
 * PURPOSE:
 * - Type-safe permission checks
 * - Single source of truth for authorization rules
 * - Easy to extend with new roles and permissions
 * 
 * USAGE:
 * ```typescript
 * import { USER_ROLES, PERMISSIONS, hasPermission } from '@/constants/permissions';
 * 
 * // Check if user has permission
 * if (hasPermission(user.role, PERMISSIONS.orders.approve)) {
 *   // Show approve button
 * }
 * 
 * // Check if user is admin
 * if (user.role === USER_ROLES.ADMIN) {
 *   // Admin-only logic
 * }
 * ```
 */

/**
 * User Role Definitions
 */
export const USER_ROLES = {
  /**
   * Customer Role
   * - Can place orders
   * - Can view own orders
   * - Can submit payment proof
   * - Can update own profile
   */
  CUSTOMER: 'customer',

  /**
   * Admin Role
   * - Full access to all features
   * - Can manage orders, customers, products
   * - Can approve/reject orders
   * - Can confirm payments
   * - Can view analytics
   */
  ADMIN: 'admin',

  /**
   * Production Role (Future)
   * - Can view production schedules
   * - Can mark items as completed
   * - Cannot approve orders or handle payments
   */
  PRODUCTION: 'production',

  /**
   * Accounting Role (Future)
   * - Can view financial reports
   * - Can confirm payments
   * - Cannot modify orders or products
   */
  ACCOUNTING: 'accounting',
} as const;

/**
 * Permission Definitions
 * Granular permissions for specific actions
 */
export const PERMISSIONS = {
  /**
   * Order Permissions
   */
  orders: {
    create: 'orders:create',
    read: 'orders:read',
    readOwn: 'orders:read:own',
    readAll: 'orders:read:all',
    update: 'orders:update',
    updateOwn: 'orders:update:own',
    updateAll: 'orders:update:all',
    delete: 'orders:delete',
    deleteOwn: 'orders:delete:own',
    deleteAll: 'orders:delete:all',
    approve: 'orders:approve',
    reject: 'orders:reject',
    cancel: 'orders:cancel',
  },

  /**
   * Payment Permissions
   */
  payments: {
    submit: 'payments:submit',
    confirm: 'payments:confirm',
    viewAll: 'payments:view:all',
  },

  /**
   * Product Permissions
   */
  products: {
    view: 'products:view',
    manage: 'products:manage',
    create: 'products:create',
    update: 'products:update',
    delete: 'products:delete',
    updateInventory: 'products:updateInventory',
  },

  /**
   * Customer Permissions
   */
  customers: {
    viewOwn: 'customers:view:own',
    viewAll: 'customers:view:all',
    updateOwn: 'customers:update:own',
    updateAll: 'customers:update:all',
    manage: 'customers:manage',
    suspend: 'customers:suspend',
    delete: 'customers:delete',
  },

  /**
   * Registration Permissions
   */
  registrations: {
    submit: 'registrations:submit',
    approve: 'registrations:approve',
    reject: 'registrations:reject',
  },

  /**
   * Analytics Permissions
   */
  analytics: {
    view: 'analytics:view',
    export: 'analytics:export',
  },

  /**
   * System Permissions
   */
  system: {
    manageSettings: 'system:settings',
    viewLogs: 'system:logs',
    manageUsers: 'system:users',
  },
} as const;

/**
 * Role-Permission Mapping
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS = {
  /**
   * Customer Permissions
   */
  [USER_ROLES.CUSTOMER]: [
    // Orders
    PERMISSIONS.orders.create,
    PERMISSIONS.orders.readOwn,
    PERMISSIONS.orders.updateOwn,
    PERMISSIONS.orders.cancel,
    
    // Payments
    PERMISSIONS.payments.submit,
    
    // Products
    PERMISSIONS.products.view,
    
    // Customer
    PERMISSIONS.customers.viewOwn,
    PERMISSIONS.customers.updateOwn,
    
    // Registrations
    PERMISSIONS.registrations.submit,
  ],

  /**
   * Admin Permissions (Full Access)
   */
  [USER_ROLES.ADMIN]: [
    // Orders - All
    ...Object.values(PERMISSIONS.orders),
    
    // Payments - All
    ...Object.values(PERMISSIONS.payments),
    
    // Products - All
    ...Object.values(PERMISSIONS.products),
    
    // Customers - All
    ...Object.values(PERMISSIONS.customers),
    
    // Registrations - All
    ...Object.values(PERMISSIONS.registrations),
    
    // Analytics - All
    ...Object.values(PERMISSIONS.analytics),
    
    // System - All
    ...Object.values(PERMISSIONS.system),
  ],

  /**
   * Production Permissions (Future)
   */
  [USER_ROLES.PRODUCTION]: [
    // Orders - Read only
    PERMISSIONS.orders.readAll,
    
    // Products - View and update inventory
    PERMISSIONS.products.view,
    PERMISSIONS.products.updateInventory,
  ],

  /**
   * Accounting Permissions (Future)
   */
  [USER_ROLES.ACCOUNTING]: [
    // Orders - Read only
    PERMISSIONS.orders.readAll,
    
    // Payments - View and confirm
    PERMISSIONS.payments.viewAll,
    PERMISSIONS.payments.confirm,
    
    // Analytics - View only
    PERMISSIONS.analytics.view,
    PERMISSIONS.analytics.export,
  ],
} as const;

/**
 * Type-safe role and permission types
 */
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type Permission = string;

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (
  role: UserRole,
  permission: Permission
): boolean => {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return (rolePermissions as readonly string[]).includes(permission);
};

/**
 * Check if user can perform an action on their own resource
 */
export const canAccessOwnResource = (
  role: UserRole,
  resourceUserId: string,
  currentUserId: string,
  permission: Permission
): boolean => {
  // Admins can access everything
  if (role === USER_ROLES.ADMIN) return true;
  
  // Check if it's their own resource
  if (resourceUserId !== currentUserId) return false;
  
  // Check if they have the permission
  return hasPermission(role, permission);
};

/**
 * Check if user is admin
 */
export const isAdmin = (role: UserRole): boolean => {
  return role === USER_ROLES.ADMIN;
};

/**
 * Check if user is customer
 */
export const isCustomer = (role: UserRole): boolean => {
  return role === USER_ROLES.CUSTOMER;
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: UserRole): Permission[] => {
  return [...(ROLE_PERMISSIONS[role] || [])] as Permission[];
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (
  role: UserRole,
  permissions: Permission[]
): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (
  role: UserRole,
  permissions: Permission[]
): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * Role Display Names
 */
export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.CUSTOMER]: 'Customer',
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.PRODUCTION]: 'Production Staff',
  [USER_ROLES.ACCOUNTING]: 'Accounting',
} as const;

/**
 * Get display name for a role
 */
export const getRoleDisplayName = (role: UserRole): string => {
  return ROLE_DISPLAY_NAMES[role] || role;
};
