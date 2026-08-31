/**
 * CustomerLayout.tsx
 * Layout wrapper for all customer routes
 * 
 * Provides:
 * - Customer notification provider
 * - Customer navigation
 * - Consistent layout structure
 * - Authentication context
 */

import { Outlet, useLoaderData, useNavigate } from 'react-router';
import { getAuth, signOut } from 'firebase/auth';
import { CustomerNotificationProvider } from '../../notifications';
import { RouteErrorBoundary } from '../components/ErrorBoundary';
import { Suspense } from 'react';
import { CustomerRouteLoader } from '../components/RouteLoader';

interface CustomerLoaderData {
  user: {
    id: string;
    email: string;
    role: 'customer';
    storeName: string;
    contactPerson: string;
    status: 'approved';
    customerType: string;
    storeAddress?: string;
  };
}

export function CustomerLayout(): JSX.Element | null {
  const loaderData = useLoaderData() as CustomerLoaderData;
  const navigate = useNavigate();
  
  // The customerGuard loader ensures we always have user data here
  // If we don't, it's a routing bug (loader didn't run)
  if (!loaderData?.user) {
    console.error('❌ CRITICAL: CustomerLayout rendered without user data. This should never happen - loader guard failed.');
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4a4a4a] via-[#3a3a3a] to-[#2a2a2a] flex items-center justify-center">
        <div className="text-center text-gray-300">
          <p className="text-xl mb-4">Authentication Error</p>
          <p className="mb-4">Please log in to continue.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#D4A574] text-black rounded hover:bg-[#C49574] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
  
  const { user } = loaderData;
  
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    navigate('/');
  };
  
  return (
    <CustomerNotificationProvider customerId={user.id}>
      <RouteErrorBoundary>
        <Suspense fallback={<CustomerRouteLoader />}>
          <Outlet context={{ user, onLogout: handleLogout }} />
        </Suspense>
      </RouteErrorBoundary>
    </CustomerNotificationProvider>
  );
}