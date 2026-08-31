/**
 * AdminPasswordConfirmModal - Admin must enter password to confirm sensitive actions
 * 
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell (Modal Consistency Project - Batch 14)
 * ✅ FEB 16, 2026: Added prominent yellow warning box for financial confirmations
 * ✅ FEB 9, 2026: Fixed z-index and added ARIA attributes
 * 
 * Security layer for critical financial operations.
 * Requires admin to re-enter password before confirming payment.
 * Prevents unauthorized payment confirmations.
 * 
 * Features:
 * - Firebase Auth or localStorage verification
 * - Prominent yellow warning box
 * - "This action cannot be undone" warning
 * - Error handling with auto-clear
 * - Loading state with spinner
 */

import { useState } from 'react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { Lock, AlertCircle } from 'lucide-react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { isFirebaseConfigured } from '../../../firebase/config';
import { normalizeLoginError } from '../../../utils/error/firebaseAuthErrors';

interface AdminPasswordConfirmModalProps {
  adminEmail: string;
  actionDescription: string; // e.g., "Confirm Payment of $150.00"
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function AdminPasswordConfirmModal({
  adminEmail,
  actionDescription,
  onConfirm,
  onClose,
}: AdminPasswordConfirmModalProps): JSX.Element | null {
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('❌ Please enter your password!');
      return;
    }

    setVerifying(true);

    try {
      // Firebase reauthentication - verifies against real Firebase credentials
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      if (!currentUser) throw new Error('Not logged in');
      const credential = EmailAuthProvider.credential(adminEmail, password);
      await reauthenticateWithCredential(currentUser, credential);

      // Password verified - execute the action
      await onConfirm();
      
      // Close modal after successful action
      onClose();
      
    } catch (error) {
      console.error('❌ Password verification failed:', error);
      
      // User-friendly error messages
      const normalizedError = normalizeLoginError(error);
      setError(normalizedError);
      setPassword('');
      setTimeout(() => setError(''), 3000);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="warning"
            onClose={verifying ? () => {} : onClose}
      title="ADMIN SECURITY"
      headerLeft={
        <Lock className="w-6 h-6 text-white" />
      }
    >
      {/* Icon */}
      <div className="flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-[#FF9800] bg-opacity-20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-[#FF9800]" />
        </div>
      </div>

      {/* ✅ Prominent Yellow Warning Box */}
      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-3 border-yellow-400 rounded-xl p-5 mb-6 shadow-lg">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-gray-900 text-lg font-bold mb-2">
              ⚠️ Confirm Financial Action
            </h3>
            <p className="text-gray-800 font-semibold text-base leading-relaxed">
              {actionDescription}
            </p>
          </div>
        </div>
        
        <div className="border-t-2 border-yellow-300 pt-3 mt-3">
          <p className="text-gray-700 text-sm font-medium flex items-center gap-2">
            <span className="text-red-600 font-bold text-base">⚠️</span>
            <span>This action will update accounting records and <strong>cannot be undone</strong>.</span>
          </p>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-gray-900 text-lg text-center mb-2 font-bold">
        Enter Your Admin Password to Confirm
      </h3>
      <p className="text-gray-600 text-center mb-6 text-sm">
        Password verification required for security
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Admin Email (readonly) */}
        <input
          type="email"
          value={adminEmail}
          disabled
          className="w-full px-4 py-3 bg-gray-100 border-2 border-[#E8C4A2] rounded-lg text-[#333333] font-medium cursor-not-allowed"
        />

        {/* Password Input */}
        <input
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setPassword(e.target.value);
            setError('');
          }}
          placeholder="Enter admin password"
          className="w-full px-4 py-3 border-2 border-[#E8C4A2] rounded-lg focus:outline-none focus:border-[#FF9800] text-[#333333] font-medium placeholder:text-gray-400"
          autoFocus
          disabled={verifying}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-[#FFEBEE] border-2 border-[#F44336] rounded-lg p-3 text-center">
            <p className="text-[#F44336] font-bold">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        <button
          type="submit"
          disabled={verifying || !password.trim()}
          className="w-full px-4 py-3 bg-[#FF9800] text-white rounded-lg hover:bg-[#F57C00] transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Verifying...
            </span>
          ) : (
            'CONFIRM'
          )}
        </button>
      </form>
    </StyleModalShell>
  );
}