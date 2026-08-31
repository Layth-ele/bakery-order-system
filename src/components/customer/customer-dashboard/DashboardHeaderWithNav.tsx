/**
 * DashboardHeaderWithNav.tsx
 * ✅ Combined header and navigation component for Customer Dashboard
 * ✅ Matches Admin Dashboard header layout and style
 * ✅ Sticky positioning with centralized z-index
 * ✅ Badge counts for Active Orders and Outstanding
 * ✅ Fully accessible with ARIA roles and labels
 */

import type { User } from '../../../types';
import React from "react";
import {
  LogOut,
  ShoppingCart,
  Package,
  ClipboardCheck,
  CreditCard,
  FileText,
  UserCircle,
  Menu,
} from "lucide-react";
import {NavTab, BADGE_THEMES} from "../../theme/NavigationStyles"
import { DashboardTab } from "../../../types/customer-dashboard";
import { CustomerNotificationBell } from '../../../notifications'; // ✅ UPDATED: Import from consolidated /notifications/
import { CreditBalanceWidget } from '../CreditBalanceWidget'; // ✅ Credit balance widget
import { BalanceWidget } from '../BalanceWidget'; // ✅ Outstanding balance widget
import type { ModalType, ModalProps } from '../../../types/modals';
import type { ModalSize, OverlayBlur } from '../../../ui/modals/BaseModal';

export interface BadgeCounts {
  activeOrders: number;
  outstanding: number;
}

export interface DashboardHeaderWithNavProps {
  user: User;
  unreadCount: number; // ✅ DEPRECATED: Still here for backward compatibility
  onOpenNotifications: () => void; // ✅ DEPRECATED: Still here for backward compatibility
  onSignOut: () => void;
  headerRef: React.RefObject<HTMLDivElement>;
  activeTab: DashboardTab;
  badgeCounts: BadgeCounts;
  navigationId: string;
  mainContentId: string;
  onTabChange: (tab: DashboardTab) => void;
  openModal: <T extends ModalType>(type: T, props: ModalProps<T>, size?: ModalSize, overlayBlur?: OverlayBlur) => void;
}

export function DashboardHeaderWithNav({
  user,
  unreadCount,
  onOpenNotifications,
  onSignOut,
  headerRef,
  activeTab,
  badgeCounts,
  navigationId,
  mainContentId,
  onTabChange,
  openModal, // ✅ NEW: Destructure openModal
}: DashboardHeaderWithNavProps): JSX.Element | null {
  
  // ✅ Navigate to Outstanding tab when Balance Widget is clicked
  const handleNavigateToOutstanding = () => {
    onTabChange(DashboardTab.OUTSTANDING);
  };

  // ✅ NEW: Open Credit History modal when Credit Widget is clicked
  const handleNavigateToCredit = () => {
    openModal('CREDIT_HISTORY', {
      customerId: user.id || "",
    });
  };

  return (
    <div
      ref={headerRef}
      // Sticky header that sits at the top
      data-sticky-header="" className="sticky top-0 w-full z-40"
      style={{ zIndex: "var(--z-header)" }}
    >
      {/* ========================================
          HEADER SECTION - Matches Admin Dashboard Layout
      ======================================== */}
      <header className="bg-gradient-to-r from-[#3d3832]/95 to-[#2c2416]/95 backdrop-blur-sm shadow-lg border-b border-[#D4A574]">
        <div className="w-full px-4 pt-4 pb-0">
          {/* ✅ DESKTOP: 2 Rows Layout | MOBILE: 2 Rows Layout */}
          <div className="flex flex-col gap-3">
            
            {/* Row 1: Dashboard Title + Logout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Package className="w-6 h-6 md:w-8 md:h-8 text-[#e8dcc8]" />
                <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl text-[#e8dcc8] font-bold">
                  {user.storeName || user.contactPerson || "Customer Dashboard"}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Logout Button */}
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-4 md:py-2 bg-[#3d3832] text-[#e8dcc8] rounded-lg hover:bg-[#4a4238] transition-all border border-neutral-600/30 text-xs md:text-base"
                >
                  <LogOut className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>

            {/* Row 2: Welcome + Balance + Credit + Notifications */}
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2 md:gap-3">
                <p className="text-xs md:text-sm text-neutral-300">
                  Welcome,{" "}
                  <span className="text-[#e8dcc8] font-bold">
                    {user.contactPerson || user.storeName || user.email?.split('@')[0] || 'Customer'}
                  </span>
                </p>
              </div>

              {/* ✅ Balance Widget + Credit Widget + Notification Bell */}
              <div className="flex items-center gap-1 md:gap-2">
                <BalanceWidget 
                  customerId={user.id} 
                  customerEmail={user.email}
                  variant="compact" 
                  onNavigateToOutstanding={handleNavigateToOutstanding} 
                />
                <CreditBalanceWidget 
                  customerId={user.id} 
                  variant="compact" 
                  onNavigateToCredit={handleNavigateToCredit}
                />
                <CustomerNotificationBell user={user} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          NAVIGATION SECTION
      ======================================== */}
      <nav
        id={navigationId}
        role="navigation"
        aria-label="Dashboard Navigation"
        className="bg-gradient-to-r from-[#3d3832] via-[#2c2416] to-[#3d3832] border-t border-[#D4A574]/30"
      >
        <div className="w-full px-4">
          {/* ✅ ACCESSIBILITY: Tablist role for tab navigation */}
          <div
            role="tablist"
            aria-label="Dashboard Sections"
            className="flex flex-wrap justify-around gap-0"
          >
            <div className="flex-shrink-0">
              <NavTab
                active={activeTab === DashboardTab.PLACE_ORDER}
                onClick={() =>
                  onTabChange(DashboardTab.PLACE_ORDER)
                }
                icon={
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="Place Order"
                shortLabel="Order"
                ariaControls={mainContentId}
              />
            </div>

            <div className="flex-shrink-0">
              <NavTab
                active={activeTab === DashboardTab.PRODUCTS}
                onClick={() =>
                  onTabChange(DashboardTab.PRODUCTS)
                }
                icon={
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="Products"
                shortLabel="Products"
              />
            </div>

            <div className="flex-shrink-0">
              <NavTab
                active={
                  activeTab === DashboardTab.ACTIVE_ORDERS
                }
                onClick={() =>
                  onTabChange(DashboardTab.ACTIVE_ORDERS)
                }
                icon={
                  <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="Active Orders"
                shortLabel="Active"
                badge={
                  badgeCounts.activeOrders > 0
                    ? badgeCounts.activeOrders
                    : undefined
                }
                badgeColor={BADGE_THEMES.blue}
                badgeLabel="active orders"
              />
            </div>

            <div className="flex-shrink-0">
              <NavTab
                active={activeTab === DashboardTab.OUTSTANDING}
                onClick={() =>
                  onTabChange(DashboardTab.OUTSTANDING)
                }
                icon={
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="Outstanding (Unpaid)"
                shortLabel="Outstanding"
                badge={
                  badgeCounts.outstanding > 0
                    ? badgeCounts.outstanding
                    : undefined
                }
                badgeColor={BADGE_THEMES.red}
                badgeLabel="unpaid orders"
              />
            </div>

            <div className="flex-shrink-0">
              <NavTab
                active={
                  activeTab === DashboardTab.ORDER_INVOICES
                }
                onClick={() =>
                  onTabChange(DashboardTab.ORDER_INVOICES)
                }
                icon={
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="Order Invoices"
                shortLabel="Invoices"
              />
            </div>

            <div className="flex-shrink-0">
              <NavTab
                active={activeTab === DashboardTab.MY_PROFILE}
                onClick={() =>
                  onTabChange(DashboardTab.MY_PROFILE)
                }
                icon={
                  <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                }
                label="My Profile"
                shortLabel="Profile"
              />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}