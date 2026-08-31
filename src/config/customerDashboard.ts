/**
 * CustomerDashboard Configuration Constants
 * 
 * Step 6: Configuration Constants - CustomerDashboard Optimization
 * 
 * This file centralizes all magic numbers, strings, and configuration values
 * used in the CustomerDashboard component.
 */

// ============================================================================
// ANIMATION & TIMING
// ============================================================================

export const ANIMATION = {
  /**
   * Page transition duration (matches cinema-quality fade)
   * Used by handlePageTransition utility
   */
  PAGE_TRANSITION_DURATION: 600, // ms

  /**
   * Scroll timeout after page transition
   * Ensures transition completes before scrolling
   */
  SCROLL_DELAY: 600, // ms

  /**
   * Auto-clear highlight duration
   * How long to keep a product highlighted after navigation
   */
  HIGHLIGHT_DURATION: 3600, // ms (3.6 seconds)

  /**
   * Debounce delay for cart auto-save
   */
  CART_SAVE_DEBOUNCE: 500, // ms
} as const;

// ============================================================================
// CATEGORY FILTERS
// ============================================================================

export const CATEGORY = {
  /**
   * Special category ID for "All Products"
   */
  ALL_PRODUCTS_ID: 'all',

  /**
   * Special category for featured products
   */
  FEATURED_CATEGORY_ID: 'cat-0',

  /**
   * Label for "All Products" filter
   */
  ALL_PRODUCTS_LABEL: 'All',
} as const;

// ============================================================================
// WEEK DAYS
// ============================================================================

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type Weekday = typeof WEEKDAYS[number];

// ============================================================================
// TAB LABELS
// ============================================================================

export const TAB_LABELS = {
  PLACE_ORDER: 'Place Order',
  PRODUCTS: 'Products Catalog',
  ACTIVE_ORDERS: 'Active Orders',
  PAYMENTS: 'Payments',
  ORDER_INVOICES: 'Order History',
  MY_PROFILE: 'My Profile',
} as const;

// ============================================================================
// TABLE CONFIGURATION
// ============================================================================

export const TABLE_CONFIG = {
  /**
   * Product table column widths
   */
  PRODUCT_COLUMNS: {
    PRODUCT_NAME: '30%',
    PRICE: '12%',
    DAY_COLUMN: '8%', // Each day column
    TOTAL: '10%',
  },

  /**
   * Orders table column widths
   */
  ORDER_COLUMNS: {
    ORDER_NUMBER: '15%',
    WEEK: '20%',
    STATUS: '15%',
    TOTAL: '15%',
    ACTIONS: '20%',
  },

  /**
   * Payments table column widths
   */
  PAYMENT_COLUMNS: {
    DATE: '20%',
    INVOICE: '20%',
    AMOUNT: '15%',
    METHOD: '15%',
    STATUS: '15%',
    RECEIPT: '15%',
  },
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

export const VALIDATION = {
  /**
   * Minimum quantity for a product order
   */
  MIN_QUANTITY: 0,

  /**
   * Maximum quantity for a product order (per day)
   */
  MAX_QUANTITY: 9999,

  /**
   * Minimum order note length
   */
  MIN_NOTE_LENGTH: 0,

  /**
   * Maximum order note length
   */
  MAX_NOTE_LENGTH: 500,
} as const;

// ============================================================================
// UI TEXT & MESSAGES
// ============================================================================

export const UI_TEXT = {
  // Empty states
  EMPTY_CART: 'Your cart is empty',
  EMPTY_CART_DESCRIPTION: 'Add products to get started',
  NO_PRODUCTS: 'No products available',
  NO_ORDERS: 'No orders found',
  NO_PAYMENTS: 'No payments found',

  // Loading states
  LOADING_PRODUCTS: 'Loading products...',
  LOADING_ORDERS: 'Loading orders...',
  LOADING_PAYMENTS: 'Loading payments...',

  // Success messages
  ORDER_SUBMITTED: 'Order submitted successfully!',
  CART_SAVED: 'Cart saved',
  PROFILE_UPDATED: 'Profile updated successfully',

  // Error messages
  LOAD_ERROR: 'Failed to load data',
  SUBMIT_ERROR: 'Failed to submit order',
  NETWORK_ERROR: 'Network error. Please try again.',
  VALIDATION_ERROR: 'Please fix validation errors',

  // Confirmation messages
  CONFIRM_SUBMIT: 'Are you sure you want to submit this order?',
  CONFIRM_CLEAR_CART: 'Are you sure you want to clear your cart?',
  CONFIRM_DELETE_ORDER: 'Are you sure you want to delete this order?',

  // Accessibility announcements
  TAB_CHANGED: 'Navigated to {tabName} tab',
  PRODUCT_ADDED: 'Added {productName} to cart',
  QUANTITY_UPDATED: 'Updated quantity for {productName}',
  ORDER_STATUS_CHANGED: 'Order status changed to {status}',
} as const;

// ============================================================================
// ARIA LABELS
// ============================================================================

export const ARIA_LABELS = {
  // Navigation
  MAIN_NAV: 'Main dashboard navigation',
  TAB_LIST: 'Dashboard sections',
  SKIP_TO_CONTENT: 'Skip to main content',

  // Forms
  QUANTITY_INPUT: 'Quantity for {day}',
  ORDER_NOTE_INPUT: 'Order notes and special instructions',
  SEARCH_INPUT: 'Search products',

  // Buttons
  SUBMIT_ORDER: 'Submit order',
  CLEAR_CART: 'Clear shopping cart',
  ADD_TO_CART: 'Add {productName} to cart',
  REMOVE_FROM_CART: 'Remove {productName} from cart',
  VIEW_ORDER: 'View order details',
  DOWNLOAD_INVOICE: 'Download invoice PDF',

  // Tables
  PRODUCTS_TABLE: 'Products table',
  ORDERS_TABLE: 'Orders table',
  PAYMENTS_TABLE: 'Payments table',

  // Status
  ORDER_STATUS: 'Order status: {status}',
  PAYMENT_STATUS: 'Payment status: {status}',
} as const;

// ============================================================================
// CART CONFIGURATION
// ============================================================================

export const CART_CONFIG = {
  /**
   */
  LOCAL_STORAGE_KEY: 'bakery_cart',

  /**
   * How often to auto-save cart (ms)
   */
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds

  /**
   * Maximum items in cart
   */
  MAX_ITEMS: 100,

  /**
   * Show cart summary threshold
   * Only show summary if cart has this many items
   */
  SUMMARY_THRESHOLD: 1,
} as const;

// ============================================================================
// PRODUCT DISPLAY
// ============================================================================

export const PRODUCT_DISPLAY = {
  /**
   * Number of products per page
   */
  ITEMS_PER_PAGE: 50,

  /**
   * Thumbnail image size
   */
  THUMBNAIL_SIZE: 64, // px

  /**
   * Grid layout breakpoints
   */
  GRID_BREAKPOINTS: {
    MOBILE: 1,
    TABLET: 2,
    DESKTOP: 3,
  },

  /**
   * Image placeholder color (when no image)
   */
  PLACEHOLDER_COLOR: '#D4A574',
} as const;

// ============================================================================
// ORDER STATUS
// ============================================================================

export const ORDER_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  IN_PROGRESS: 'in-progress',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ============================================================================
// PAYMENT STATUS
// ============================================================================

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// ============================================================================
// COLOR PALETTE (Premium Black & Gold)
// ============================================================================

export const COLORS = {
  // Primary colors
  GOLD: '#D4A574',
  BLACK: '#0a0a0a',
  WHITE: '#ffffff',

  // Text colors
  TEXT_PRIMARY: '#3d3832',
  TEXT_SECONDARY: '#6b6b6b',
  TEXT_MUTED: '#999999',

  // Background colors
  BG_PRIMARY: '#0a0a0a',
  BG_SECONDARY: '#1a1a1a',
  BG_CARD: '#ffffff',
  BG_HOVER: '#f5f1eb',

  // Border colors
  BORDER_PRIMARY: '#D4A574',
  BORDER_SECONDARY: '#e5e5e5',
  BORDER_MUTED: 'rgba(212, 165, 116, 0.3)',

  // Status colors
  STATUS_SUCCESS: '#10b981',
  STATUS_WARNING: '#f59e0b',
  STATUS_ERROR: '#ef4444',
  STATUS_INFO: '#3b82f6',
} as const;

// ============================================================================
// RESPONSIVE BREAKPOINTS
// ============================================================================

export const BREAKPOINTS = {
  MOBILE: 640, // px
  TABLET: 768, // px
  DESKTOP: 1024, // px
  LARGE: 1280, // px
  XLARGE: 1536, // px
} as const;

// ============================================================================
// Z-INDEX LAYERS
// ============================================================================

export const Z_INDEX = {
  MODAL_BACKDROP: 40,
  MODAL_CONTENT: 50,
  TOAST: 60,
  TOOLTIP: 70,
  DROPDOWN: 30,
  STICKY_HEADER: 20,
  OVERLAY: 10,
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = {
  /**
   * Enable product search
   */
  ENABLE_SEARCH: true,

  /**
   * Enable category filtering
   */
  ENABLE_CATEGORY_FILTER: true,

  /**
   * Enable cart persistence
   */
  ENABLE_CART_PERSISTENCE: true,

  /**
   * Enable order notes
   */
  ENABLE_ORDER_NOTES: true,

  /**
   * Enable credit application
   */
  ENABLE_CREDIT: true,

  /**
   * Enable delivery options
   */
  ENABLE_DELIVERY: true,

  /**
   * Show product images
   */
  SHOW_PRODUCT_IMAGES: true,

  /**
   * Enable keyboard shortcuts
   */
  ENABLE_SHORTCUTS: true,
} as const;

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  SUBMIT_ORDER: 'Ctrl+Enter',
  CLEAR_CART: 'Ctrl+Shift+C',
  FOCUS_SEARCH: 'Ctrl+K',
  NEXT_TAB: 'Ctrl+]',
  PREV_TAB: 'Ctrl+[',
} as const;

// ============================================================================
// EXPORT ALL CONSTANTS
// ============================================================================

export const CUSTOMER_DASHBOARD_CONFIG = {
  ANIMATION,
  CATEGORY,
  WEEKDAYS,
  TAB_LABELS,
  TABLE_CONFIG,
  VALIDATION,
  UI_TEXT,
  ARIA_LABELS,
  CART_CONFIG,
  PRODUCT_DISPLAY,
  ORDER_STATUS,
  PAYMENT_STATUS,
  COLORS,
  BREAKPOINTS,
  Z_INDEX,
  FEATURES,
  KEYBOARD_SHORTCUTS,
} as const;

export default CUSTOMER_DASHBOARD_CONFIG;
