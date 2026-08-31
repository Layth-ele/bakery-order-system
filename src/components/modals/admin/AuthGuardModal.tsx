/**
 * AuthGuardModal — Single unified admin authentication guard.
 *
 * For payment confirmations, pass checklistItems so admin must verify
 * each item (order number, transfer password, amount) before confirming.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { Lock, AlertTriangle, ShieldCheck, Loader2, Eye, EyeOff, CheckSquare, Square, CreditCard, Hash, DollarSign, User } from 'lucide-react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { normalizeLoginError } from '../../../utils/error/firebaseAuthErrors';

export interface ChecklistItem {
  id: string;
  label: string;
  value?: string;  // highlighted value to verify (e.g., the order number)
  icon?: 'order' | 'password' | 'amount' | 'customer';
}

interface AuthGuardModalProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  danger?: boolean;
  /** Checklist items admin must tick before confirm is enabled */
  checklistItems?: ChecklistItem[];
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

const CHECKLIST_ICONS: Record<string, React.ReactNode> = {
  order:    <Hash className="w-4 h-4" />,
  password: <CreditCard className="w-4 h-4" />,
  amount:   <DollarSign className="w-4 h-4" />,
  customer: <User className="w-4 h-4" />,
};

export function AuthGuardModal({
  title = 'Admin Verification Required',
  description,
  actionLabel = 'Confirm',
  danger = false,
  checklistItems,
  onConfirm,
  onClose,
}: AuthGuardModalProps): JSX.Element {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => {
      setLockoutSeconds(s => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const allChecked = !checklistItems || checklistItems.every(item => checked[item.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0 || verifying || !allChecked) return;

    setError('');
    if (!password.trim()) {
      setError('Please enter your admin password.');
      return;
    }

    setVerifying(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setError('You must be logged in to perform this action.');
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      await onConfirm();
      onClose();
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPassword('');
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutSeconds(LOCKOUT_SECONDS);
        setError(`Too many failed attempts. Try again in ${LOCKOUT_SECONDS} seconds.`);
      } else {
        const msg = normalizeLoginError(err);
        setError(`${msg} (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? '' : 's'} remaining)`);
      }
    } finally {
      setVerifying(false);
    }
  };

  const isLocked = lockoutSeconds > 0;
  const canSubmit = password.trim().length > 0 && !verifying && !isLocked && allChecked;
  const skin = danger ? 'danger' : 'warning';
  const accentColor = danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#FF9800] hover:bg-[#F57C00]';
  const iconColor = danger ? 'text-red-500' : 'text-[#FF9800]';
  const iconBg = danger ? 'bg-red-50' : 'bg-amber-50';
  const warnBg = danger ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const warnText = danger ? 'text-red-800' : 'text-amber-800';

  return (
    <StyleModalShell
      width="4xl"
      skinType={skin}
      onClose={verifying ? () => {} : onClose}
      title="ADMIN VERIFICATION"
      headerLeft={<Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
    >
      <div className="space-y-4">

        {/* Lock icon */}
        <div className="flex justify-center">
          <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center`}>
            <Lock className={`w-7 h-7 ${iconColor}`} />
          </div>
        </div>

        {/* Checklist — shown instead of plain description when items provided */}
        {checklistItems && checklistItems.length > 0 ? (
          <div className={`rounded-xl border ${warnBg}`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-4 py-3 border-b ${danger ? 'border-red-200' : 'border-amber-200'}`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
              <p className={`text-sm font-bold ${warnText}`}>{title}</p>
            </div>

            {/* Checklist items */}
            <div className="p-4 space-y-3">
              <p className={`text-xs ${warnText} opacity-70 mb-3`}>
                Please verify the following details before confirming:
              </p>
              {checklistItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    checked[item.id]
                      ? 'border-green-400 bg-green-50'
                      : danger ? 'border-red-200 bg-white hover:border-red-300' : 'border-amber-200 bg-white hover:border-amber-300'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    {checked[item.id]
                      ? <CheckSquare className="w-5 h-5 text-green-500" />
                      : <Square className={`w-5 h-5 ${iconColor} opacity-50`} />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                      checked[item.id] ? 'text-green-700' : warnText
                    }`}>
                      {item.icon && (
                        <span className="inline-flex items-center gap-1">
                          {CHECKLIST_ICONS[item.icon]}
                          {item.label}
                        </span>
                      )}
                      {!item.icon && item.label}
                    </p>
                    {item.value && (
                      <p className={`text-sm font-bold font-mono break-all ${
                        checked[item.id] ? 'text-green-800' : 'text-neutral-800'
                      }`}>
                        {item.value}
                      </p>
                    )}
                  </div>
                </button>
              ))}

              {/* Progress indicator */}
              <p className={`text-xs text-center font-medium mt-2 ${
                allChecked ? 'text-green-600' : 'text-neutral-400'
              }`}>
                {allChecked
                  ? '✅ All items verified — enter password below'
                  : `${Object.values(checked).filter(Boolean).length} / ${checklistItems.length} items verified`
                }
              </p>
            </div>
          </div>
        ) : (
          /* Plain description (legacy / non-payment use) */
          description && (
            <div className={`rounded-xl p-4 border ${warnBg}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
                <div>
                  <p className={`text-sm font-semibold ${warnText}`}>{title}</p>
                  <p className={`text-sm mt-1 ${warnText} opacity-80`}>{description}</p>
                  {danger && (
                    <p className="text-xs text-red-600 font-bold mt-2">
                      ⚠️ This action cannot be undone.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-neutral-700 text-center">
            Enter your admin password to continue
          </label>

          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Admin password"
              disabled={verifying || isLocked || !allChecked}
              className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none text-neutral-800 font-medium placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:cursor-not-allowed transition-colors ${
                !allChecked
                  ? 'border-neutral-200 opacity-50 cursor-not-allowed'
                  : 'border-neutral-300 focus:border-[#FF9800]'
              }`}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e as any)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {!allChecked && checklistItems && (
            <p className="text-xs text-center text-neutral-400">
              ☝️ Check all items above to enable the password field
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-center">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              {isLocked && (
                <p className="text-red-500 text-xs mt-1">Unlocks in {lockoutSeconds}s</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 px-4 py-3 ${accentColor} text-white rounded-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {verifying ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</>
              ) : isLocked ? (
                `Locked (${lockoutSeconds}s)`
              ) : (
                <><ShieldCheck className="w-4 h-4" />{actionLabel}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </StyleModalShell>
  );
}

export default AuthGuardModal;
