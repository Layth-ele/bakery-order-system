/**
 * ResetPasswordPage — /reset-password
 *
 * Handles the Firebase password-reset action link:
 *   ?mode=resetPassword&oobCode=ABC123&apiKey=...
 *
 * Flow:
 *  1. Parse + verify the oobCode from the URL
 *  2. Show a branded "set new password" form
 *  3. Call confirmPasswordReset(auth, oobCode, newPassword)
 *  4. Show success screen with link back to login
 *
 * States: verifying → idle | invalid | success | error
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { useCachedSettings } from '../hooks/useCachedFirebase';
import {
  KeyRound, Eye, EyeOff, CheckCircle, AlertCircle,
  Loader2, ArrowLeft, ShieldCheck,
} from 'lucide-react';

// ── Password strength helper ────────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-gray-200' };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: 'Weak',   color: 'bg-red-400' };
  if (s <= 2) return { score: s, label: 'Fair',   color: 'bg-amber-400' };
  if (s <= 3) return { score: s, label: 'Good',   color: 'bg-yellow-400' };
  if (s <= 4) return { score: s, label: 'Strong', color: 'bg-emerald-400' };
  return             { score: s, label: 'Great',  color: 'bg-emerald-600' };
}

type Stage = 'verifying' | 'idle' | 'submitting' | 'success' | 'invalid' | 'error';

export function ResetPasswordPage(): JSX.Element {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const [stage, setStage]       = useState<Stage>('verifying');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [error, setError]       = useState('');

  const oobCode = searchParams.get('oobCode') || '';

  // ── Business branding ─────────────────────────────────────────────────────
  const { data: settings } = useCachedSettings();
  const bizName  = settings?.businessName  || 'Your Bakery Name';
  const bizEmail = settings?.businessEmail || 'orders@example.com';

  // ── 1. Verify the oobCode on mount ────────────────────────────────────────
  useEffect(() => {
    if (!oobCode) { setStage('invalid'); return; }
    verifyPasswordResetCode(auth, oobCode)
      .then(emailFromCode => { setEmail(emailFromCode); setStage('idle'); })
      .catch(() => setStage('invalid'));
  }, [oobCode]);

  // ── 2. Submit new password ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); return;
    }

    setStage('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStage('success');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setStage('invalid');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger one.');
        setStage('idle');
      } else {
        setError('Something went wrong. Please try again or request a new reset link.');
        setStage('error');
      }
    }
  };

  const strength = getStrength(password);

  // ── Branded page shell ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1208] via-[#2c1f0e] to-[#1a1208] flex flex-col items-center justify-center px-4 py-10">

      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4A574] to-[#B8935E] shadow-lg mb-3">
          <KeyRound className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>
          {bizName}
        </h1>
        <p className="text-[#D4A574]/70 text-xs mt-1 uppercase tracking-widest">Wholesale Portal</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── VERIFYING ──────────────────────────────────────────────── */}
        {stage === 'verifying' && (
          <div className="p-10 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-[#D4A574] animate-spin" />
            <p className="text-gray-500 text-sm">Verifying your reset link…</p>
          </div>
        )}

        {/* ── INVALID / EXPIRED ──────────────────────────────────────── */}
        {(stage === 'invalid' || stage === 'error') && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {stage === 'invalid' ? 'Link Expired or Invalid' : 'Something Went Wrong'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {stage === 'invalid'
                ? 'This password reset link has expired or already been used. Reset links are valid for 1 hour.'
                : 'We encountered an unexpected error. Please try again.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C49564] transition-all shadow-md"
              >
                Back to Login
              </button>
              <p className="text-xs text-gray-400">
                Need help?{' '}
                <a href={`mailto:${bizEmail}`} className="text-[#D4A574] hover:underline">
                  Contact us
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ── SUCCESS ────────────────────────────────────────────────── */}
        {stage === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
            <p className="text-gray-500 text-sm mb-2">
              Your password has been successfully changed.
            </p>
            <p className="text-[#8B6F47] text-sm font-medium mb-6 bg-[#faf8f5] rounded-xl px-4 py-2">
              {email}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C49564] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Sign in with new password
            </button>
          </div>
        )}

        {/* ── FORM (idle | submitting) ───────────────────────────────── */}
        {(stage === 'idle' || stage === 'submitting') && (
          <div className="p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#D4A574]/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#D4A574]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
                <p className="text-xs text-gray-500 mt-0.5">For <span className="font-medium text-[#8B6F47]">{email}</span></p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label htmlFor="rp-pw" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="rp-pw"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    disabled={stage === 'submitting'}
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A574]/40 focus:border-[#D4A574] focus:bg-white transition disabled:opacity-50"
                  />
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded-full transition-all ${
                            i <= strength.score ? strength.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Strength: <span className="font-semibold">{strength.label}</span>
                      <span className="text-gray-400"> — use 8+ chars, uppercase, numbers & symbols</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="rp-cf" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="rp-cf"
                    type={showCf ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={stage === 'submitting'}
                    className={`w-full pl-10 pr-11 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A574]/40 focus:border-[#D4A574] focus:bg-white transition disabled:opacity-50 ${
                      confirm && password && confirm !== password
                        ? 'border-red-300 bg-red-50'
                        : confirm && password && confirm === password
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  />
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => setShowCf(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {confirm && password && confirm === password && (
                    <CheckCircle className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  )}
                </div>
                {confirm && password && confirm !== password && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={stage === 'submitting' || !password || !confirm}
                className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C49564] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {stage === 'submitting'
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Updating password…</>
                  : <><ShieldCheck className="w-4 h-4" />Update Password</>}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[#D4A574]/40 text-xs mt-8">
        © {new Date().getFullYear()} {bizName} · Wholesale Portal
      </p>
    </div>
  );
}
