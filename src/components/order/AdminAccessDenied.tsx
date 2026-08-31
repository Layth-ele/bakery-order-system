/**
 * AdminAccessDenied Component
 * 
 * Reusable access denied screen for admin-only order components.
 * Shows when non-admin users attempt to access admin pages.
 * 
 * SECURITY: Part of Phase 4 defense-in-depth strategy
 */

import { XCircle } from 'lucide-react';

interface AdminAccessDeniedProps {
  onBack: () => void;
  pageName?: string;
}

export function AdminAccessDenied({ onBack, pageName = 'this page' }: AdminAccessDeniedProps): JSX.Element | null {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#f0f0f0] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl border-2 border-red-500/30 shadow-lg p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600 mb-6">
            Administrator privileges are required to view {pageName}.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
