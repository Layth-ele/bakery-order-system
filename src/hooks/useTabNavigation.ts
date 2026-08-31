/**
 * Custom Hook: useTabNavigation
 * Manages tab navigation state and screen reader announcements
 * 
 * Step 5: Custom Hook Extraction - CustomerDashboard Optimization
 */

import { useState, useCallback } from 'react';
type DashboardTab = string;
import { announceToScreenReader } from '../utils/accessibility';
import { handlePageTransition } from '../utils/pageTransitions';

export interface UseTabNavigationReturn {
  activeTab: DashboardTab;
  handleTabChange: (newTab: DashboardTab) => void;
  setActiveTab: React.Dispatch<React.SetStateAction<DashboardTab>>;
}

const TAB_LABELS: Record<string, string> = {
  'place-order': 'Place Order',
  'products': 'Products Catalog',
  'active-orders': 'Active Orders',
  'payments': 'Payments',
  'order-invoices': 'Order History',
  'my-profile': 'My Profile',
};

export function useTabNavigation(
  initialTab: DashboardTab = 'place-order'
): UseTabNavigationReturn {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  // ✅ OPTIMIZATION: Memoize tab change handler with fade transitions
  // ✅ ACCESSIBILITY: Announce tab changes to screen readers
  const handleTabChange = useCallback((newTab: DashboardTab) => {
    handlePageTransition(() => {
      setActiveTab(newTab);
      
      // ✅ ACCESSIBILITY: Announce tab change to screen readers
      announceToScreenReader(`Navigated to ${TAB_LABELS[newTab]} tab`, 'polite');
    });
  }, []);

  return {
    activeTab,
    handleTabChange,
    setActiveTab,
  };
}