/**
 * Shared adapter for admin pages using the route outlet context.
 */

import { useOutletContext, useNavigate } from 'react-router';
import type { AdminPage } from '../../config/adminNavigation';

interface AdminOutletContext {
  user: {
    id: string;
    email: string;
    role: 'admin';
    storeName: string;
    contactPerson: string;
  };
  currentPage: AdminPage;
  setCurrentPage: (page: AdminPage) => void;
}

interface AdminPageProps {
  isActive?: boolean;
  user: AdminOutletContext['user'];
  onLogout: () => void;
  onBack: () => void;
  setCurrentPage?: (page: AdminPage) => void;
  currentPage?: string;
  [key: string]: unknown;
}

interface AdminPageAdapterProps {
  Component: React.ComponentType<any>;
}

/**
 * Adapter component that connects React Router context to admin page props
 */
export function AdminPageAdapter({ Component }: AdminPageAdapterProps): JSX.Element | null {
  const context = useOutletContext<AdminOutletContext>();
  const navigate = useNavigate();
  
  // Defensive check (should never happen due to route guards)
  if (!context || !context.user) {
    console.error('❌ AdminPageAdapter: No context from AdminLayout!');
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
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
  
  const { user, currentPage, setCurrentPage } = context;
  
  const handleLogout = () => {
    window.dispatchEvent(new Event('user-changed'));
    navigate('/');
  };
  
  const handleBack = () => {
    navigate('/admin');
  };
  
  return (
    <Component
      isActive={true}
      user={user}
      onLogout={handleLogout}
      onBack={handleBack}
      setCurrentPage={setCurrentPage}
      currentPage={currentPage}
    />
  );
}
