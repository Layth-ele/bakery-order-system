/**
 * AdminDashboardView.tsx
 * 
 * ✅ PHASE 2: Admin Pages Standardization - Presentation Layer
 * 
 * PURPOSE:
 * - Pure presentational component for AdminDashboard
 * - No business logic, no data fetching, no service calls
 * - Receives all data and handlers as props
 * - Focuses solely on rendering UI
 * 
 * ARCHITECTURE:
 * - Input: Data props from useAdminDashboardData
 * - Input: Handler props from useAdminDashboardNavigation
 * - Output: Pure JSX rendering
 * 
 * EXTRACTED FROM: /pages/admin/AdminDashboard.tsx
 */

import {
  NavTab,
  NavBarShell,
  BADGE_THEMES,
} from '../theme/NavigationStyles';
import { AdminTopBar } from './layout/AdminTopBar';
import { AdminSidebar } from './layout/AdminSidebar';
import { AdminPageRenderer } from './routing/AdminPageRenderer';
import { ToastNotification } from '../ToastNotification';
import { KeyboardShortcutsModal } from '../modals/KeyboardShortcutsModal';
import {
  AdminPage,
  getNavItemsByGroup,
  isOrdersPage,
  getActiveParentPage,
} from '../../config/adminNavigation';
import type { User } from '../../hooks/useAuth';
import type { Order } from '../../types';

interface AdminDashboardViewProps {
  // Page state
  isActive: boolean;
  currentPage: AdminPage; // ✅ FIXED: Changed from string to AdminPage type
  user: User;
  
  // Data
  allOrders: Order[];
  
  // Navigation state
  sidebarOpen: boolean;
  showKeyboardShortcuts: boolean;
  notification: string;
  
  // Navigation handlers
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  onPageChange: (page: AdminPage) => void;
  onLogout: () => void;
  getBadgeCount: (pageId: AdminPage) => number | undefined;
  setCurrentPage: (page: AdminPage) => void;
  
  // Notification handlers
  onConfirmPayment: (notification?: any) => void;
  onClearNotification: () => void;
  
  // Keyboard shortcuts
  onCloseKeyboardShortcuts: () => void;
}

/**
 * Pure presentational component for AdminDashboard
 * 
 * Renders:
 * - Header with AdminTopBar
 * - Sidebar with AdminSidebar
 * - Main navigation tabs
 * - Order sub-navigation (when on orders pages)
 * - Main content area with AdminPageRenderer
 * - Toast notifications
 * - Keyboard shortcuts modal
 * 
 * @param props - All data and handlers needed for rendering
 * @returns JSX for AdminDashboard UI
 */
export function AdminDashboardView({
  isActive,
  currentPage,
  user,
  allOrders,
  sidebarOpen,
  showKeyboardShortcuts,
  notification,
  onToggleSidebar,
  onCloseSidebar,
  onPageChange,
  onLogout,
  getBadgeCount,
  setCurrentPage,
  onConfirmPayment,
  onClearNotification,
  onCloseKeyboardShortcuts,
}: AdminDashboardViewProps): JSX.Element | null {
  return (
    <div className="page">
      {/* Sidebar - FIXED: Moved outside sticky container for proper positioning */}
      <AdminSidebar
        sidebarOpen={sidebarOpen}
        currentPage={currentPage}
        onClose={onCloseSidebar}
        onPageChange={onPageChange}
      />

      {/* Combined Header + Tabs - ONE PIECE */}
      <div className="sticky top-0 z-50">
        {/* Header */}
        <AdminTopBar
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onLogout={onLogout}
          onConfirmPayment={onConfirmPayment}
        />

        {/* Main Navigation */}
        <NavBarShell
          justify={true}
          zIndex={40}
          ariaLabel="Main navigation"
        >
          {getNavItemsByGroup('main').map((item) => {
            const badgeCount = getBadgeCount(item.id);

            return (
              <NavTab
                key={item.id}  // eslint-disable-line react/jsx-key
                active={
                  getActiveParentPage(currentPage) === item.id
                }
                onClick={() => onPageChange(item.id)}
                icon={item.icon}
                label={item.label}
                shortLabel={item.shortLabel}
                badge={badgeCount}
                badgeColor={
                  item.badgeTheme
                    ? BADGE_THEMES[item.badgeTheme]
                    : undefined
                }
                badgeLabel={item.badgeLabel}
              />
            );
          })}
        </NavBarShell>

        {/* Order Sub-Navigation */}
        {isOrdersPage(currentPage) && (
          <div className="bg-neutral-800 border-b border-neutral-700/50 shadow-md backdrop-blur-md">
            <div className="page-container py-0">
              <div
                className="flex justify-center items-center gap-2 sm:gap-4"
                role="tablist"
                aria-label="Order status filters"
              >
                {getNavItemsByGroup('orders').map((item) => {
                  const badgeCount = getBadgeCount(item.id);

                  return (
                    <NavTab
                      key={item.id}
                      active={currentPage === item.id}
                      onClick={() => onPageChange(item.id)}
                      icon={item.icon}
                      label={item.label}
                      shortLabel={item.shortLabel}
                      badge={badgeCount}
                      badgeColor={
                        item.badgeTheme
                          ? BADGE_THEMES[item.badgeTheme]
                          : undefined
                      }
                      badgeLabel={item.badgeLabel}
                      variant="admin"
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification - Portal-based, always visible in viewport */}
      {notification && (
        <ToastNotification
          message={notification}
          onClose={onClearNotification}
        />
      )}

      {/* Main Content Area */}
      <div>
        <AdminPageRenderer
          currentPage={currentPage}
          isActive={isActive}
          user={user}
          allOrders={allOrders}
          onLogout={onLogout}
          setCurrentPage={setCurrentPage}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal
          isOpen={showKeyboardShortcuts}
          shortcuts={[]}
          onClose={onCloseKeyboardShortcuts}
        />
      )}
    </div>
  );
}