import { ReactElement } from 'react';
import {
  FileText,
  Users,
  Receipt,
  ClipboardCheck,
  Package,
  Settings as SettingsIcon,
  BarChart3,
  AlertTriangle,
  Loader,
  History,
} from 'lucide-react';
import { BADGE_THEMES } from '../components/theme/NavigationStyles';

// ═══════════════════════════════════════════════════════════════════════════
// PAGE ID TYPE DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All possible admin pages
 * ✅ SINGLE SOURCE OF TRUTH for page IDs
 */
export type AdminPage =
  // Main sections
  | 'analytics'
  | 'customers'
  | 'products'
  | 'settings'
  // Account management
  | 'registrations'
  // Order management (main)
  | 'pending'
  | 'unpaid'
  | 'approved'
  | 'history'
  // Reporting
  | 'weekly-invoices'
  | 'production-todo';

/**
 * Navigation group - organizes pages into logical sections
 */
export type NavGroup = 'sidebar' | 'main' | 'orders';

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION ITEM INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface NavItem {
  /** Unique page ID */
  id: AdminPage;
  /** Navigation group this item belongs to */
  group: NavGroup;
  /** Icon component */
  icon: ReactElement;
  /** Full label (desktop) */
  label: string;
  /** Short label (mobile) */
  shortLabel: string;
  /** Badge theme (from BADGE_THEMES) */
  badgeTheme?: keyof typeof BADGE_THEMES;
  /** Badge aria-label */
  badgeLabel?: string;
  /** Order within group (lower = earlier) */
  order: number;
  /** Parent page (for sub-navigation) */
  parentPage?: AdminPage;
}

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL NAVIGATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete navigation structure
 * ✅ Add/remove pages here ONLY
 */
export const ADMIN_NAV_CONFIG: NavItem[] = [
  // ============================================
  // SIDEBAR NAVIGATION (Mobile Menu)
  // ============================================
  {
    id: 'analytics',
    group: 'sidebar',
    icon: <BarChart3 className="w-5 h-5 flex-shrink-0" />,
    label: 'Analytics',
    shortLabel: 'Analytics',
    order: 1,
  },
  {
    id: 'customers',
    group: 'sidebar',
    icon: <Users className="w-5 h-5 flex-shrink-0" />,
    label: 'Customers',
    shortLabel: 'Customers',
    order: 2,
  },
  {
    id: 'products',
    group: 'sidebar',
    icon: <Package className="w-5 h-5 flex-shrink-0" />,
    label: 'Products',
    shortLabel: 'Products',
    order: 3,
  },
  {
    id: 'settings',
    group: 'sidebar',
    icon: <SettingsIcon className="w-5 h-5 flex-shrink-0" />,
    label: 'Settings',
    shortLabel: 'Settings',
    order: 4,
  },

  // ============================================
  // MAIN NAVIGATION (Top Bar)
  // ============================================
  {
    id: 'pending',
    group: 'main',
    icon: <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Manage Orders',
    shortLabel: 'Orders',
    badgeTheme: 'orange',
    badgeLabel: 'pending orders',
    order: 1,
  },
  {
    id: 'registrations',
    group: 'main',
    icon: <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Accounts',
    shortLabel: 'Accounts',
    badgeTheme: 'purple',
    badgeLabel: 'pending registrations',
    order: 2,
  },
  {
    id: 'production-todo',
    group: 'main',
    icon: <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Production To Do',
    shortLabel: 'To Do',
    order: 3,
  },

  // ============================================
  // ORDER SUB-NAVIGATION (Filters)
  // ============================================
  {
    id: 'pending',
    group: 'orders',
    icon: <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Pending Orders',
    shortLabel: 'Pending',
    badgeTheme: 'orange',
    badgeLabel: 'pending orders',
    order: 1,
    parentPage: 'pending',
  },
  {
    id: 'unpaid',
    group: 'orders',
    icon: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Awaiting Payment',
    shortLabel: 'Unpaid',
    badgeTheme: 'red',
    badgeLabel: 'unpaid orders',
    order: 2,
    parentPage: 'pending',
  },
  {
    id: 'approved',
    group: 'orders',
    icon: <Loader className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'In Process',
    shortLabel: 'In Process',
    badgeTheme: 'green',
    badgeLabel: 'orders in process',
    order: 3,
    parentPage: 'pending',
  },
  {
    id: 'weekly-invoices',
    group: 'orders',
    icon: <Receipt className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Invoices',
    shortLabel: 'Invoices',
    order: 4,
    parentPage: 'pending',
  },
  {
    id: 'history',
    group: 'orders',
    icon: <History className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />,
    label: 'Order History',
    shortLabel: 'History',
    order: 5,
    parentPage: 'pending',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get navigation items for a specific group
 * @param group Navigation group
 * @returns Sorted array of nav items
 */
export function getNavItemsByGroup(group: NavGroup): NavItem[] {
  return ADMIN_NAV_CONFIG
    .filter(item => item.group === group)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get navigation item by page ID
 * @param pageId Page ID
 * @param group Optional group filter
 * @returns Nav item or undefined
 */
export function getNavItem(pageId: AdminPage, group?: NavGroup): NavItem | undefined {
  return ADMIN_NAV_CONFIG.find(
    item => item.id === pageId && (group ? item.group === group : true)
  );
}

/**
 * Check if a page is part of the orders section
 * @param pageId Page ID
 * @returns True if page is in orders group
 */
export function isOrdersPage(pageId: AdminPage): boolean {
  return ['pending', 'unpaid', 'approved', 'weekly-invoices', 'history'].includes(pageId);
}

/**
 * Get active parent page for sub-navigation highlighting
 * @param currentPage Current page ID
 * @returns Parent page ID or undefined
 */
export function getActiveParentPage(currentPage: AdminPage): AdminPage | undefined {
  if (isOrdersPage(currentPage)) {
    return 'pending'; // All order pages have 'pending' as parent in main nav
  }
  return currentPage;
}

/**
 * Validate page ID at runtime
 * @param pageId Potential page ID
 * @returns True if valid page ID
 */
export function isValidAdminPage(pageId: string): pageId is AdminPage {
  return ADMIN_NAV_CONFIG.some(item => item.id === pageId);
}
