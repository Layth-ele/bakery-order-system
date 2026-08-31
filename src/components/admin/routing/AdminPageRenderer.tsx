/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN PAGE RENDERER - STEP 3 OF ADMINDASHBOARD REFACTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This component handles the routing/rendering logic for all admin pages.
 * Extracted from AdminDashboard.tsx to improve maintainability.
 * 
 * ✅ RESPONSIBILITIES:
 * - Route currentPage to correct component
 * - Pass through necessary props
 * - Handle 404 / invalid pages
 * 
 * 🔒 SECURITY:
 * - All child components perform their own admin checks
 * - This is just a routing layer
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-02-15
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AdminPage } from '../../../config/adminNavigation';
import type { User } from '../../../hooks/useAuth';
import type { Order } from '../../../types';

// Page components
import { AdminAnalyticsDashboard } from '../../../pages/admin/AdminAnalyticsDashboard';
import { CustomersList } from '../../../pages/admin/CustomersList';
import { ManageProducts } from '../../../pages/admin/ManageProducts';
import { SystemSettings } from '../../../pages/admin/SystemSettings';
import { RegistrationRequests } from '../../../pages/admin/RegistrationRequests';
import { PendingOrders } from '../../order/PendingOrders';
import { AdminUnpaidOrders } from '../../order/AdminUnpaidOrders'; // Import unpaid orders component
import { ApprovedOrders } from '../../order/ApprovedOrders';
import { CompleteOrders } from '../../order/CompleteOrders'; // Import complete orders component for history page
import { WeeklyInvoices } from '../WeeklyInvoices';
import { ProductionToDoSheet } from '../ProductionToDoSheet';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AdminPageRendererProps {
  currentPage: AdminPage;
  isActive: boolean;
  user: User;
  allOrders: Order[];
  onLogout: () => void;
  setCurrentPage: (page: AdminPage) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AdminPageRenderer({
  currentPage,
  isActive,
  user,
  allOrders,
  onLogout,
  setCurrentPage,
}: AdminPageRendererProps): JSX.Element | null {
  // Handle page routing
  switch (currentPage) {
    // Analytics Dashboard
    case 'analytics':
      return (
        <AdminAnalyticsDashboard
          isActive={isActive}
          user={user}
          allOrders={allOrders}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
        />
      );

    // Customer Management
    case 'customers':
      return (
        <CustomersList
          isActive={isActive}
          user={user}
          onBack={() => setCurrentPage('pending')}
        />
      );

    // Product Management
    case 'products':
      return (
        <ManageProducts
          isActive={isActive}
          user={user}
          onBack={() => setCurrentPage('pending')}
        />
      );

    // System Settings
    case 'settings':
      return (
        <SystemSettings user={user} onBack={() => setCurrentPage('pending')} />
      );

    // Registration Requests
    case 'registrations':
      return (
        <RegistrationRequests
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
        />
      );

    // Pending Orders (main orders page)
    case 'pending':
      return (
        <PendingOrders
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );

    // Unpaid Orders (filter of pending)
    case 'unpaid':
      return (
        <AdminUnpaidOrders
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );

    // Approved / In Process Orders
    case 'approved':
      return (
        <ApprovedOrders
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );

    // Order History
    case 'history':
      return (
        <CompleteOrders
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );

    // Weekly Invoices (now in Orders sub-navigation)
    case 'weekly-invoices':
      return (
        <WeeklyInvoices
          isActive={isActive}
          user={user}
          onLogout={onLogout}
          onBack={() => setCurrentPage('pending')}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );

    // Production To-Do
    case 'production-todo':
      return (
        <ProductionToDoSheet
          isActive={isActive}
          setCurrentPage={setCurrentPage as (page: string) => void}
        />
      );
    default:
      return (
        <div className="page-container py-8">
          <div className="text-center">
            <h2 className="text-xl text-[#D4A574] mb-4">Page Not Found</h2>
            <p className="text-[#888888] mb-6">
              The page "{currentPage}" does not exist.
            </p>
            <button
              onClick={() => setCurrentPage('pending')}
              className="px-6 py-3 bg-[#E8C4A2] text-[#333333] rounded-lg hover:bg-[#D4A574] transition-colors"
            >
              Return to Orders
            </button>
          </div>
        </div>
      );
  }
}