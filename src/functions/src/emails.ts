/**
 * Customer email Cloud Functions — delivered through Resend.
 *
 *   sendOrderStatusEmail      Called by the onOrderLifecycle trigger
 *                             (orderLifecycleTrigger.ts): order placed /
 *                             approved / rejected / cancelled / paid
 *                             (in_process) / completed → customer email.
 *                             Once per order + status.
 *   emailPaymentReminder      Sent by sendPaymentReminder (adminActions.ts).
 *   emailOrderUpdated         Sent by editOrder (orderRevisions.ts).
 *   sendPasswordResetEmail    Public callable: branded reset link, rate
 *                             limited, same response whether or not the
 *                             account exists.
 *   sendTestEmail             Admin callable: System Settings → "Send test".
 *
 * Templates: lib/emailLayout.ts (design) + lib/emailContent.ts (copy).
 * Delivery, audit log and rate limits: lib/mailer.ts.
 * Setup and troubleshooting: docs/email-system.md.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { requireAdmin } from "./_shared";
import {
  RESEND_API_KEY,
  APP_URL,
  loadEmailContext,
  resolveCustomerEmail,
  orderBcc,
  sendLoggedOnce,
  allowSend,
  emailConfigStatus,
  isEmail,
  type SendResult,
} from "./lib/mailer";
import {
  normalizeOrder,
  isEmailedStatus,
  buildOrderStatusEmail,
  buildPaymentReminderEmail,
  buildOrderUpdatedEmail,
  buildPasswordResetEmail,
  buildTestEmail,
  buildAccountApprovedEmail,
} from "./lib/emailContent";
import { orderStatusEmailLogId } from "./lib/orderSideEffects";

const db = getFirestore();
export const WITH_EMAIL = { secrets: [RESEND_API_KEY] };

/** What admin callables return to the client. */
export interface EmailCallResult {
  state: SendResult["state"];
  to: string;
  reason?: string;
}

const toCallResult = (to: string, r: SendResult): EmailCallResult =>
  r.state === "sent" ? { state: "sent", to } : { state: r.state, to, reason: r.reason };

// ─────────────────────────────────────────────────────────────────────────────
// Order status emails (automatic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Email the customer about an order status change. Called by the
 * onOrderLifecycle trigger; `status` "pending" means the order was just placed.
 */
export async function sendOrderStatusEmail(
  orderId: string,
  status: string,
  raw: Record<string, unknown>
): Promise<void> {
  if (!isEmailedStatus(status)) return;

  const ctx = await loadEmailContext();
  // Admin → System Settings → "Send order status emails". Missing = on.
  if (ctx.settings.sendOrderStatusEmails === false) {
    console.log(`[sendOrderStatusEmail] disabled in settings — skipped ${status} for ${orderId}`);
    return;
  }

  const to = await resolveCustomerEmail(raw);
  if (!to) {
    console.warn(`[sendOrderStatusEmail] no customer email for order ${orderId}`);
    return;
  }

  const email = buildOrderStatusEmail(status, normalizeOrder(raw, orderId), ctx.brand, ctx.pay);
  await sendLoggedOnce(
    orderStatusEmailLogId(orderId, status),
    { kind: "order_status", to, subject: email.subject, orderId, status, triggeredBy: "system" },
    { to, ...email, replyTo: ctx.brand.email, bcc: orderBcc(ctx.settings), category: `order_${status}` }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment reminder / order updated — sent by the sendPaymentReminder and
// editOrder Cloud Functions (adminActions.ts, orderRevisions.ts) after they
// have committed the change. Never throw: the caller reports the result.
// ─────────────────────────────────────────────────────────────────────────────

export async function emailPaymentReminder(
  orderId: string,
  raw: Record<string, unknown>,
  reminderNumber: number,
  triggeredBy: string
): Promise<EmailCallResult> {
  const to = await resolveCustomerEmail(raw);
  if (!to) return { state: "failed", to: "", reason: "This customer has no email address on file." };
  try {
    const ctx = await loadEmailContext();
    const email = buildPaymentReminderEmail(normalizeOrder(raw, orderId), reminderNumber, ctx.brand, ctx.pay);
    const result = await sendLoggedOnce(
      `reminder_${orderId}_${reminderNumber}`,
      { kind: "payment_reminder", to, subject: email.subject, orderId, triggeredBy },
      { to, ...email, replyTo: ctx.brand.email, bcc: orderBcc(ctx.settings), category: "payment_reminder" }
    );
    return toCallResult(to, result);
  } catch (err) {
    console.error(`[emailPaymentReminder] ${orderId}:`, err);
    return { state: "failed", to, reason: "The email could not be sent." };
  }
}

export async function emailOrderUpdated(
  orderId: string,
  raw: Record<string, unknown>,
  editId: string,
  triggeredBy: string
): Promise<EmailCallResult> {
  const to = await resolveCustomerEmail(raw);
  if (!to) return { state: "failed", to: "", reason: "This customer has no email address on file." };
  try {
    const ctx = await loadEmailContext();
    const email = buildOrderUpdatedEmail(normalizeOrder(raw, orderId), ctx.brand);
    const result = await sendLoggedOnce(
      `updated_${orderId}_${editId}`,
      { kind: "order_updated", to, subject: email.subject, orderId, triggeredBy },
      { to, ...email, replyTo: ctx.brand.email, bcc: orderBcc(ctx.settings), category: "order_updated" }
    );
    return toCallResult(to, result);
  } catch (err) {
    console.error(`[emailOrderUpdated] ${orderId}:`, err);
    return { state: "failed", to, reason: "The email could not be sent." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset (public)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Both "account exists" and "no such account" paths take at least this long,
 * so response timing can't be used to discover which emails are registered.
 */
const RESET_MIN_RESPONSE_MS = 800;

/**
 * Point the link at the app's own /reset-password page (which verifies the
 * oobCode and sets the new password). APP_URL is deploy-time config — never
 * the caller's Origin header, which an attacker could set to their own site
 * to capture a victim's reset code.
 */
function appResetLink(firebaseLink: string): string {
  const base = APP_URL.value().trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) return firebaseLink;
  const code = new URL(firebaseLink).searchParams.get("oobCode");
  return code ? `${base}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(code)}` : firebaseLink;
}

export const sendPasswordResetEmail = onCall<{ email: string }>(
  WITH_EMAIL,
  async (request): Promise<{ status: "ok" | "unavailable" }> => {
    const started = Date.now();
    const email = String(request.data?.email ?? "").trim().toLowerCase();
    if (!isEmail(email) || email.length > 254) {
      throw new HttpsError("invalid-argument", "Please enter a valid email address.");
    }

    // Not configured → tell the client to use Firebase's built-in mailer
    // instead. Answered before any account lookup, so it leaks nothing.
    const cfg = emailConfigStatus();
    if (!cfg.apiKey || !cfg.from) return { status: "unavailable" };

    const pad = async () => {
      const wait = RESET_MIN_RESPONSE_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    };

    const ip = request.rawRequest?.ip || "unknown";
    const [emailOk, ipOk] = await Promise.all([
      allowSend(`pwreset_email_${email}`, 60 * 60_000, 3),
      allowSend(`pwreset_ip_${ip}`, 60 * 60_000, 10),
    ]);
    if (!emailOk || !ipOk) {
      console.warn(`[sendPasswordResetEmail] rate limited (email ok=${emailOk}, ip ok=${ipOk})`);
      await pad();
      return { status: "ok" };
    }

    try {
      const base = APP_URL.value().trim().replace(/\/+$/, "");
      const link = await getAuth().generatePasswordResetLink(
        email,
        /^https:\/\//.test(base) ? { url: `${base}/reset-password`, handleCodeInApp: true } : undefined
      );
      const ctx = await loadEmailContext();
      const built = buildPasswordResetEmail(appResetLink(link), email, ctx.brand);
      await sendLoggedOnce(
        `pwreset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        { kind: "password_reset", to: email, subject: built.subject, triggeredBy: request.auth?.uid ?? "anonymous" },
        { to: email, ...built, replyTo: ctx.brand.email, category: "password_reset" }
      );
    } catch (err: any) {
      // user-not-found / disabled accounts: same response as success.
      if (err?.code !== "auth/user-not-found" && err?.code !== "auth/email-not-found") {
        console.error("[sendPasswordResetEmail] failed:", err?.code ?? err);
      }
    }

    await pad();
    return { status: "ok" };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Test email (admin)
// ─────────────────────────────────────────────────────────────────────────────

export const sendTestEmail = onCall<{ to?: string }>(
  WITH_EMAIL,
  async (request): Promise<EmailCallResult & { config: ReturnType<typeof emailConfigStatus> }> => {
    const admin = await requireAdmin(request);
    const to = String(request.data?.to || admin.email || "").trim().toLowerCase();
    if (!isEmail(to)) throw new HttpsError("invalid-argument", "Enter a valid email address to send the test to.");

    if (!(await allowSend(`test_${admin.uid}`, 10 * 60_000, 5))) {
      throw new HttpsError("resource-exhausted", "Too many test emails. Please wait a few minutes.");
    }

    const ctx = await loadEmailContext();
    const built = buildTestEmail(ctx.brand, admin.email);
    const result = await sendLoggedOnce(
      `test_${Date.now()}`,
      { kind: "test", to, subject: built.subject, triggeredBy: admin.email },
      { to, ...built, replyTo: ctx.brand.email, category: "test" }
    );
    return { ...toCallResult(to, result), config: emailConfigStatus() };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Account approved — sent by approveCustomer (accountAdmin.ts). Never throws.
// ─────────────────────────────────────────────────────────────────────────────

export async function emailAccountApproved(
  uid: string,
  profile: { email: string; storeName: string; contactPerson: string },
  triggeredBy: string
): Promise<EmailCallResult> {
  const to = isEmail(profile.email) ? profile.email.trim() : "";
  if (!to) return { state: "failed", to: "", reason: "This account has no valid email address." };
  try {
    const ctx = await loadEmailContext();
    const email = buildAccountApprovedEmail(profile, ctx.brand);
    const result = await sendLoggedOnce(
      `account_approved_${uid}`,
      { kind: "account_approved", to, subject: email.subject, triggeredBy },
      { to, ...email, replyTo: ctx.brand.email, category: "account_approved" }
    );
    return toCallResult(to, result);
  } catch (err) {
    console.error(`[emailAccountApproved] ${uid}:`, err);
    return { state: "failed", to, reason: "The email could not be sent." };
  }
}
