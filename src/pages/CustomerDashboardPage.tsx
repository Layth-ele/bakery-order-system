/**
 * CustomerDashboardPage.tsx
 * Thin wrapper with a default export so Vite lazy() can resolve it cleanly.
 */
import { CustomerDashboardMain } from '../components/customer/customer-dashboard/CustomerDashboardMain';

export default function CustomerDashboardPage() {
  return <CustomerDashboardMain />;
}
