/**
 * Email service — thin client for the email Cloud Functions
 * (src/functions/src/emails.ts), which render the branded templates and
 * deliver through Resend. Nothing is rendered or sent from the browser.
 *
 * Automatic order-status emails (placed / approved / rejected / cancelled /
 * paid / delivered) need no client call — a Firestore trigger sends them.
 *
 * Setup and troubleshooting: docs/email-system.md
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/config';

export type EmailSendState = 'sent' | 'skipped' | 'failed';

export interface EmailSendResult {
  state: EmailSendState;
  /** Recipient address the server resolved. */
  to: string;
  /** Why the email was skipped or failed (e.g. "RESEND_API_KEY is not configured"). */
  reason?: string;
}

export interface TestEmailResult extends EmailSendResult {
  config: { apiKey: boolean; from: boolean; appUrl: boolean };
}

function call<I, O>(name: string, data: I): Promise<O> {
  return httpsCallable<I, O>(getFunctions(app), name)(data).then((r) => r.data);
}

/** Human-readable explanation for a result that wasn't delivered. */
export function describeEmailResult(r: EmailSendResult): string {
  if (r.state === 'sent') return `Email sent to ${r.to}`;
  if (r.state === 'skipped') {
    return r.reason?.includes('not configured')
      ? 'Email is not set up yet (see docs/email-system.md) — nothing was sent.'
      : `Email not sent: ${r.reason ?? 'skipped'}`;
  }
  return `Email delivery failed: ${r.reason ?? 'unknown error'}`;
}

/** Admin: email a payment reminder for an unpaid order. */
export function sendPaymentReminderEmail(orderId: string, reminderNumber: number): Promise<EmailSendResult> {
  return call('sendPaymentReminderEmail', { orderId, reminderNumber });
}

/** Admin: tell the customer their order was changed. */
export function sendOrderUpdatedEmail(orderId: string): Promise<EmailSendResult> {
  return call('sendOrderUpdatedEmail', { orderId });
}

/** Admin: send a test email (defaults to the admin's own address). */
export function sendTestEmail(to?: string): Promise<TestEmailResult> {
  return call('sendTestEmail', to ? { to } : {});
}

/**
 * Public: branded password-reset email. Resolves "unavailable" when the
 * server has no email provider configured (caller falls back to Firebase).
 */
export function requestPasswordResetEmail(email: string): Promise<{ status: 'ok' | 'unavailable' }> {
  return call('sendPasswordResetEmail', { email });
}
