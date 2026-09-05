/**
 * AdminTopBar.tsx
 * ✅ Admin top bar for the current route-driven admin layout
 * 
 * Header bar with:
 * - Admin Dashboard title
 * - Logout button
 * - Welcome message
 * - Notification bell
 * - Menu toggle
 */

import { Package, LogOut, Menu } from 'lucide-react';
import { User } from '../../../hooks/useAuth';
import { AdminNotificationBell } from '../../../notifications';

interface AdminTopBarProps {
  user: User;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onConfirmPayment: (notification: any) => void;
}

export function AdminTopBar({
  user,
  sidebarOpen,
  onToggleSidebar,
  onLogout,
  onConfirmPayment,
}: AdminTopBarProps): JSX.Element | null {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#3d3832]/95 to-[#2c2416]/95 backdrop-blur-sm shadow-lg border-b border-[#D4A574]">
      <div className="w-full px-4 py-4">
        {/* ✅ DESKTOP: 2 Rows Layout | MOBILE: Single consolidated row */}
        <div className="flex flex-col gap-3">
          
          {/* Row 1: Admin Dashboard Title + Actions (Desktop & Mobile) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 md:w-8 md:h-8 text-[#e8dcc8]" />
              <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl text-[#e8dcc8] font-bold">
                Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop: Logout Button */}
              <button
                onClick={onLogout}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-[#3d3832] text-[#e8dcc8] rounded-lg hover:bg-[#4a4238] transition-all border border-neutral-600/30 text-base"
                title="Logout from admin dashboard"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>

              {/* Mobile: Sidebar Menu Button */}
              <button
                onClick={onToggleSidebar}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-[#3d3832] text-[#e8dcc8] hover:bg-[#4a4238] transition-all border border-neutral-600/30"
                title="Open menu"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Row 2: Menu Button + Welcome + Complete Week (Mobile) + Notification Bell */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              {/* ✅ Hamburger Menu Button - Desktop Only */}
              <button
                onClick={onToggleSidebar}
                className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-[#3d3832] text-[#e8dcc8] hover:bg-[#4a4238] transition-all border border-neutral-600/30"
                title="Toggle Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <p className="text-xs sm:text-sm md:text-base text-neutral-300">
                Welcome,{" "}
                <span className="text-[#e8dcc8] font-bold">
                  {user.storeName || user.email?.split('@')[0] || 'Admin'}
                </span>
              </p>
            </div>

            {/* Right side: Logout (Mobile) + Notification Bell */}
            <div className="flex items-center gap-2">
              {/* Mobile: Logout Icon Button */}
              <button
                onClick={onLogout}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-[#3d3832] text-[#e8dcc8] hover:bg-[#4a4238] transition-all border border-neutral-600/30"
                title="Logout"
                aria-label="Logout from admin dashboard"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* ✅ Notification Bell (Single instance for all screen sizes) */}
              <AdminNotificationBell 
                user={user}
                onConfirmPayment={onConfirmPayment}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}