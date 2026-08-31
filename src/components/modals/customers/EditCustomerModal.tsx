/**
 * EditCustomerModal - Edit customer profile information
 *
 * ✅ FEB 21, 2026: Standardized loading states
 * ✅ FEB 19, 2026: MOVED to /components/modals/customers/ (consolidation project)
 * ✅ FEB 19, 2026: Updated to use StyleModalShell (renamed from RejectStyleModalShell)
 */

import { useState, useEffect } from "react";
import { useAlert } from "../../../contexts/AlertContext";
import { ToastNotification } from "../../ToastNotification";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { SaveFooter } from "../../../ui/modals/ModalFooterButtons";
import { ModalLoading } from "../../../ui/modals/ModalLoadingState";
import { AddressAutocomplete } from "../../AddressAutocomplete";
import { Edit3, Building2, User, Eye, Lock } from "lucide-react";
import type { Customer } from "../../../types";

// ✅ Password strength type
interface PasswordStrength {
  score: number;
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

interface EditCustomerModalProps {
  customer: Customer;
  onSave: (customer: Customer) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function EditCustomerModal({
  customer,
  onSave,
  onCancel,
  onClose,
}: EditCustomerModalProps): JSX.Element | null {
  const { showAlert } = useAlert();

  const [editingCustomer, setEditingCustomer] =
    useState<Customer>({ ...customer });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notification, setNotification] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>({
      score: 0,
      feedback: [],
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
      },
    });
  const [isValidatingPassword, setIsValidatingPassword] =
    useState(false);

  useEffect(() => {
    // ✅ FIX: Use customer prop directly (already has fresh Firebase data from parent)
    setEditingCustomer({ ...customer });
    setIsLoading(false);
  }, [customer]);

  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({
        score: 0,
        feedback: [],
        requirements: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumber: false,
          hasSpecial: false,
        },
      });
      return;
    }

    setIsValidatingPassword(true);
    const timeoutId = setTimeout(() => {
      setPasswordStrength(
        calculatePasswordStrengthClient(newPassword),
      );
      setIsValidatingPassword(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [newPassword]);

  const calculatePasswordStrengthClient = (
    password: string,
  ): PasswordStrength => {
    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };

    const feedback: string[] = [];
    let score = 0;

    if (!requirements.minLength)
      feedback.push("Password must be at least 8 characters");
    else score++;

    if (!requirements.hasUppercase)
      feedback.push("Add uppercase letters (A-Z)");
    else score++;

    if (!requirements.hasNumber)
      feedback.push("Add numbers (0-9)");
    else score++;

    if (!requirements.hasSpecial)
      feedback.push("Add special characters (!@#$%^&*)");
    else score++;

    if (password.length >= 12) score++;

    return {
      score: Math.min(score, 4),
      feedback,
      requirements,
    };
  };

  const generateStrongPassword = () => {
    // FIX T2R3-C3 (CRITICAL — security): Was using Math.random() for password
    // generation.  Math.random() is NOT cryptographically secure — V8's PRNG
    // can be reverse-engineered from a small number of consecutive outputs,
    // allowing an attacker to predict generated passwords.  Now uses
    // crypto.getRandomValues() — the browser-native CSPRNG.
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + special;

    // Helper: cryptographically-secure random index into a charset.
    // Uses rejection sampling to avoid modulo bias (which would make some
    // characters slightly more likely than others).
    const randIdx = (max: number): number => {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0xFFFFFFFF / max) * max;
      let n: number;
      do {
        crypto.getRandomValues(buf);
        n = buf[0];
      } while (n >= limit);
      return n % max;
    };

    // Build the password — guaranteed at least one of each char class
    const chars: string[] = [
      uppercase[randIdx(uppercase.length)],
      lowercase[randIdx(lowercase.length)],
      numbers[randIdx(numbers.length)],
      special[randIdx(special.length)],
    ];
    for (let i = 4; i < 12; i++) {
      chars.push(all[randIdx(all.length)]);
    }

    // Fisher–Yates shuffle (cryptographically-secure)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randIdx(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const password = chars.join('');

    setNewPassword(password);
    setConfirmPassword(password);
    setShowNewPassword(true);
    setShowConfirmPassword(true);

    showNotification("🔐 Strong password generated!");
  };

  const getPasswordStrengthDisplay = () => {
    switch (passwordStrength.score) {
      case 0:
        return {
          color: "#F44336",
          label: "Very Weak",
          width: "20%",
        };
      case 1:
        return {
          color: "#FF9800",
          label: "Weak",
          width: "40%",
        };
      case 2:
        return {
          color: "#FFC107",
          label: "Fair",
          width: "60%",
        };
      case 3:
        return {
          color: "#8BC34A",
          label: "Good",
          width: "80%",
        };
      case 4:
        return {
          color: "#4CAF50",
          label: "Strong",
          width: "100%",
        };
      default:
        return { color: "#666", label: "", width: "0%" };
    }
  };

  const strengthDisplay = getPasswordStrengthDisplay();

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3000);
  };

  const handleSave = async () => {
    // Basic validation before saving
    if (!editingCustomer.storeName?.trim() && !editingCustomer.contactPerson?.trim()) {
      showAlert({ title: 'Validation Error', message: 'Please enter a store name or contact person.', icon: 'warning' });
      return;
    }
    if (!editingCustomer.email?.trim()) {
      showAlert({ title: 'Validation Error', message: 'Email address is required.', icon: 'warning' });
      return;
    }

    await onSave(editingCustomer);
  };

  if (isLoading) {
    return (
      <StyleModalShell
        width="4xl"
        skinType="default"
        onClose={onClose ?? (() => {})}
        title="EDIT CUSTOMER"
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center shadow-lg">
            <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
      >
        <ModalLoading
          message="Loading customer data..."
        />
      </StyleModalShell>
    );
  }

  return (
    <>
      {notification && (
        <ToastNotification
          message={notification}
          onClose={() => setNotification("")}
        />
      )}

      <StyleModalShell
        onClose={onCancel || onClose || (() => {})}
        title="EDIT CUSTOMER"
        subtitle={
          editingCustomer.storeName ||
          editingCustomer.contactPerson
        }
        width="4xl"
        headerLeft={
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#D4A574] flex items-center justify-center shadow-lg">
            <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        }
        footer={
          <SaveFooter
            onCancel={onCancel || onClose || (() => {})}
            onSave={handleSave}
            saveLabel="SAVE CHANGES"
          />
        }
      >
        <div className="space-y-6">
          {/* Customer Type Badge */}
          <div className="flex justify-end">
            {/* Customer Type Badge — handles admin / commercial / individual */}
            {(() => {
              const ct = editingCustomer.customerType;
              const isAdmin      = ct === 'admin' || (editingCustomer as any).role === 'admin';
              const isCommercial = ct === 'commercial';
              const badgeColor   = isAdmin ? '#FF9800' : isCommercial ? '#2196F3' : '#9C27B0';
              const BadgeIcon    = isAdmin ? Lock : isCommercial ? Building2 : User;
              const badgeLabel   = isAdmin ? 'Admin' : isCommercial ? 'Commercial' : 'Individual';
              return (
                <>
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
                    style={{ backgroundColor: badgeColor }}>
                    <BadgeIcon className="w-5 h-5 text-white" />
                    <span className="text-sm font-semibold text-white uppercase tracking-wide">{badgeLabel}</span>
                  </div>
                  <div className="md:hidden flex items-center justify-center w-10 h-10 rounded-full shadow-lg"
                    style={{ backgroundColor: badgeColor }}>
                    <BadgeIcon className="w-5 h-5 text-white" />
                  </div>
                </>
              );
            })()}
          </div>

          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={editingCustomer.email || ""}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                value={editingCustomer.storeName || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    storeName: e.target.value,
                  })
                }
                placeholder="Enter store name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={editingCustomer.contactPerson || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    contactPerson: e.target.value,
                  })
                }
                placeholder="Enter contact person name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editingCustomer.phone || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    phone: e.target.value,
                  })
                }
                placeholder="Enter phone number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>

            {/* Store Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Address
              </label>
              <AddressAutocomplete
                value={editingCustomer.storeAddress || ""}
                onChange={(value) =>
                  setEditingCustomer({
                    ...editingCustomer,
                    storeAddress: value,
                  })
                }
                placeholder="Enter store address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
              />
            </div>
          </div>

          {/* Password Change Section */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              Change Password (Optional)
            </h3>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showCurrentPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      Password Strength:
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: strengthDisplay.color }}
                    >
                      {strengthDisplay.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: strengthDisplay.width,
                        backgroundColor: strengthDisplay.color,
                      }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {passwordStrength.feedback.map((item, index) => (
                        <li
                          key={index}
                          className="text-xs text-gray-600 flex items-start gap-1"
                        >
                          <span className="text-red-500 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {newPassword &&
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>

            {/* Generate Password Button */}
            <button
              type="button"
              onClick={generateStrongPassword}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
            >
              🔐 Generate Strong Password
            </button>
          </div>
        </div>
      </StyleModalShell>
    </>
  );
}

export default EditCustomerModal;