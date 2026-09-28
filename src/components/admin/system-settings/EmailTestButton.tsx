/**
 * EmailTestButton — System Settings → "Send test email".
 *
 * Calls the sendTestEmail Cloud Function and reports exactly what happened:
 * delivered, or which piece of setup is missing (API key, sender, portal URL).
 */
import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { sendTestEmail, describeEmailResult, type TestEmailResult } from '../../../services/emailService';

export function EmailTestButton() {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; missing: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r: TestEmailResult = await sendTestEmail(to.trim() || undefined);
      const missing = [
        !r.config.apiKey && 'RESEND_API_KEY secret',
        !r.config.from && 'EMAIL_FROM sender address',
        !r.config.appUrl && 'APP_URL (links in emails are hidden until set)',
      ].filter(Boolean) as string[];
      setResult({ ok: r.state === 'sent', message: describeEmailResult(r), missing });
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message || 'Could not reach the email service.', missing: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-700 mb-1">Test email delivery</div>
      <p className="text-xs text-gray-500 mb-3">
        Sends a branded test email. Leave blank to send it to your own admin address.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          aria-label="Test email recipient"
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#8B6F47] text-white text-sm font-semibold hover:bg-[#7a6140] disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {busy ? 'Sending…' : 'Send test email'}
        </button>
      </div>
      {result && (
        <div
          role="status"
          className={`mt-3 text-sm rounded-md px-3 py-2 ${result.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}
        >
          {result.message}
          {result.missing.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.missing.map((m) => (
                <li key={m}>Missing: {m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
