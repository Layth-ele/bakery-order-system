/**
 * Admin page code loaders — one place, used by the lazy routes
 * (routes/index.tsx) and by preloadAdminPages() (AdminLayout), so preloading
 * warms exactly the modules the routes will render.
 */
export const adminPageLoaders = {
  analytics: () => import('../pages/admin/AdminAnalyticsDashboard').then(m => ({ default: m.AdminAnalyticsDashboard })),
  customers: () => import('../pages/admin/CustomersList').then(m => ({ default: m.CustomersList })),
  products: () => import('../pages/admin/ManageProducts').then(m => ({ default: m.ManageProducts })),
  settings: () => import('../pages/admin/SystemSettings').then(m => ({ default: m.SystemSettings })),
  registrations: () => import('../pages/admin/RegistrationRequests').then(m => ({ default: m.RegistrationRequests })),
  pending: () => import('../pages/admin/PendingOrdersPage').then(m => ({ default: m.PendingOrdersPage })),
  unpaid: () => import('../pages/admin/AdminUnpaidOrdersPage'),
  approved: () => import('../pages/admin/ApprovedOrdersPage').then(m => ({ default: m.ApprovedOrdersPage })),
  history: () => import('../pages/admin/CompleteOrdersPage'),
  invoices: () => import('../pages/admin/InvoicesPage'),
  production: () => import('../pages/admin/ProductionToDoPage').then(m => ({ default: m.ProductionToDoPage })),
};

/**
 * Load every admin page's code while the browser is idle, so switching pages
 * never waits on a download/parse. Safe to call more than once (imports are
 * cached); failures are ignored — the page will just load on demand.
 */
export function preloadAdminPages(): void {
  for (const load of Object.values(adminPageLoaders)) {
    load().catch(() => {});
  }
}

