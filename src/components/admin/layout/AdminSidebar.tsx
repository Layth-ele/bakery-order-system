/**
 * AdminSidebar.tsx
 * ✅ STEP 1: Extracted from AdminDashboard
 * 
 * Luxury sidebar navigation with:
 * - Overlay when open
 * - Sidebar menu items
 * - Current page highlighting
 * - Close button
 */

import { Package, X } from 'lucide-react';
import { AdminPage, getNavItemsByGroup } from '../../../config/adminNavigation';

interface AdminSidebarProps {
  sidebarOpen: boolean;
  currentPage: AdminPage;
  onPageChange: (page: AdminPage) => void;
  onClose: () => void;
}

export function AdminSidebar({
  sidebarOpen,
  currentPage,
  onPageChange,
  onClose,
}: AdminSidebarProps): JSX.Element | null {
  const handleClose = () => {
    onClose();
  };

  const handleMenuItemClick = (pageId: AdminPage) => {
    onPageChange(pageId);
    handleClose();
  };

  return (
    <>
      {/* Blurry Overlay - Shows on all devices when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
          onClick={handleClose}
        />
      )}

      {/* Sidebar - Overlay on all devices */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-[70] 
          bg-gradient-to-b from-[#1a1410] via-[#2a2318] to-[#1a1410]
          border-r-2 border-[#D4A574]/30
          shadow-2xl
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          w-64
        `}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-[#D4A574]/30 bg-gradient-to-r from-[#D4A574]/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#D4A574]/20 rounded-lg">
                <Package className="w-6 h-6 text-[#D4A574]" />
              </div>
              <h2 className="text-lg font-bold text-[#D4A574]">Menu</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#D4A574]/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#D4A574]" />
            </button>
          </div>
        </div>

        {/* Sidebar Navigation - ✅ CENTRALIZED: Uses config from /config/adminNavigation.tsx */}
        <nav className="p-4 space-y-2">
          {getNavItemsByGroup('sidebar').map(item => (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl
                transition-all duration-200
                ${currentPage === item.id
                  ? 'bg-gradient-to-r from-[#D4A574] to-[#C8A882] text-white shadow-lg scale-105'
                  : 'text-[#e8dcc8] hover:bg-[#D4A574]/10 hover:scale-102'
                }
              `}
              aria-current={currentPage === item.id ? 'page' : undefined}
            >
              {item.icon}
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#D4A574]/30 bg-gradient-to-t from-[#1a1410] to-transparent">
          <div className="text-center text-xs text-[#D4A574]/60">
            Admin Panel v3.0
          </div>
        </div>
      </aside>
    </>
  );
}