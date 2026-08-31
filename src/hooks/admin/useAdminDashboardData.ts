import { useState, useEffect, useMemo } from 'react';
import { getSettings } from '../../services/data/settingsDataService';
import type { SystemSettings } from '../../services/data/settingsDataService';
import type { User } from '../useAuth';
import type { Order, Product, Category } from '../../types';
import { useCachedOrders, useCachedCustomers } from '../useCachedFirebase';
import { useCachedProducts } from '../useCachedProducts';
import { useCachedCategories } from '../useCachedCategories';
import { useCacheInvalidation } from '../useCacheInvalidation';
import { getUnpaidRows } from '../../utils/payments/unpaidSelectors';
import { scrollLockManager } from '../../utils/scrollLockManager';

interface UseAdminDashboardDataProps {
  isActive: boolean;
  user: User;
}

interface AdminDashboardData {
  allOrders: Order[];
  allCustomers: any[];
  products: Product[];
  categories: Category[];
  settings: any;
  ordersLoading: boolean;
  customersLoading: boolean;
  productsLoading: boolean;
  categoriesLoading: boolean;
  settingsLoading: boolean;
  pendingOrders: Order[];
  approvedUnpaidOrders: Order[];
  inProcessOrders: Order[];
  pendingRegistrations: any[];
  inProcessCount: number;
  unpaidOrdersCount: number;
  badgeCounts: { pending: number; registrations: number; unpaid: number; approved: number };
  invalidateProducts: () => void;
  invalidateCategories: () => void;
}

export function useAdminDashboardData({ isActive, user }: UseAdminDashboardDataProps): AdminDashboardData {
  const { data: allOrders = [], isLoading: ordersLoading } = useCachedOrders(isActive);
  const { data: allCustomers = [], isLoading: customersLoading } = useCachedCustomers(isActive);
  const { data: products = [], isLoading: productsLoading } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCachedCategories();
  const { invalidateProducts, invalidateCategories } = useCacheInvalidation();
  const [settings, setSettings] = useState<SystemSettings>({} as SystemSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    // RACE-CONDITION FIX: cancelled flag prevents a stale loadSettings response
    // (e.g. from a quick tab switch) from overwriting a fresher one.
    let cancelled = false;

    const loadSettingsSafe = async () => {
      setSettingsLoading(true);
      try {
        const data = await getSettings();
        if (!cancelled) setSettings(data);
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    };

    loadSettingsSafe();
    if (scrollLockManager.isLocked()) {
      scrollLockManager.forceUnlock('AdminDashboard mount');
    }

    return () => { cancelled = true; };
  }, [isActive]);

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setSettingsLoading(false);
    }
  };

  const pendingOrders = useMemo(() => allOrders.filter(o => o.status === 'pending'), [allOrders]);
  const approvedUnpaidOrders = useMemo(() => allOrders.filter(o => o.status === 'approved'), [allOrders]);
  const inProcessOrders = useMemo(() => allOrders.filter(o => o.status === 'in_process'), [allOrders]);
  const inProcessCount = inProcessOrders.length;
  const allUnpaidRows = useMemo(() => getUnpaidRows(allOrders), [allOrders]);
  const unpaidOrdersCount = useMemo(() => allUnpaidRows.filter((r: any) => r.kind === 'base_order').length, [allUnpaidRows]);
  const pendingRegistrations = useMemo(() => allCustomers.filter(c => c.status === 'pending'), [allCustomers]);
  const badgeCounts = useMemo(() => ({
    pending: pendingOrders.length,
    registrations: pendingRegistrations.length,
    unpaid: unpaidOrdersCount,
    approved: inProcessCount,
  }), [pendingOrders.length, pendingRegistrations.length, unpaidOrdersCount, inProcessCount]);

  return {
    allOrders, allCustomers, products, categories, settings,
    ordersLoading, customersLoading, productsLoading, categoriesLoading, settingsLoading,
    pendingOrders, approvedUnpaidOrders, inProcessOrders, pendingRegistrations,
    inProcessCount, unpaidOrdersCount, badgeCounts,
    invalidateProducts, invalidateCategories,
  };
}
