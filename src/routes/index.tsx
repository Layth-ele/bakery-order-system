/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROUTES CONFIGURATION - SINGLE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the CANONICAL definition of all application routes using React Router
 * Data Mode for a fully route-driven architecture.
 * 
 * ✅ BENEFITS:
 * - URL-based navigation (shareable links, browser history)
 * - Centralized route configuration
 * - Type-safe route definitions
 * - Lazy-loaded route components
 * - Protected routes with guards
 * - Proper 404 handling
 * 
 * 🔒 ARCHITECTURE:
 * - Uses React Router v7 createBrowserRouter
 * - Implements route loaders for data fetching
 * - Guards for authentication and authorization
 * - Layouts for consistent UI structure
 * 
 * VERSION: 2.0.0
 * CREATED: March 7, 2026
 * MIGRATION: From state-based to route-driven navigation
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createBrowserRouter, redirect, LoaderFunctionArgs } from 'react-router';
import {
  rootLoader,
  publicGuard,
  authGuard,
  adminGuard,
  customerGuard,
  accountStatusGuard,
} from './guards/navigationGuards';

// ═══════════════════════════════════════════════════════════════════════════
// LAZY-LOADED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Public pages
import { HomePage } from '../pages/HomePage';

// Layouts
import { lazy } from 'react';
import { AdminPageAdapter } from './adapters/AdminPageAdapter';
import { RouterErrorPage } from './components/RouterErrorPage';
import { RouteLoader } from './components/RouteLoader';

import { RootLayout } from './layouts/RootLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { CustomerLayout } from './layouts/CustomerLayout';
import { CustomerDashboardMain as CustomerDashboard } from '../components/customer/customer-dashboard/CustomerDashboardMain';

// Admin pages
const AdminAnalyticsDashboard = lazy(() => import('../pages/admin/AdminAnalyticsDashboard').then(m => ({ default: m.AdminAnalyticsDashboard })));
const CustomersList = lazy(() => import('../pages/admin/CustomersList').then(m => ({ default: m.CustomersList })));
const ManageProducts = lazy(() => import('../pages/admin/ManageProducts').then(m => ({ default: m.ManageProducts })));
const SystemSettings = lazy(() => import('../pages/admin/SystemSettings').then(m => ({ default: m.SystemSettings })));
const RegistrationRequests = lazy(() => import('../pages/admin/RegistrationRequests').then(m => ({ default: m.RegistrationRequests })));
const PendingOrdersPage = lazy(() => import('../pages/admin/PendingOrdersPage').then(m => ({ default: m.PendingOrdersPage })));
const AdminUnpaidOrdersPage = lazy(() => import('../pages/admin/AdminUnpaidOrdersPage'));
const ApprovedOrdersPage = lazy(() => import('../pages/admin/ApprovedOrdersPage').then(m => ({ default: m.ApprovedOrdersPage })));
const CompleteOrdersPage = lazy(() => import('../pages/admin/CompleteOrdersPage'));
const InvoicesPage = lazy(() => import('../pages/admin/InvoicesPage'));
const ProductionToDoPage = lazy(() => import('../pages/admin/ProductionToDoPage').then(m => ({ default: m.ProductionToDoPage })));

// Customer pages
// CustomerDashboard imported statically below to avoid Vite lazy-load resolution issues

// Other pages
const AccountStatusScreen = lazy(() => import('../pages/AccountStatusScreen').then(m => ({ default: m.AccountStatusScreen })));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    loader: rootLoader,
    errorElement: <RouterErrorPage />,
    HydrateFallback: () => <RouteLoader variant='fullscreen' message='Loading...' />,
    children: [
      // ============================================
      // PUBLIC ROUTES
      // ============================================
      {
        index: true,
        Component: HomePage,
        loader: publicGuard,
        errorElement: <RouterErrorPage />,
        handle: { 
          crumb: 'Home',
          meta: {
            title: 'Welcome',
            description: 'Premium bakery order management system - Login to manage your orders and deliveries',
            keywords: ['bakery', 'order management', 'login', 'customer portal'],
          }
        },
      },
      
      // ============================================
      // ADMIN ROUTES
      // ============================================
      {
        path: 'admin',
        Component: AdminLayout,
        loader: adminGuard,
        errorElement: <RouterErrorPage />,
        handle: { crumb: 'Admin' },
        children: [
          {
            index: true,
            loader: () => redirect('/admin/pending'),
          },
          {
            path: 'pending',
            Component: () => <AdminPageAdapter Component={PendingOrdersPage} />,
            handle: { 
              crumb: 'Pending Orders',
              meta: {
                title: 'Pending Orders',
                description: 'Review and approve pending customer orders',
                keywords: ['pending', 'orders', 'approval', 'admin'],
              }
            },
          },
          {
            path: 'unpaid',
            Component: () => <AdminPageAdapter Component={AdminUnpaidOrdersPage} />,
            handle: { 
              crumb: 'Unpaid Orders',
              meta: {
                title: 'Unpaid Orders',
                description: 'Manage unpaid customer orders and payment tracking',
                keywords: ['unpaid', 'orders', 'payments', 'invoices'],
              }
            },
          },
          {
            path: 'approved',
            Component: () => <AdminPageAdapter Component={ApprovedOrdersPage} />,
            handle: { 
              crumb: 'Approved Orders',
              meta: {
                title: 'Approved Orders',
                description: 'View approved orders ready for production',
                keywords: ['approved', 'orders', 'production', 'ready'],
              }
            },
          },
          {
            path: 'history',
            Component: () => <AdminPageAdapter Component={CompleteOrdersPage} />,
            handle: { 
              crumb: 'Order History',
              meta: {
                title: 'Order History',
                description: 'Complete order history and archives',
                keywords: ['history', 'completed', 'orders', 'archive'],
              }
            },
          },
          {
            path: 'analytics',
            Component: () => <AdminPageAdapter Component={AdminAnalyticsDashboard} />,
            handle: { 
              crumb: 'Analytics',
              meta: {
                title: 'Analytics Dashboard',
                description: 'Sales analytics, revenue trends, and business insights',
                keywords: ['analytics', 'reports', 'sales', 'revenue'],
              }
            },
          },
          {
            path: 'customers',
            Component: () => <AdminPageAdapter Component={CustomersList} />,
            handle: { 
              crumb: 'Customers',
              meta: {
                title: 'Customer Management',
                description: 'Manage customer accounts and information',
                keywords: ['customers', 'accounts', 'management'],
              }
            },
          },
          {
            path: 'products',
            Component: () => <AdminPageAdapter Component={ManageProducts} />,
            handle: { 
              crumb: 'Products',
              meta: {
                title: 'Product Management',
                description: 'Manage bakery products, pricing, and inventory',
                keywords: ['products', 'catalog', 'pricing', 'inventory'],
              }
            },
          },
          {
            path: 'settings',
            Component: () => <AdminPageAdapter Component={SystemSettings} />,
            handle: { 
              crumb: 'Settings',
              meta: {
                title: 'System Settings',
                description: 'Configure system settings and preferences',
                keywords: ['settings', 'configuration', 'system'],
              }
            },
          },
          {
            path: 'registrations',
            Component: () => <AdminPageAdapter Component={RegistrationRequests} />,
            handle: { 
              crumb: 'Registration Requests',
              meta: {
                title: 'Registration Requests',
                description: 'Review and approve new customer registration requests',
                keywords: ['registrations', 'requests', 'approval', 'new customers'],
              }
            },
          },
          {
            path: 'production-todo',
            Component: () => <AdminPageAdapter Component={ProductionToDoPage} />,
            handle: { 
              crumb: 'Production Todo',
              meta: {
                title: 'Production Todo List',
                description: 'Daily production tasks and order fulfillment',
                keywords: ['production', 'todo', 'tasks', 'fulfillment'],
              }
            },
          },
          {
            path: 'weekly-invoices',
            Component: () => <AdminPageAdapter Component={InvoicesPage} />,
            handle: { 
              crumb: 'Weekly Invoices',
              meta: {
                title: 'Weekly Invoices',
                description: 'Weekly invoice summaries and billing',
                keywords: ['invoices', 'weekly', 'billing', 'summaries'],
              }
            },
          },
        ],
      },
      
      // ============================================
      // CUSTOMER ROUTES
      // ============================================
      {
        path: 'customer',
        Component: CustomerLayout,
        loader: customerGuard,
        handle: { 
          crumb: 'Customer',
          meta: {
            title: 'Customer Dashboard',
            description: 'Manage your bakery orders and view delivery schedules',
            keywords: ['customer', 'orders', 'dashboard', 'bakery'],
          }
        },
        children: [
          {
            index: true,
            Component: CustomerDashboard,
            handle: { 
              crumb: 'Dashboard',
              meta: {
                title: 'My Orders',
                description: 'View and manage your bakery orders',
                keywords: ['orders', 'dashboard', 'delivery', 'bakery'],
              }
            },
          },
        ],
      },
      
      // ============================================
      // ACCOUNT STATUS
      // ============================================
      {
        path: 'account-status',
        Component: AccountStatusScreen,
        loader: accountStatusGuard,
        handle: {
          meta: {
            title: 'Account Status',
            description: 'Your account registration status',
            keywords: ['account', 'status', 'registration'],
          }
        },
      },
      
      // ============================================
      // PASSWORD RESET (Firebase action link handler)
      // ============================================
      {
        path: 'reset-password',
        Component: ResetPasswordPage,
        handle: {
          meta: {
            title: 'Reset Your Password',
            description: 'Set a new password for your Delight Bakehouse account',
          }
        },
      },

      // ============================================
      // 404 NOT FOUND
      // ============================================
      {
        path: '*',
        Component: NotFound,
        handle: {
          meta: {
            title: '404 - Page Not Found',
            description: 'The page you are looking for does not exist',
            keywords: ['404', 'not found', 'error'],
          }
        },
      },
    ],
  },
]);

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { LoaderFunctionArgs };

// ═══════════════════════════════════════════════════════════════════════════
// ROUTE-DRIVEN STATE MANAGEMENT HOOKS (March 10, 2026 - Phase 1-3)
// ═══════════════════════════════════════════════════════════════════════════

// Re-export URL state management hooks
export {
  useUrlFilters,
  useDebouncedUrlFilters,
  usePagination,
  useModalRouter,
  useTypedModalRouter,
  useCurrentModal,
  useHasOpenModal,
} from './hooks';

export type { 
  UrlFiltersOptions, 
  UrlFiltersReturn,
  ModalRouterOptions, 
  ModalRouterReturn,
} from './hooks';