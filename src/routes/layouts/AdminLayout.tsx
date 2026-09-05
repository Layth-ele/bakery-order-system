/**
 * AdminLayout.tsx
 * Layout wrapper for all admin routes
 * 
 * Provides:
 * - Admin notification provider
 * - Admin navigation (top bar, sidebar)
 * - Consistent layout structure
 * - Authentication context
 * 
 * ✅ MAR 17, 2026: Fixed AdminNotificationProviderV3 usage
 * - Provider IS needed here (UnifiedNotificationProvider not used in app)
 * - Removed invalid userId prop (provider doesn't accept it)
 */

import { Outlet, useLoaderData, useNavigate, useLocation } from 'react-router';
import { getAuth, signOut } from 'firebase/auth';
import { AdminNotificationProviderV3 } from '../../notifications';
import { AdminTopBar } from '../../components/admin/layout/AdminTopBar';
import { AdminSidebar } from '../../components/admin/layout/AdminSidebar';
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import type { AdminPage } from '../../config/adminNavigation';
import { 
  getNavItemsByGroup, 
  isOrdersPage, 
  getActiveParentPage 
} from '../../config/adminNavigation';
import { NavTab, NavBarShell, BADGE_THEMES } from '../../components/theme/NavigationStyles';
import { useCachedOrders, useCachedCustomers } from '../../hooks/useCachedFirebase';
import { getUnpaidRows } from '../../utils/payments/unpaidSelectors';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { AdminRouteLoader } from '../components/RouteLoader';

interface AdminLoaderData {
  user: {
    id: string;
    email: string;
    role: 'admin';
    storeName: string;
    contactPerson: string;
  };
}

/**
 * Map URL paths to AdminPage types
 */
function pathToAdminPage(pathname: string): AdminPage {
  const page = pathname.split('/').pop() || 'pending';
  
  // Handle special cases
  const pageMap: Record<string, AdminPage> = {
    'admin': 'pending',
    'pending': 'pending',
    'unpaid': 'unpaid',
    'approved': 'approved',
    'history': 'history',
    'analytics': 'analytics',
    'customers': 'customers',
    'products': 'products',
    'settings': 'settings',
    'registrations': 'registrations',
    'production-todo': 'production-todo',
    'weekly-invoices': 'weekly-invoices',
  };
  
  return (pageMap[page] || 'pending') as AdminPage;
}

export function AdminLayout(): JSX.Element | null {
  const { user } = useLoaderData() as AdminLoaderData;

  const navigate = useNavigate();
  const location = useLocation();
  
  // Sync currentPage with URL
  const [currentPage, setCurrentPage] = useState<AdminPage>(() => 
    pathToAdminPage(location.pathname)
  );
  
  // Track previous pathname to avoid unnecessary updates
  const prevPathnameRef = useRef(location.pathname);
  
  // Update currentPage when URL changes
  useEffect(() => {
    // Only update if pathname actually changed
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      setCurrentPage(pathToAdminPage(location.pathname));

      // ✅ Smart scroll: scroll to just below the sticky header/nav on route change
      // Use requestAnimationFrame so the new page content has rendered first
      requestAnimationFrame(() => {
        // Admin has fixed header (120px) + sticky sub-nav (~50px) = ~170px total
        // We scroll to 0 (top of main content) but the main has pt-[120px] padding
        // So scrolling window to 0 puts us at the right spot
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }, [location.pathname]);
  
  // Handle page changes by navigating to new URL
  const handlePageChange = (page: AdminPage) => {
    navigate(`/admin/${page}`);
  };
  
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    navigate('/');
  };
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const handleConfirmPayment = (notification: any) => {
    // Handle payment confirmation from notification
    // This can be implemented based on your notification system
  };
  
  // Fetch data for badge counts
  const { data: allOrders = [] } = useCachedOrders(true);
  const { data: allCustomers = [] } = useCachedCustomers(true);
  
  // Calculate badge counts
  const badgeCounts = useMemo(() => {
    const pendingOrders = allOrders.filter((o) => o.status === 'pending');
    const pendingRegistrations = allCustomers.filter((c) => c.status === 'pending');
    const allUnpaidRows = getUnpaidRows(allOrders);
    const unpaidOrdersCount = allUnpaidRows.filter((row) => row.kind === 'base_order').length;
    const inProcessCount = allOrders.filter((o) => o.status === 'in_process').length;
    
    return {
      pending: pendingOrders.length,
      registrations: pendingRegistrations.length,
      unpaid: unpaidOrdersCount,
      approved: inProcessCount,
    };
  }, [allOrders, allCustomers]);
  
  const getBadgeCount = useCallback(
    (pageId: AdminPage): number | undefined => {
      const count = badgeCounts[pageId as keyof typeof badgeCounts];
      return count > 0 ? count : undefined;
    },
    [badgeCounts]
  );
  
  return (
    <AdminNotificationProviderV3>
      <div className="min-h-screen bg-black">
        {/* Top Navigation */}
        <AdminTopBar
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          onLogout={handleLogout}
          onConfirmPayment={handleConfirmPayment}
        />
        
        {/* Mobile Sidebar */}
        <AdminSidebar
          currentPage={currentPage}
          onPageChange={handlePageChange}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        {/* Main Navigation Bar - Positioned below fixed header */}
        <div data-sticky-header="" className="sticky top-[120px] z-40">
          <NavBarShell
            justify={true}
            zIndex={40}
            ariaLabel="Main navigation"
          >
            {getNavItemsByGroup('main').map((item) => {
              const badgeCount = getBadgeCount(item.id);

              return (
                <NavTab
                  key={item.id}
                  active={getActiveParentPage(currentPage) === item.id}
                  onClick={() => handlePageChange(item.id)}
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
              <div className="max-w-7xl mx-auto px-4 py-0">
                <div
                  className="flex flex-wrap items-stretch gap-1.5 py-1.5 sm:justify-between sm:gap-3"
                  role="tablist"
                  aria-label="Order status filters"
                >
                  {getNavItemsByGroup('orders').map((item) => {
                    const badgeCount = getBadgeCount(item.id);

                    return (
                      <NavTab
                        key={item.id}
                        active={currentPage === item.id}
                        onClick={() => handlePageChange(item.id)}
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
        
        {/* Main Content - Padding to account for fixed header only */}
        <main className="pt-[120px]">
          <RouteErrorBoundary>
            <Suspense fallback={<AdminRouteLoader />}>
              <Outlet context={{ user, currentPage, setCurrentPage: handlePageChange }} />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </AdminNotificationProviderV3>
  );
}