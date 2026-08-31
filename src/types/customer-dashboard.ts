/**
 * CustomerDashboard Type Definitions
 * Centralized type safety for the customer dashboard component
 */

import type { User } from "../hooks/useAuth";
import type { Product, Order, Category } from "../types";
import type { DayQuantities } from "../hooks/useCartPersistence";

// ==========================================
// ENUMS
// ==========================================

/**
 * Customer Dashboard Tab Types
 * Defines all available navigation tabs
 */
export enum DashboardTab {
  PLACE_ORDER = "place-order",
  PRODUCTS = "products",
  ACTIVE_ORDERS = "active-orders",
  OUTSTANDING = "outstanding",
  ORDER_INVOICES = "order-invoices",
  MY_PROFILE = "my-profile",
}

/**
 * Customer Type Enum
 * Defines pricing tier types
 */
export enum CustomerType {
  COMMERCIAL = "commercial",
  RETAIL = "retail",
}

/**
 * Week Day Keys
 * Standardized day keys for cart operations
 */
export enum WeekDay {
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
  SUNDAY = "sunday",
}

// ==========================================
// INTERFACES
// ==========================================

/**
 * CustomerDashboard Component Props
 */
export interface CustomerDashboardProps {
  user: User;
  onLogout: () => void;
  setCurrentPage?: (page: string) => void; // Optional - not used internally, kept for backward compatibility
}

/**
 * Cart Item with calculated totals
 */
export interface CartItem {
  product: Product;
  quantities: DayQuantities;
  total: number;
  price: number;
}

/**
 * Order Validation Result
 */
export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Day Label Mapping
 * Used for validation error messages
 */
export interface DayLabel {
  key: keyof DayQuantities;
  label: string;
}

/**
 * Week Selection State
 */
export interface WeekSelectionState {
  selectedWeek: number;
  selectedYear: number;
  currentWeek: number;
  currentYear: number;
}

/**
 * Cart Total Breakdown
 */
export interface CartTotals {
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  creditApplied: number;
  baseTotal: number;
  finalTotal: number;
}

/**
 */
export interface DashboardSettings {
  deliveryFee: number;
  gstRate: number;
  serviceChargeRate: number;
  serviceChargeAppliesTo: string;
}

/**
 * Credit Application State
 */
export interface CreditState {
  enabled: boolean;
  amount: number;
  available: number;
}

/**
 * Layout Configuration
 */
export interface LayoutConfig {
  headerHeight: number;
  stickyOffset: string;
  stickyOffsetMd: string;
}

// ==========================================
// TYPE GUARDS
// ==========================================

/**
 * Type guard to check if a string is a valid DashboardTab
 */
export function isDashboardTab(value: string): value is DashboardTab {
  return Object.values(DashboardTab).includes(value as DashboardTab);
}

/**
 * Type guard to check if a string is a valid CustomerType
 */
export function isCustomerType(value: string): value is CustomerType {
  return Object.values(CustomerType).includes(value as CustomerType);
}

/**
 * Type guard to check if a string is a valid WeekDay
 */
export function isWeekDay(value: string): value is WeekDay {
  return Object.values(WeekDay).includes(value as WeekDay);
}

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * Tab-specific data type
 * Maps each tab to its required data type
 */
export type TabData = {
  [DashboardTab.PLACE_ORDER]: {
    cart: Record<string, DayQuantities>;
    selectedWeek: number;
    selectedYear: number;
  };
  [DashboardTab.PRODUCTS]: {
    categories: Category[];
    products: Product[];
  };
  [DashboardTab.ACTIVE_ORDERS]: {
    orders: Order[];
  };
  [DashboardTab.OUTSTANDING]: {
    unpaidOrders: Order[];
  };
  [DashboardTab.ORDER_INVOICES]: {
    invoices: Order[];
  };
  [DashboardTab.MY_PROFILE]: {
    user: User;
  };
};

/**
 * Event Handler Types
 */
export type TabChangeHandler = (tab: DashboardTab) => void;
export type QuantityChangeHandler = (
  productId: string,
  day: keyof DayQuantities,
  quantity: number
) => void;
export type ProductFocusHandler = (productId: string | null) => void;

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Day labels for validation messages
 */
export const DAY_LABELS: readonly DayLabel[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

/**
 * Tab metadata for rendering
 */
export interface TabMetadata {
  id: DashboardTab;
  label: string;
  icon: string; // Icon name from lucide-react
  badge?: boolean; // Show notification badge
}

export const TAB_METADATA: readonly TabMetadata[] = [
  { id: DashboardTab.PLACE_ORDER, label: "Place Order", icon: "ShoppingCart" },
  { id: DashboardTab.PRODUCTS, label: "Products", icon: "Package" },
  { id: DashboardTab.ACTIVE_ORDERS, label: "Active Orders", icon: "ClipboardCheck", badge: true },
  { id: DashboardTab.OUTSTANDING, label: "Outstanding", icon: "CreditCard", badge: true },
  { id: DashboardTab.ORDER_INVOICES, label: "Order History", icon: "FileText" },
  { id: DashboardTab.MY_PROFILE, label: "My Profile", icon: "UserCircle" },
] as const;