/**
 * NonOrderTabsRouter.tsx
 * ✅ Renders non-order tabs (Products, Active Orders, Outstanding, Invoices, Profile)
 * ✅ Eliminates duplication across tabs
 * ✅ Single source of truth for all non-order tab content
 */

import { ProductsCatalog } from "../../../pages/admin/ProductsCatalog";
import { ActiveOrders } from "../../order/ActiveOrders";
import { OutstandingTab } from "../OutstandingTab";
import { CustomerInvoices } from "../CustomerInvoices";
import { MyProfile } from "../MyProfile";
import { DashboardTab } from "../../../types/customer-dashboard";
import { scrollToTop } from "../../../utils/scrollUtils";

import type {
  Product,
  Category,
} from "../../../types";
import type { User } from "../../../hooks/useAuth";

export interface NonOrderTabsRouterProps {
  activeTab: DashboardTab;
  products: Product[];
  categories: Category[];
  user: User;
  currentUser: any; // ✅ TYPE: Should match your user profile type
  pendingAdjustmentsCount: number;
  onTabChange: (tab: DashboardTab) => void;
  onProfileUpdate: (updatedUser: any) => void;
  onRefreshProducts?: () => Promise<void>; // ✅ NEW: Refresh products callback
  onRefreshCategories?: () => Promise<void>; // ✅ NEW: Refresh categories callback
}

export function NonOrderTabsRouter({
  activeTab,
  products,
  categories,
  user,
  currentUser,
  pendingAdjustmentsCount,
  onTabChange,
  onProfileUpdate,
  onRefreshProducts, // ✅ NEW: Destructure callback
  onRefreshCategories, // ✅ NEW: Destructure callback
}: NonOrderTabsRouterProps): JSX.Element | null {
  // ✅ PRODUCTS TAB
  if (activeTab === DashboardTab.PRODUCTS) {
    return (
      <ProductsCatalog
        products={products}
        categories={categories}
        onNavigateBack={() => {
          onTabChange(DashboardTab.PLACE_ORDER);
          const anchor = document.querySelector('[data-scroll-anchor]');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else scrollToTop({ behavior: 'smooth' });
        }}
        onNavigateToOrder={(productId) => {
          // ✅ Navigate with query param instead of state
          const newUrl = `${window.location.pathname}?focus=${productId}`;
          window.history.pushState({}, "", newUrl);
          onTabChange(DashboardTab.PLACE_ORDER);
          const anchor = document.querySelector('[data-scroll-anchor]');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        onRefresh={async () => {
          // ✅ NEW: Refresh both products and categories
          if (onRefreshProducts) await onRefreshProducts();
          if (onRefreshCategories) await onRefreshCategories();
        }}
      />
    );
  }

  // ✅ ACTIVE ORDERS TAB
  if (activeTab === DashboardTab.ACTIVE_ORDERS) {
    return (
      <ActiveOrders
        user={user}
        onNavigateBack={() => {
          onTabChange(DashboardTab.PLACE_ORDER);
          const anchor = document.querySelector('[data-scroll-anchor]');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else scrollToTop({ behavior: 'smooth' });
        }}
      />
    );
  }

  // ✅ OUTSTANDING TAB
  if (activeTab === DashboardTab.OUTSTANDING) {
    return (
      <OutstandingTab
        user={user}
        onNavigateBack={() => {
          onTabChange(DashboardTab.PLACE_ORDER);
          const anchor = document.querySelector('[data-scroll-anchor]');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else scrollToTop({ behavior: 'smooth' });
        }}
        onViewOrder={() => {
          onTabChange(DashboardTab.ACTIVE_ORDERS);
          scrollToTop();
        }}
      />
    );
  }

  // ✅ ORDER INVOICES TAB
  if (activeTab === DashboardTab.ORDER_INVOICES) {
    return (
      <CustomerInvoices
        user={user}
        onNavigateBack={() => {
          onTabChange(DashboardTab.PLACE_ORDER);
          const anchor = document.querySelector('[data-scroll-anchor]');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else scrollToTop({ behavior: 'smooth' });
        }}
        isActive={true}
      />
    );
  }

  // ✅ MY PROFILE TAB (default fallback)
  return (
    <MyProfile
      user={currentUser}
      onProfileUpdate={onProfileUpdate}
      onNavigateBack={() =>
        onTabChange(DashboardTab.PLACE_ORDER)
      }
    />
  );
}