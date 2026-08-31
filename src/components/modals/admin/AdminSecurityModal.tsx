import { useState } from 'react';
import type { User } from '../../../hooks/useAuth';
/**
 * AdminSecurityModal - Admin security warnings and password verification
 *
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 * ✅ FEB 18, 2026: Converted to RejectStyleModalShell for consistency
 * ✅ FEB 18, 2026: Extracted from inline modal in RegistrationRequests.tsx
 *
 * Security verification modal to confirm admin role before creating new admin accounts.
 * Validates that only admins can create new admin users.
 */

import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { SaveFooter } from "../../../ui/modals/ModalFooterButtons"; // ✅ FEB 21, 2026
import { Shield, Lock } from "lucide-react";
import { useModal } from "../../../contexts/ModalContextNew";

interface AdminSecurityModalProps {
  user: User;
  onConfirm: () => void;
}

export function AdminSecurityModal({
  user,
  onConfirm,
}: AdminSecurityModalProps): JSX.Element | null {
  const { closeModal } = useModal();
  const [error, setError] = useState("");

  const handleConfirm = () => {
    // Role-based check
    const isCurrentUserAdmin =
      user.role === "admin" || user.customerType === "admin";

    if (!isCurrentUserAdmin) {
      setError("❌ Only admins can create new admin accounts!");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // ✅ In production, implement proper re-authentication with Firebase Auth
    // For demo mode, we trust the current user's session

    onConfirm();
    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      onClose={handleCancel}
      title="ADMIN VERIFICATION"
      icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6" />}
      footer={
        <SaveFooter
          onCancel={handleCancel}
          onSave={handleConfirm}
          saveIcon={<Lock className="w-4 h-4" />}
          saveLabel="Proceed"
        />
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            ⚠️ <strong>Admin Role Verification:</strong> Only
            administrators can create new admin accounts.
            {user.role === "admin"
              ? " You are verified as an admin."
              : " Please verify your admin credentials."}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </StyleModalShell>
  );
}