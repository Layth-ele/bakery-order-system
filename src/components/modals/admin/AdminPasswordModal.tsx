/**
 * Admin Password Modal
 *
 * ✅ FEB 19, 2026: MOVED to /components/modals/ (consolidation project)
 * ✅ FEB 18, 2026: Converted to StyleModalShell (Modal Consistency Project - Batch 13)
 *
 * Security verification modal for admin actions.
 * Verifies admin password before allowing sensitive operations.
 *
 * Features:
 * - Password verification with rate limiting
 * - Firebase Auth bypass for logged-in admins
 * - Error handling with user feedback
 * - Auto-focus on password field
 * - Clear password on error for security
 */

import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { SaveFooter } from '../../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import {Lock, XCircle} from "lucide-react"
import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { logger } from '../../../utils/logger';


const DEBUG = false; // ✅ TEMPORARY: Enable for debugging payment confirmation issue

interface AdminPasswordModalProps {
  onConfirm: (password: string) => void;
  onClose: () => void; // ✅ Changed from onCancel to match ModalRoot
  message?: string; // Optional custom message
  title?: string; // Optional custom title
}

export function AdminPasswordModal({
  onConfirm,
  onClose,
  message,
  title,
}: AdminPasswordModalProps): JSX.Element | null {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // ✅ FIX: Check if user is already logged in as admin
  const { user } = useAuth();

  // Debug logging when modal opens
  useEffect(() => {
    if (DEBUG) logger.log("🔵 AdminPasswordModal opened");
    if (DEBUG)
    if (DEBUG) logger.log("   - user:", user);
    if (DEBUG) logger.log("   - user?.email:", user?.email);
    if (DEBUG) logger.log("   - user?.role:", user?.role);
  }, [user]);

  // Clear error when user types
  useEffect(() => {
    if (error) {
      setError("");
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // FIX BUG 16: Removed bypass that skipped Firebase reauthentication when
      // user.role === 'admin' was set in client React state. That check is trivially
      // spoofable via stale session state and does NOT prove the person at the
      // keyboard is the account holder. All admin actions must go through Firebase
      // reauthentication — there are no shortcuts.
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      
      if (!currentUser?.email) {
        setError("Not logged in. Please refresh and try again.");
        setPassword("");
        return;
      }

      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      
      onClose();
      setTimeout(() => { onConfirm(password); }, 100);
    } catch (error) {
      console.error("🔴 Password verification error:", error);
      const isWrongPassword = (error as any)?.code === "auth/wrong-password" || (error as any)?.code === "auth/invalid-credential";
      setError(isWrongPassword ? "❌ Incorrect password. Please try again." : "An unexpected error occurred. Please try again.");
      setPassword("");
    } finally {
      setIsVerifying(false);
    }
  };

  // ✅ Wrapper function for SaveFooter (doesn't need event parameter)
  const handleConfirm = async () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // FIX BUG 16: Same bypass removed here (was duplicated from handleSubmit).
      // Always require Firebase reauthentication for admin actions.
      const authInstance = getAuth();
      const currentUser = authInstance.currentUser;
      
      if (!currentUser?.email) {
        setError("Not logged in. Please refresh and try again.");
        setPassword("");
        return;
      }

      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      
      onClose();
      setTimeout(() => { onConfirm(password); }, 100);
    } catch (error) {
      console.error("🔴 Password verification error:", error);
      const isWrongPassword = (error as any)?.code === "auth/wrong-password" || (error as any)?.code === "auth/invalid-credential";
      setError(isWrongPassword ? "❌ Incorrect password. Please try again." : "An unexpected error occurred. Please try again.");
      setPassword("");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title={title || "VERIFY ADMIN PASSWORD"}
      subtitle="Security verification required"
      headerLeft={
        <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#333333]" />
      }
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={handleConfirm}
          isSaving={isVerifying}
          saveLabel={isVerifying ? "VERIFYING..." : "CONFIRM"}
          saveDisabled={!password.trim() || isVerifying}
        />
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-[#333333] text-sm sm:text-base leading-relaxed">
          {message ||
            "To change the customer type, please enter the admin password for verification."}
        </p>

        <div>
          <label className="block text-[#333333] mb-2 font-semibold text-sm sm:text-base">
            Admin Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white border-2 border-[#D4A574]/30 rounded-lg focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 text-[#333333] placeholder-neutral-400 text-sm sm:text-base transition-all"
            placeholder="Enter admin password"
            autoFocus
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border-2 border-red-500 rounded-xl p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm font-medium">
              {error}
            </p>
          </div>
        )}
      </form>
    </StyleModalShell>
  );
}

// Default export for lazy loading
export default AdminPasswordModal;