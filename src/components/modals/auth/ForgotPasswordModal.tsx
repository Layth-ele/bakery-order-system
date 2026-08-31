/**
 * ForgotPasswordModal — Three-state Firebase password reset flow:
 *   idle → user types email
 *   loading → Firebase sending reset link
 *   success → confirmation with next-steps guidance
 */

import { useState } from 'react';
import { Mail, KeyRound, ArrowLeft, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { resetPassword } from '../../../services/firebase/authService';

interface ForgotPasswordModalProps {
  onClose: () => void;
  initialEmail?: string;
}

type Step = 'idle' | 'loading' | 'success';

export function ForgotPasswordModal({
  onClose,
  initialEmail = '',
}: ForgotPasswordModalProps): JSX.Element | null {
  const [email, setEmail] = useState(initialEmail);
  const [step,  setStep]  = useState<Step>('idle');
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<'general' | 'not-registered' | 'not-approved'>('general');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorType('general');
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.'); return;
    }
    setStep('loading');
    try {
      const result = await resetPassword(trimmed);
      if (result.success) {
        setStep('success');
      } else {
        if ((result as any).notRegistered) setErrorType('not-registered');
        else if ((result as any).notApproved) setErrorType('not-approved');
        else setErrorType('general');
        setError(result.message || 'Failed to send reset email. Please try again.');
        setStep('idle');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('idle');
    }
  };

  return (
    <StyleModalShell
      width="md"
      skinType="default"
      onClose={onClose}
      title={step === 'success' ? 'Check Your Email' : 'Reset Password'}
      icon={step === 'success'
        ? <CheckCircle className="w-5 h-5 text-emerald-600" />
        : <KeyRound className="w-5 h-5" />}
    >
      {step === 'success' ? (
        <div className="py-2">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
              <Mail className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <p className="text-center text-gray-600 text-sm mb-1.5">We sent a reset link to:</p>
          <p className="text-center font-semibold text-[#8B6F47] text-sm bg-[#faf8f5] border border-[#D4A574]/30 rounded-xl px-4 py-2.5 mb-5 break-all">
            {email}
          </p>
          <div className="bg-[#faf8f5] border border-[#D4A574]/25 rounded-xl p-4 mb-5 space-y-3">
            {[
              { n: '1', t: 'Check your inbox',    d: 'The email arrives within a minute.' },
              { n: '2', t: 'Click the reset link', d: 'Opens a secure password-reset page.' },
              { n: '3', t: 'Set a new password',   d: 'Choose something strong and unique.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#D4A574] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {n}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t}</p>
                  <p className="text-xs text-gray-500">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mb-5">
            Can't find it? Check spam, or{' '}
            <button type="button" onClick={() => { setStep('idle'); setError(''); }}
              className="text-[#D4A574] hover:underline font-medium">
              try again
            </button>.
          </p>
          <button type="button" onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C49564] transition-all shadow-md">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="py-2 space-y-5">
          <div className="bg-[#faf8f5] border border-[#D4A574]/25 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="w-4 h-4 text-[#D4A574] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600 leading-relaxed">
                Enter the email address linked to your account and we'll send you a secure link to reset your password.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="fp-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="your@email.com"
                autoFocus
                autoComplete="email"
                disabled={step === 'loading'}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-[#D4A574]/40 focus:border-[#D4A574] ${
                  error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'
                }`}
              />
            </div>
            {error && (
              <div className={`mt-3 rounded-xl p-3 border flex items-start gap-3 ${
                errorType === 'not-registered'
                  ? 'bg-orange-50 border-orange-200'
                  : errorType === 'not-approved'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                  errorType === 'not-registered' ? 'text-orange-500'
                  : errorType === 'not-approved' ? 'text-amber-600'
                  : 'text-red-500'
                }`} />
                <div>
                  <p className={`text-xs font-semibold mb-0.5 ${
                    errorType === 'not-registered' ? 'text-orange-700'
                    : errorType === 'not-approved' ? 'text-amber-700'
                    : 'text-red-700'
                  }`}>
                    {errorType === 'not-registered' ? 'Not Registered'
                     : errorType === 'not-approved' ? 'Account Not Approved'
                     : 'Error'}
                  </p>
                  <p className={`text-xs ${
                    errorType === 'not-registered' ? 'text-orange-600'
                    : errorType === 'not-approved' ? 'text-amber-600'
                    : 'text-red-600'
                  }`}>{error}</p>
                  {errorType === 'not-registered' && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-1.5 text-xs text-orange-700 font-semibold underline hover:text-orange-800"
                    >
                      Go back to register →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={step === 'loading'}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button type="submit" disabled={step === 'loading' || !email.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:from-[#7A5F3C] hover:to-[#C49564] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
              {step === 'loading'
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                : <><Mail className="w-4 h-4" />Send Reset Link</>}
            </button>
          </div>
        </form>
      )}
    </StyleModalShell>
  );
}
