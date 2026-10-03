/**
 * emailContent — subject + HTML + text for every customer email, rendered
 * with the shared layout in ./emailLayout.
 *
 * Pure: no Firebase. The Cloud Functions in ../emails.ts load the order,
 * customer and settings, then call these builders.
 */
import {
  renderEmail,
  htmlToText,
  p,
  strong,
  code,
  button,
  infoBox,
  callout,
  itemsTable,
  totalsTable,
  note,
  linkFallback,
  esc,
  money,
  type EmailBrand,
  type EmailLineItem,
} from "./emailLayout";
import { discountOn } from "./orderRevision";

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

function built(subject: string, html: string): BuiltEmail {
  return { subject, html, text: htmlToText(html) };
}

// ── Order normalisation ─────────────────────────────────────────────────────

const DAYS = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
] as const;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The order fields the emails use, read defensively from a raw Firestore doc. */
export interface EmailOrder {
  id: string;
  number: string;
  storeName: string;
  contactName: string;
  week: string;
  weekRange: string;
  deliveryAddress: string;
  note: string;
  items: EmailLineItem[];
  subtotal: number;
  discount: number;
  gst: number;
  deliveryFee: number;
  serviceCharge: number;
  serviceChargeWaived: boolean;
  creditApplied: number;
  /** Cancellation fees kept by the bakery on this order. */
  cancellationFee: number;
  /** Store credit issued when the order was cancelled. */
  creditAmount: number;
  paid: boolean;
  /** Paid in full with store credit (nothing was sent). */
  paidWithCredit: boolean;
  total: number;
  amountDue: number;
  invoiceNumber: string;
  rejectionReason: string;
  cancellationReason: string;
}

/** Same rule as the client's displayOrderNumber(): readable IDs contain a hyphen. */
function orderNumberOf(raw: Record<string, unknown>, id: string): string {
  const readable = (v: unknown) => {
    const s = str(v);
    return s && s.includes("-") ? s : "";
  };
  return (
    readable(raw.orderNumber) ||
    readable(raw.invoiceNumber) ||
    (id ? `ORD-···${id.slice(-6).toUpperCase()}` : "N/A")
  );
}

export function normalizeOrder(raw: Record<string, unknown>, id: string): EmailOrder {
  const items = (Array.isArray(raw.items) ? raw.items : []).map((it: any): EmailLineItem => {
    const days = DAYS.filter(([k]) => num(it?.[k]) > 0).map(([k, short]) => `${short} ${num(it[k])}`);
    const dayTotal = DAYS.reduce((sum, [k]) => sum + num(it?.[k]), 0);
    return {
      name: str(it?.productName) || "Item",
      quantity: num(it?.total) || num(it?.quantity) || dayTotal,
      price: num(it?.price),
      detail: days.length ? days.join(" · ") : undefined,
    };
  });

  const subtotal = num(raw.subtotal);
  const discount = discountOn(subtotal, raw); // flat + percentage, as charged
  const total = num(raw.total);
  const creditApplied = num(raw.creditApplied);

  return {
    id,
    number: orderNumberOf(raw, id),
    storeName: str(raw.customerName) || str(raw.storeName),
    contactName: str(raw.customerContactPerson) || str(raw.contactPerson),
    week: str(raw.week),
    weekRange: str(raw.weekRange),
    deliveryAddress: str(raw.customerAddress),
    note: str(raw.note),
    items,
    subtotal,
    discount,
    gst: num(raw.gst),
    deliveryFee: num(raw.deliveryFee),
    serviceCharge: num(raw.serviceCharge),
    serviceChargeWaived: raw.serviceChargeWaived === true,
    creditApplied,
    cancellationFee: num(raw.cancellationFee),
    creditAmount: num(raw.creditAmount),
    paid: raw.paymentReceived === true,
    paidWithCredit: raw.paymentMethod === "credit",
    total,
    amountDue: typeof raw.amountDue === "number" ? num(raw.amountDue) : Math.max(0, Math.round((total - creditApplied) * 100) / 100),
    invoiceNumber: str(raw.invoiceNumber),
    rejectionReason: str(raw.rejectionReason),
    cancellationReason: str(raw.cancellationReason),
  };
}

// ── Shared pieces ───────────────────────────────────────────────────────────

/** How customers pay — from Admin → System Settings → Payment methods. */
export interface PaymentInfo {
  methods: string[];
  address: string;
}

export function paymentInfoFrom(settings: Record<string, unknown> | null | undefined): PaymentInfo {
  const s = settings ?? {};
  return {
    methods: [str(s.paymentMethod1), str(s.paymentMethod2)].filter(Boolean),
    address: str(s.paymentAddress),
  };
}

const greeting = (o: EmailOrder): string => {
  const first = (o.contactName || "").split(" ")[0];
  return first ? `Hi ${esc(first)},` : o.storeName ? `Hi ${esc(o.storeName)} team,` : "Hello,";
};

function orderSummaryBox(o: EmailOrder): string {
  return infoBox("Order details", [
    ["Order", code(o.number)],
    ["Store", esc(o.storeName)],
    ["Week", esc([o.week, o.weekRange && `(${o.weekRange})`].filter(Boolean).join(" "))],
    ["Deliver to", esc(o.deliveryAddress)],
    ["Invoice", o.invoiceNumber && o.invoiceNumber !== o.number ? code(o.invoiceNumber) : ""],
  ]);
}

function totals(o: EmailOrder, opts: { final: boolean }): string {
  const rows: Array<[string, string, ("credit" | "total")?]> = [["Subtotal", money(o.subtotal)]];
  if (o.discount > 0) rows.push(["Discount", `-${money(o.discount)}`, "credit"]);
  if (o.deliveryFee > 0) rows.push(["Delivery", money(o.deliveryFee)]);
  if (o.serviceCharge > 0)
    rows.push(["Service charge", o.serviceChargeWaived ? "Waived" : money(o.serviceCharge)]);
  if (o.cancellationFee > 0) rows.push(["Cancellation fee", money(o.cancellationFee)]);
  if (o.gst > 0) rows.push(["GST", money(o.gst)]);
  rows.push([opts.final ? "Total" : "Estimated total", money(o.total), "total"]);
  // Store credit comes off the total; the total itself doesn't include it.
  if (o.creditApplied > 0) {
    rows.push(["Store credit applied", `-${money(o.creditApplied)}`, "credit"]);
    rows.push(["Amount due", money(o.amountDue), "total"]);
  }
  return totalsTable(rows);
}

function paymentBlock(pay: PaymentInfo, brand: EmailBrand): string {
  if (!pay.methods.length && !pay.address) return "";
  const lines = [
    ...pay.methods.map((m) => `• ${esc(m)}`),
    pay.address ? `Mail / drop-off: ${esc(pay.address)}` : "",
  ].filter(Boolean);
  return callout("How to pay", lines.join("<br/>") + (brand.email ? `<br/>Questions: ${esc(brand.email)}` : ""));
}

const ordersUrl = (brand: EmailBrand) => (brand.website ? `${brand.website}/customer` : "");

function page(
  brand: EmailBrand,
  o: { preheader: string; eyebrow: string; title: string; body: string[]; footnote?: string }
): string {
  return renderEmail({
    brand,
    ...o,
    footnote: o.footnote ?? "Questions about your order? Just reply to this email.",
  });
}

// ── Order status emails ─────────────────────────────────────────────────────

/** Statuses that trigger an automatic customer email. */
export const EMAILED_STATUSES = ["pending", "approved", "rejected", "cancelled", "in_process", "completed"] as const;
export type EmailedStatus = (typeof EMAILED_STATUSES)[number];

export function isEmailedStatus(s: unknown): s is EmailedStatus {
  return typeof s === "string" && (EMAILED_STATUSES as readonly string[]).includes(s);
}

export function buildOrderStatusEmail(
  status: EmailedStatus,
  o: EmailOrder,
  brand: EmailBrand,
  pay: PaymentInfo
): BuiltEmail {
  const cta = button("View your orders", ordersUrl(brand));
  const ref = `Order ${o.number}`;

  switch (status) {
    case "pending":
      return built(
        `We received your order ${o.number} · ${brand.name}`,
        page(brand, {
          preheader: `Thanks — ${ref} is in and waiting for review.`,
          eyebrow: "Order received",
          title: "Thanks for your order",
          body: [
            p(greeting(o)),
            p(`We've received ${strong(esc(ref))}. Our team will review it and confirm shortly — you'll get another email as soon as it's approved.`),
            orderSummaryBox(o),
            itemsTable(o.items),
            totals(o, { final: false }),
            o.note ? callout("Your note", esc(o.note)) : "",
            p("Final pricing, including delivery, is confirmed when the order is approved.", { small: true }),
            cta,
          ],
        })
      );

    case "approved":
      return built(
        `Order ${o.number} approved — ${money(o.amountDue)} due · ${brand.name}`,
        page(brand, {
          preheader: `${ref} is confirmed. Amount due: ${money(o.amountDue)}.`,
          eyebrow: "Order approved",
          title: "Your order is confirmed",
          body: [
            p(greeting(o)),
            p(`Good news — ${strong(esc(ref))} has been approved. Here's your final breakdown.`),
            orderSummaryBox(o),
            itemsTable(o.items),
            totals(o, { final: true }),
            callout("Amount due", strong(money(o.amountDue))),
            paymentBlock(pay, brand),
            cta,
          ],
        })
      );

    case "rejected":
      return built(
        `Update on your order ${o.number} · ${brand.name}`,
        page(brand, {
          preheader: `We weren't able to accept ${ref}.`,
          eyebrow: "Order not accepted",
          title: "We couldn't accept this order",
          body: [
            p(greeting(o)),
            p(`Unfortunately we weren't able to accept ${strong(esc(ref))}.`),
            o.rejectionReason ? callout("Reason", esc(o.rejectionReason), "warn") : "",
            orderSummaryBox(o),
            p("You haven't been charged. If you have questions or want to place a revised order, just reply to this email."),
            cta,
          ],
        })
      );

    case "cancelled":
      return built(
        `Order ${o.number} cancelled · ${brand.name}`,
        page(brand, {
          preheader: `${ref} has been cancelled.`,
          eyebrow: "Order cancelled",
          title: "Your order was cancelled",
          body: [
            p(greeting(o)),
            p(`${strong(esc(ref))} has been cancelled.`),
            o.cancellationReason ? callout("Reason", esc(o.cancellationReason), "warn") : "",
            orderSummaryBox(o),
            o.paid && o.creditAmount > 0
              ? callout(
                  "Store credit issued",
                  `${strong(money(o.creditAmount))} was added to your account as store credit${o.cancellationFee > 0 ? ` (a ${money(o.cancellationFee)} cancellation fee was kept)` : ""}. You can use it on your next order.`,
                  "ok"
                )
              : "",
            p("If this wasn't expected, please reply to this email."),
            cta,
          ],
        })
      );

    case "in_process":
      return built(
        `Payment received — order ${o.number} is in production · ${brand.name}`,
        page(brand, {
          preheader: `Thanks for your payment. ${ref} is now being prepared.`,
          eyebrow: "Payment received",
          title: "We're baking your order",
          body: [
            p(greeting(o)),
            p(
              o.paidWithCredit
                ? `${strong(esc(ref))} was approved and paid in full with your store credit — nothing to pay. It's now in production.`
                : `Thank you — we've confirmed payment for ${strong(esc(ref))} and it's now in production.`
            ),
            orderSummaryBox(o),
            totals(o, { final: true }),
            callout("Status", "Paid · In production", "ok"),
            cta,
          ],
        })
      );

    case "completed":
      return built(
        `Order ${o.number} complete — invoice ready · ${brand.name}`,
        page(brand, {
          preheader: `${ref} is complete. Your final invoice is ready.`,
          eyebrow: "Order complete",
          title: "Your order is complete",
          body: [
            p(greeting(o)),
            p(`${strong(esc(ref))} is complete and your final invoice is ready to view in your account.`),
            orderSummaryBox(o),
            totals(o, { final: true }),
            p("If anything was missing or not right, reply to this email and we'll make it right."),
            button("View your invoice", ordersUrl(brand)),
          ],
          footnote: "Thank you for your business.",
        })
      );
  }
}

// ── Payment reminder ────────────────────────────────────────────────────────

export function buildPaymentReminderEmail(
  o: EmailOrder,
  reminderNumber: number,
  brand: EmailBrand,
  pay: PaymentInfo
): BuiltEmail {
  const nth = Math.max(1, Math.floor(reminderNumber));
  return built(
    `Payment reminder${nth > 1 ? ` #${nth}` : ""}: order ${o.number} — ${money(o.amountDue)} due · ${brand.name}`,
    page(brand, {
      preheader: `A friendly reminder that ${money(o.amountDue)} is due for order ${o.number}.`,
      eyebrow: nth > 1 ? `Payment reminder #${nth}` : "Payment reminder",
      title: "Friendly payment reminder",
      body: [
        p(greeting(o)),
        p(`Our records show that payment for ${strong(esc(`Order ${o.number}`))} is still outstanding.`),
        callout("Amount due", strong(money(o.amountDue)), nth > 2 ? "warn" : "accent"),
        orderSummaryBox(o),
        totals(o, { final: true }),
        paymentBlock(pay, brand),
        p("Already paid? Thank you — please disregard this reminder, or reply with your payment reference so we can match it.", { small: true }),
        button("View your orders", ordersUrl(brand)),
      ],
    })
  );
}

// ── Order updated by the bakery ─────────────────────────────────────────────

export function buildOrderUpdatedEmail(o: EmailOrder, brand: EmailBrand): BuiltEmail {
  return built(
    `Your order ${o.number} has been updated · ${brand.name}`,
    page(brand, {
      preheader: `We made changes to order ${o.number}. New total: ${money(o.total)}.`,
      eyebrow: "Order updated",
      title: "We've updated your order",
      body: [
        p(greeting(o)),
        p(`Our team has made changes to ${strong(esc(`Order ${o.number}`))}. Please review the updated items and total below.`),
        orderSummaryBox(o),
        itemsTable(o.items, "Updated order"),
        totals(o, { final: true }),
        o.note ? callout("Note", esc(o.note)) : "",
        p("If anything doesn't look right, reply to this email before your delivery day."),
        button("Review your order", ordersUrl(brand)),
      ],
    })
  );
}

// ── Password reset ──────────────────────────────────────────────────────────

export function buildPasswordResetEmail(link: string, email: string, brand: EmailBrand): BuiltEmail {
  return built(
    `Reset your password · ${brand.name}`,
    renderEmail({
      brand,
      preheader: "Use this link to choose a new password. It expires in 1 hour.",
      eyebrow: "Account security",
      title: "Reset your password",
      body: [
        p(`We received a request to reset the password for ${strong(esc(email))}.`),
        p("Tap the button below to choose a new password. For your security, the link expires in 1 hour and can only be used once."),
        button("Reset password", link),
        linkFallback(link),
        note("Didn't ask for this?", "You can safely ignore this email — your password won't change unless you open the link above."),
      ],
      footnote: `This is an automated account email from ${brand.name}.`,
    })
  );
}

// ── Admin test email ────────────────────────────────────────────────────────

export function buildTestEmail(brand: EmailBrand, sentBy: string): BuiltEmail {
  return built(
    `Test email · ${brand.name}`,
    renderEmail({
      brand,
      preheader: "Your email delivery is set up correctly.",
      eyebrow: "Email check",
      title: "Email delivery is working",
      body: [
        p(`This test was sent from Admin → System Settings by ${strong(esc(sentBy))}.`),
        p("If you're reading this, customers will receive order and account emails from this address."),
        infoBox("Branding in use", [
          ["Business name", esc(brand.name)],
          ["Address", esc(brand.address)],
          ["Phone", esc(brand.phone)],
          ["Reply-to", esc(brand.email)],
          ["Portal link", esc(brand.website)],
        ]),
        p("Update these in System Settings → Business information.", { small: true }),
      ],
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account approved (sent by approveCustomer)
// ─────────────────────────────────────────────────────────────────────────────

export function buildAccountApprovedEmail(
  input: { storeName: string; contactPerson: string; email: string },
  brand: EmailBrand
): BuiltEmail {
  const first = (input.contactPerson || "").split(" ")[0];
  const signIn = brand.website || "";
  return built(
    `Your account is approved · ${brand.name}`,
    renderEmail({
      brand,
      preheader: "You can now sign in and place wholesale orders.",
      eyebrow: "Account approved",
      title: "Welcome — your account is ready",
      body: [
        p(first ? `Hi ${esc(first)},` : input.storeName ? `Hi ${esc(input.storeName)} team,` : "Hello,"),
        p(`Your ${esc(brand.name)} wholesale account${input.storeName ? ` for ${strong(esc(input.storeName))}` : ""} has been approved.`),
        p(`Sign in with ${strong(esc(input.email))} and the password you chose when you registered.`),
        ...(signIn ? [button("Sign in and order", signIn), linkFallback(signIn)] : []),
        note("Forgot your password?", "Use “Forgot password” on the sign-in page."),
      ],
    })
  );
}
