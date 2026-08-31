/**
 * 📄 InvoicesPage - Weekly Invoices Management
 *
 * Thin wrapper that renders WeeklyInvoices component.
 * WeeklyInvoices has the full feature set:
 * - Completed orders list with filters
 * - View Invoice button → COMPLETED_ORDER_INVOICE modal
 * - Excel/PDF download per order
 * - Pagination, search, year/customer filters
 * - Stats: Total Invoices, Total Revenue, Avg Order
 */

import { WeeklyInvoices } from '../../components/admin/WeeklyInvoices';
import type { AdminPage } from '../../config/adminNavigation';
import type { User } from '../../services/firebase/authService';

interface InvoicesPageProps {
  isActive?: boolean;
  user: any;
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage | string) => void;
}

export function InvoicesPage({
  isActive = true,
  user,
  onLogout,
  onBack,
  setCurrentPage,
}: InvoicesPageProps): JSX.Element | null {
  return (
    <WeeklyInvoices
      isActive={isActive}
      user={user as User}
      onLogout={onLogout}
      onBack={onBack}
      setCurrentPage={setCurrentPage}
    />
  );
}

export default InvoicesPage;
