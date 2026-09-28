/**
 * mailer — Resend delivery, email audit log, rate limiting and the shared
 * context (brand, payment info) every email needs.
 *
 * Configuration (see docs/email-system.md):
 *   firebase functions:secrets:set RESEND_API_KEY
 *   EMAIL_FROM  = "Bakery Name <orders@your-verified-domain.com>"
 *   APP_URL     = "https://your-portal-domain.com"
 *
 * When RESEND_API_KEY or EMAIL_FROM is missing, sends are skipped (logged
 * as `skipped` in /emailLog) instead of failing the caller — the app keeps
 * working in dev/staging without email configured.
 */
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { emailBrandFrom, type EmailBrand } from "./emailLayout";
import { paymentInfoFrom, type PaymentInfo } from "./emailContent";

export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
export const EMAIL_FROM = defineString("EMAIL_FROM", {
  default: "",
  description: 'Sender, e.g. "Your Bakery <orders@yourdomain.com>" — domain must be verified in Resend.',
});
export const APP_URL = defineString("APP_URL", {
  default: "",
  description: "Public https URL of the customer portal, used for links in emails.",
});

const db = () => getFirestore();

// ── Context ─────────────────────────────────────────────────────────────────

export interface EmailContext {
  brand: EmailBrand;
  pay: PaymentInfo;
  settings: Record<string, unknown>;
}

export async function loadEmailContext(): Promise<EmailContext> {
  let settings: Record<string, unknown> = {};
  try {
    settings = (await db().doc("settings/general").get()).data() ?? {};
  } catch (err) {
    console.warn("[mailer] settings read failed, using defaults:", err);
  }
  return {
    brand: emailBrandFrom(settings, APP_URL.value()),
    pay: paymentInfoFrom(settings),
    settings,
  };
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const isEmail = (v: unknown): v is string => typeof v === "string" && EMAIL_RE.test(v.trim());

/** Optional store copy (Admin → Settings → "Order CC Email"). */
export function orderBcc(settings: Record<string, unknown>): string | undefined {
  const v = settings.orderCcEmail;
  return isEmail(v) ? v.trim() : undefined;
}

/**
 * Customer email for an order: order.customerEmail → customers/{id}.email →
 * Firebase Auth. Returns "" when none can be found.
 */
export async function resolveCustomerEmail(order: Record<string, unknown>): Promise<string> {
  if (isEmail(order.customerEmail)) return (order.customerEmail as string).trim().toLowerCase();
  const customerId = typeof order.customerId === "string" ? order.customerId : "";
  if (!customerId) return "";
  try {
    const snap = await db().doc(`customers/${customerId}`).get();
    const e = snap.data()?.email;
    if (isEmail(e)) return e.trim().toLowerCase();
  } catch (err) {
    console.warn(`[mailer] customer lookup failed for ${customerId}:`, err);
  }
  try {
    const u = await getAuth().getUser(customerId);
    if (isEmail(u.email)) return u.email!.toLowerCase();
  } catch {
    /* deleted user — nothing to send to */
  }
  return "";
}

// ── Delivery ────────────────────────────────────────────────────────────────

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  bcc?: string;
  /** Resend de-duplicates retries with the same key for 24h. */
  idempotencyKey?: string;
  /** Resend tag, e.g. "order_status". Letters, digits, _ and - only. */
  category: string;
}

export type SendResult =
  | { state: "sent"; providerId: string }
  | { state: "skipped"; reason: string }
  | { state: "failed"; reason: string };

export function emailConfigStatus(): { apiKey: boolean; from: boolean; appUrl: boolean } {
  let apiKey = false;
  try {
    apiKey = !!RESEND_API_KEY.value();
  } catch {
    apiKey = false;
  }
  return { apiKey, from: !!EMAIL_FROM.value().trim(), appUrl: !!APP_URL.value().trim() };
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const cfg = emailConfigStatus();
  if (!cfg.apiKey) {
    console.warn(`[mailer] RESEND_API_KEY not set — skipped "${input.subject}"`);
    return { state: "skipped", reason: "RESEND_API_KEY is not configured" };
  }
  if (!cfg.from) {
    console.warn(`[mailer] EMAIL_FROM not set — skipped "${input.subject}"`);
    return { state: "skipped", reason: "EMAIL_FROM is not configured" };
  }
  if (!isEmail(input.to)) return { state: "failed", reason: "Invalid recipient address" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${RESEND_API_KEY.value()}`,
    "Content-Type": "application/json",
  };
  if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey.slice(0, 256);

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: EMAIL_FROM.value().trim(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo && isEmail(input.replyTo) ? { reply_to: input.replyTo } : {}),
        ...(input.bcc && input.bcc.toLowerCase() !== input.to.toLowerCase() ? { bcc: [input.bcc] } : {}),
        tags: [{ name: "category", value: input.category.replace(/[^A-Za-z0-9_-]/g, "_") }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[mailer] network error calling Resend:", err);
    return { state: "failed", reason: `Network error: ${(err as Error).message}` };
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    console.error(`[mailer] Resend ${res.status}: ${body}`);
    return { state: "failed", reason: `Resend ${res.status}: ${body}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  console.log(`[mailer] ✓ "${input.subject}" → ${input.to}`);
  return { state: "sent", providerId: data.id ?? "" };
}

// ── Audit log (/emailLog) ───────────────────────────────────────────────────

export interface EmailLogMeta {
  kind: "order_status" | "payment_reminder" | "order_updated" | "password_reset" | "test";
  to: string;
  subject: string;
  orderId?: string;
  status?: string;
  triggeredBy?: string;
}

/**
 * Send once per logical email. The log doc id is the idempotency key: the
 * first caller reserves it as `pending`; retries of the same event see
 * `sent` and skip. Failed/skipped sends may be retried.
 */
export async function sendLoggedOnce(logId: string, meta: EmailLogMeta, input: SendInput): Promise<SendResult> {
  const ref = db().collection("emailLog").doc(logId);
  let alreadySent = false;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.state === "sent") {
      alreadySent = true;
      return;
    }
    tx.set(
      ref,
      {
        ...meta,
        state: "pending",
        attempts: FieldValue.increment(1),
        createdAt: snap.exists ? snap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  if (alreadySent) return { state: "skipped", reason: "Already sent" };

  const result = await sendEmail({ ...input, idempotencyKey: input.idempotencyKey ?? logId });
  await ref
    .set(
      {
        state: result.state,
        providerId: result.state === "sent" ? result.providerId : null,
        error: result.state === "sent" ? null : result.reason,
        sentAt: result.state === "sent" ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .catch((err) => console.error("[mailer] emailLog update failed:", logId, err));
  return result;
}

// ── Rate limiting (/emailQuota) ─────────────────────────────────────────────

/**
 * Sliding-window limiter. Returns false when `key` already has `max` sends
 * inside `windowMs`. Transaction-wrapped so concurrent calls can't race past it.
 */
export async function allowSend(key: string, windowMs: number, max: number): Promise<boolean> {
  const ref = db().collection("emailQuota").doc(key.replace(/[/]/g, "_").slice(0, 500));
  const now = Date.now();
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recent = ((snap.data()?.timestamps as number[] | undefined) ?? []).filter(
      (t) => typeof t === "number" && t > now - windowMs
    );
    if (recent.length >= max) return false;
    tx.set(ref, { timestamps: [...recent, now].slice(-max), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
