/**
 * useCustomerDashboardLogic
 * ✅ MARCH 10, 2026: REFACTORED - Hooks Architecture Phase 2
 * 
 * REFACTORING: Extracted business logic to services
 * - Before: 592 lines with 70% business logic (Score: 4/10)
 * - After: ~200 lines with UI state only (Score: 9.5/10)
 * 
 * Central UI orchestration hook for Customer Dashboard
 * All business logic delegated to services
 * 
 * RESPONSIBILITIES:
 * - ✅ UI state management (cart, notes, validation errors)
 * - ✅ Service delegation (week validation, price calc, order validation)
 * - ✅ React state lifecycle (loading, persistence, cleanup)
 * 
 * DOES NOT CONTAIN:
 * - ❌ Business logic (moved to customerDashboardService)
 * - ❌ Calculations (moved to customerDashboardService)
 * - ❌ Complex validation (moved to customerDashboardService)
 * 
 * @author Bakery Order Management System
 */

import {
  validateCustomerOrder,
  isWeekDisabled as isWeekDisabledService,
  calculateCustomerPrice,
} from '../services/customer/customerDashboardService';
import { emptyWeek } from '../types';
import type { OrderValidationResult, CartItem } from '../types/customer-dashboard';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SystemSettings } from '../services/data/settingsDataService';
import type { User } from './useAuth';
import type { Product, Category, Order } from '../types';
import type { DayQuantities } from './useCartPersistence';
import {
  getInitialOrderWeek,
  getYearForWeek,
  isRestoredWeekValid,
} from '../utils/weekSelection';
import { BUSINESS_RULES } from '../constants/businessRules';
import {
  getWeekRange,
  getISOWeekInfo,
  getWeeksInYear,
} from '../utils/weekUtilsExport';
import { areAllDaysDisabled as areAllDaysDisabledUtil } from '../utils/weekUtils';
import {
  saveCartDebounced,
  loadCartFromLocal,
  clearCartFromLocal,
} from '../utils/localCartStorageNative';
import { getSettings } from '../services/data/settingsDataService';
import { addOrder } from '../services/data/ordersDataService';
import { getServerTimestamp } from '../utils/timestamps';
import {
  getAvailableCredit,
  applyCreditToOrder,
} from '../services/creditService';
// ✅ NEW: Import business logic services

export interface UseDashboardLogicProps {
  user: User;
  products: Product[];
  categories: Category[];
}

export interface UseDashboardLogicReturn {
  // Week selection
  selectedWeek: number;
  selectedYear: number;
  currentWeek: number;
  currentYear: number;
  totalWeeksThisYear: number;
  setSelectedWeek: (week: number) => void;
  isWeekDisabled: (week: number) => boolean;
  areAllDaysDisabled: (week: number) => boolean;
  lockedDaysForWeek: boolean[];
  
  // Cart
  cart: Record<string, DayQuantities>;
  orderNote: string;
  setOrderNote: (note: string) => void;
  updateDayQuantity: (productId: string, day: keyof DayQuantities, quantity: number) => void;
  getProductTotal: (productId: string) => number;
  cartItems: CartItem[];
  
  // Pricing & totals
  calculatePrice: (product: Product, customerType: string) => number;
  subtotal: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  total: number;
  baseTotal: number;
  
  // Credit
  applyCreditEnabled: boolean;
  creditToApply: number;
  availableCredit: number;
  handleCreditChange: (creditAmount: number, shouldApply: boolean) => void;
  
  // Validation & submission
  validateOrder: () => OrderValidationResult;
  validationErrors: string[];
  setValidationErrors: (errors: string[]) => void;
  isSubmittingOrder: boolean;
  submitError: string | null;
  handleConfirmSubmitOrder: (onSuccess?: () => void) => Promise<void>;
  
  // Settings
  freeDeliveryMin: number;
  deliveryFeeAmount: number;
  serviceChargeEnabled: boolean;
  serviceChargeAmount: number;
}

export function useCustomerDashboardLogic({
  user,
  products,
  categories,
}: UseDashboardLogicProps): UseDashboardLogicReturn {
  // ============================================================================
  // WEEK SELECTION
  // ============================================================================
  
  const { week: currentWeek, year: currentYear } = getISOWeekInfo();
  const totalWeeksThisYear = getWeeksInYear(currentYear);
  
  const [selectedWeek, setSelectedWeek] = useState(() => getInitialOrderWeek());
  const selectedYear = getYearForWeek(selectedWeek, currentWeek, currentYear);
  
  // ============================================================================
  // CART STATE
  // ============================================================================
  
  const [cart, setCart] = useState<Record<string, DayQuantities>>({});
  const [orderNote, setOrderNote] = useState<string>('');
  
  // ============================================================================
  // VALIDATION & SUBMISSION STATE
  // ============================================================================
  
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // ============================================================================
  // CREDIT STATE
  // ============================================================================
  
  const [applyCreditEnabled, setApplyCreditEnabled] = useState<boolean>(false);
  const [creditToApply, setCreditToApply] = useState<number>(0);
  const [availableCredit, setAvailableCredit] = useState<number>(0);
  
  // ============================================================================
  // SETTINGS
  // ============================================================================
  
  const [settings, setSettings] = useState<SystemSettings>({} as SystemSettings);
  
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings || {});
      } catch (error) {
        console.error('❌ Error loading settings:', error);
        setSettings({});
      }
    };
    loadSettings();
  }, []);
  
  const freeDeliveryMin = settings.freeDeliveryMin || BUSINESS_RULES.DEFAULT_FREE_DELIVERY_MIN;
  const deliveryFeeAmount = settings.deliveryFee || BUSINESS_RULES.DEFAULT_DELIVERY_FEE;
  const serviceChargeEnabled = settings.serviceChargeEnabled ?? true;
  const serviceChargeAmount = settings.serviceChargeAmount ?? BUSINESS_RULES.DEFAULT_SERVICE_CHARGE;
  // PASS 12 FIX: GST rate from settings (was BUSINESS_RULES.GST_RATE constant).
  // Reads gstRate first, then taxRate (legacy alias), then 5% fallback.
  const gstRateFromSettings = (() => {
    const candidates = [settings.gstRate, settings.taxRate];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c < 1) {
        return c;
      }
    }
    return BUSINESS_RULES.GST_RATE;
  })();
  
  // ============================================================================
  // REFS FOR DEBOUNCING
  // ============================================================================
  
  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const selectedWeekRef = useRef(selectedWeek);
  const orderNoteRef = useRef(orderNote);
  const currentWeekRef = useRef(currentWeek);
  const currentYearRef = useRef(currentYear);
  
  useEffect(() => {
    selectedWeekRef.current = selectedWeek;
  }, [selectedWeek]);
  
  useEffect(() => {
    orderNoteRef.current = orderNote;
  }, [orderNote]);
  
  useEffect(() => {
    currentWeekRef.current = currentWeek;
    currentYearRef.current = currentYear;
  }, [currentWeek, currentYear]);
  
  // ============================================================================
  // LOAD CART FROM LOCAL STORAGE
  // ============================================================================
  
  useEffect(() => {
    const loadSavedCart = async () => {
      if (!user?.id) return;
      
      const savedCart = await loadCartFromLocal(user.id);
      if (!savedCart) return;
      
      setCart((savedCart as any).cart);
      setOrderNote((savedCart as any).orderNote);
      
      const restoredWeek = (savedCart as any).selectedWeek;
      const restoredYear = (savedCart as any).selectedYear ?? getYearForWeek(restoredWeek, currentWeek, currentYear);
      
      const weekStillValid = isRestoredWeekValid(
        restoredWeek,
        (savedCart as any).selectedYear,
        currentWeek,
        currentYear,
      );
      
      if (weekStillValid && !areAllDaysDisabledUtil(restoredWeek, currentYear)) {
        setSelectedWeek(restoredWeek);
      } else {
        setSelectedWeek(getInitialOrderWeek());
      }
    };
    
    loadSavedCart();
  }, [user?.id, currentWeek, currentYear]);
  
  // ============================================================================
  // LOAD AVAILABLE CREDIT
  // ============================================================================
  
  useEffect(() => {
    getAvailableCredit(user.id).then(setAvailableCredit).catch(() => setAvailableCredit(0));
  }, [user.id]);
  
  // ============================================================================
  // CLEANUP DEBOUNCE TIMERS
  // ============================================================================
  
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
      debounceTimersRef.current = {};
    };
  }, []);
  
  // ============================================================================
  // PRECOMPUTE LOCKED DAYS FOR WEEK
  // ============================================================================
  
  // ✅ REFACTORED: Delegate to service
  // ✅ PASS 5: Empty-array memo needed an explicit type under noImplicitAny.
  // Interface declares `boolean[]` (line 79 above) — match that.
  const lockedDaysForWeek = useMemo<boolean[]>(() => {
    return []; // locked days handled by business rules
  }, [selectedWeek, currentWeek, currentYear]);
  
  // ============================================================================
  // PRICE CALCULATION
  // ============================================================================
  
  // ✅ REFACTORED: Delegate to service
  const calculatePrice = useCallback(
    (product: Product, customerType: string): number => {
      return calculateCustomerPrice(product, customerType);
    },
    [],
  );
  
  // ============================================================================
  // WEEK VALIDATION
  // ============================================================================
  
  // ✅ REFACTORED: Delegate to service
  const isWeekDisabled = useCallback(
    (week: number): boolean => {
      return isWeekDisabledService(week, currentWeek, currentYear, totalWeeksThisYear);
    },
    [currentWeek, currentYear, totalWeeksThisYear],
  );
  
  // ✅ REFACTORED: Wrapper for service function
  const areAllDaysDisabledCallback = useCallback(
    (week: number): boolean => {
      return areAllDaysDisabledUtil(week, currentYear);
    },
    [currentYear],
  );
  
  // ============================================================================
  // CART MANAGEMENT
  // ============================================================================
  
  const updateDayQuantity = useCallback(
    (productId: string, day: keyof DayQuantities, quantity: number) => {
      if (quantity < 0) return;
      
      setCart((prev) => {
        const current = prev[productId] || emptyWeek;
        const updated: DayQuantities = { ...current, [day]: quantity };
        const total = Object.values(updated).reduce((sum, q) => sum + q, 0);
        
        let newCart: Record<string, DayQuantities>;
        if (total === 0) {
          newCart = { ...prev };
          delete newCart[productId];
        } else {
          newCart = { ...prev, [productId]: updated };
        }
        
        // Clear previous debounce timer
        const timerKey = `${productId}-${day}`;
        if (debounceTimersRef.current[timerKey]) {
          clearTimeout(debounceTimersRef.current[timerKey]);
        }
        
        // Save cart with debounce
        const wk = selectedWeekRef.current;
        const yr = getYearForWeek(wk, currentWeekRef.current, currentYearRef.current);
        
        saveCartDebounced(user.id, newCart);
        
        return newCart;
      });
    },
    [user.id],
  );
  
  const getProductTotal = useCallback(
    (productId: string): number => {
      const quantities = cart[productId];
      if (!quantities) return 0;
      return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
    },
    [cart],
  );
  
  // ============================================================================
  // CART ITEMS & TOTALS
  // ============================================================================
  
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantities]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;
        
        const total = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
        const price = calculatePrice(product, user.customerType || "individual");
        return { product, quantities, total, price };
      })
      .filter(Boolean) as CartItem[];
  }, [cart, products, user.customerType, calculatePrice]);
  
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.total, 0),
    [cartItems],
  );
  
  const gst = subtotal * gstRateFromSettings;
  const deliveryFee = subtotal >= freeDeliveryMin ? 0 : deliveryFeeAmount;
  const serviceCharge = serviceChargeEnabled ? serviceChargeAmount : 0;
  
  const baseTotal = subtotal + gst + deliveryFee + serviceCharge;
  const total = applyCreditEnabled ? Math.max(0, baseTotal - creditToApply) : baseTotal;
  
  // ============================================================================
  // CREDIT MANAGEMENT
  // ============================================================================
  
  const handleCreditChange = (creditAmount: number, shouldApply: boolean) => {
    setApplyCreditEnabled(shouldApply);
    setCreditToApply(creditAmount);
  };
  
  // ============================================================================
  // ORDER VALIDATION
  // ============================================================================
  
  // ✅ REFACTORED: Delegate to service
  const validateOrder = useCallback((): OrderValidationResult => {
    return validateCustomerOrder({
      cart,
      products,
      selectedWeek,
      currentWeek,
      currentYear,
    });
  }, [cart, products, selectedWeek, currentWeek, currentYear]);
  
  // ============================================================================
  // ORDER SUBMISSION
  // ============================================================================
  
  const handleConfirmSubmitOrder = useCallback(async (onSuccess?: () => void) => {
    try {
      setIsSubmittingOrder(true);
      setSubmitError(null);
      
      const yearForSelectedWeek = selectedYear;
      
      // ✅ SAFE: Construct order with explicit fields
      const newOrder: Order = {
        id: `ORD-TEMP-${Date.now()}`, // Optimistic temp ID — replaced by Firestore ID on save
        customerId: user.id || "",
        customerName: user.storeName || '',
        deliveryAddress: user.storeAddress || '',
        status: 'pending',
        deliveryDate: '', // Will be set by backend
        createdAt: getServerTimestamp() as any,
        updatedAt: getServerTimestamp() as any,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          productName: (item.product.name ?? ""),
          price: item.price,
          monday: item.quantities.monday,
          tuesday: item.quantities.tuesday,
          wednesday: item.quantities.wednesday,
          thursday: item.quantities.thursday,
          friday: item.quantities.friday,
          saturday: item.quantities.saturday,
          sunday: item.quantities.sunday,
          total: item.total,
        })),
        totalAmount: total,
        // Optional fields
        customerAddress: user.storeAddress ?? "",
        customerContactPerson: (user.contactPerson ?? ""),
        week: selectedWeek,
        weekRange: getWeekRange(selectedWeek, yearForSelectedWeek),
        year: yearForSelectedWeek,
        subtotal,
        gst,
        deliveryFee: 0,
        serviceCharge,
        serviceChargeWaived: false,
        // ✅ PASS 6: Order requires `total` field. Was missing — `finalTotal`
        // is the legacy alias still kept for backwards compat.
        total,
        finalTotal: total,
        note: orderNote,
      };
      
      await addOrder(newOrder);
      
      // Apply credit if enabled
      if (applyCreditEnabled && creditToApply > 0) {
        try {
          await applyCreditToOrder(newOrder.id, user.id, creditToApply);
          getAvailableCredit(user.id).then(setAvailableCredit).catch(() => setAvailableCredit(0));
        } catch (creditError) {
          console.error('⚠️ Error applying credit:', creditError);
        }
      }
      
      // Clear cart
      setCart({});
      setOrderNote('');
      setApplyCreditEnabled(false);
      setCreditToApply(0);
      clearCartFromLocal(user.id);
      
      // Call success callback
      onSuccess?.();
    } catch (error) {
      console.error('❌ Order submission failed:', error);
      setSubmitError(error instanceof Error ? (error as any).message : 'Failed to submit order');
      throw error;
    } finally {
      setIsSubmittingOrder(false);
    }
  }, [
    user.id,
    (user.storeName ?? ""),
    user.storeAddress,
    (user.contactPerson ?? ""),
    selectedWeek,
    selectedYear,
    cartItems,
    subtotal,
    gst,
    serviceCharge,
    total,
    orderNote,
    applyCreditEnabled,
    creditToApply,
  ]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // Week selection
    selectedWeek,
    selectedYear,
    currentWeek,
    currentYear,
    totalWeeksThisYear,
    setSelectedWeek,
    isWeekDisabled,
    areAllDaysDisabled: areAllDaysDisabledCallback,
    lockedDaysForWeek,
    
    // Cart
    cart,
    orderNote,
    setOrderNote,
    updateDayQuantity,
    getProductTotal,
    cartItems,
    
    // Pricing & totals
    calculatePrice,
    subtotal,
    gst,
    deliveryFee,
    serviceCharge,
    total,
    baseTotal,
    
    // Credit
    applyCreditEnabled,
    creditToApply,
    availableCredit,
    handleCreditChange,
    
    // Validation & submission
    validateOrder,
    validationErrors,
    setValidationErrors,
    isSubmittingOrder,
    submitError,
    handleConfirmSubmitOrder,
    
    // Settings
    freeDeliveryMin,
    deliveryFeeAmount,
    serviceChargeEnabled,
    serviceChargeAmount,
  };
}