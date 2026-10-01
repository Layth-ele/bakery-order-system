/**
 * emailLayout — the ONE bakery email design.
 *
 * Every customer email (order status, payment reminder, order updated,
 * password reset, admin test email) is rendered through renderEmail() and
 * the block helpers below, so they all look like one family:
 *
 *   ┌──────────────────────────────┐
 *   │  brown header · logo / name  │  business name + address (from Settings)
 *   ├──────────────────────────────┤
 *   │        EYEBROW (tan)         │
 *   │          Headline            │
 *   │            ───               │
 *   │   paragraphs · boxes · CTA   │
 *   ├──────────────────────────────┤
 *   │  footer: name · contact      │
 *   └──────────────────────────────┘
 *
 * Email-client safe: table layout, inline styles, 600px card that shrinks
 * on phones, bulletproof (table) buttons, light-only colour scheme.
 *
 * Pure (no Firebase imports) so it can be previewed and unit-tested directly.
 * Branding comes ONLY from the bakery's own settings/general document —
 * nothing here is hard-coded to a real business.
 */

// ── Brand ───────────────────────────────────────────────────────────────────

export interface EmailBrand {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Customer portal URL (APP_URL param). Empty string when not configured. */
  website: string;
  /** Optional https logo for the header. Empty → the name is shown instead. */
  logoUrl: string;
  /** GST / business number shown in the footer when set. */
  businessNumber: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const httpsOnly = (v: unknown): string => (/^https:\/\//i.test(str(v)) ? str(v) : "");

/** Placeholder shown when the admin has not configured a business name yet. */
export const DEFAULT_BRAND_NAME = "Your Bakery";

/**
 * Brand from the raw settings/general document (Admin → System Settings)
 * plus the deploy-time portal URL.
 */
export function emailBrandFrom(
  settings: Record<string, unknown> | null | undefined,
  appUrl = ""
): EmailBrand {
  const s = settings ?? {};
  // businessLocation is free text and may span several lines — the header
  // and footer only have room for one.
  const address = (str(s.businessAddress) || str(s.businessLocation)).split("\n")[0].trim();
  return {
    name: str(s.businessName) || DEFAULT_BRAND_NAME,
    address,
    phone: str(s.businessPhone),
    email: str(s.orderEmail) || str(s.businessEmail),
    website: httpsOnly(appUrl).replace(/\/+$/, ""),
    // Email-specific logo if set, else the business logo uploaded in Settings.
    logoUrl: httpsOnly(s.emailLogoUrl) || httpsOnly(s.logoUrl),
    businessNumber: str(s.businessNumber),
  };
}

// ── Escaping ────────────────────────────────────────────────────────────────

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only http(s)/mailto/tel URLs reach href/src attributes. */
export const safeUrl = (v: unknown): string =>
  /^(https?:\/\/|mailto:|tel:)/i.test(String(v ?? "")) ? esc(v) : "";

/** Format a number as $1,234.56. Non-finite values render as $0.00. */
export const money = (n: unknown): string => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v).toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "-" : ""}$${abs}`;
};

// ── Tokens ──────────────────────────────────────────────────────────────────

const C = {
  page: "#f5efe6",
  card: "#ffffff",
  header: "#5c4330",
  header2: "#8b6f47",
  cream: "#fbf6ee",
  accent: "#c08f5a",
  accentSoft: "#e2c4a0",
  ink: "#2e2319",
  text: "#4b4036",
  muted: "#857869",
  line: "#ece2d3",
  panel: "#faf6f0",
  ok: "#2f7a4a",
  warn: "#a8521c",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

// ── Blocks (return trusted HTML; callers esc() any user data) ───────────────

/** Centred paragraph. */
export const p = (html: string, opts: { small?: boolean } = {}): string =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:${opts.small ? 13 : 15}px;line-height:1.7;color:${opts.small ? C.muted : C.text};text-align:center;">${html}</p>`;

/** Bold inline text in the ink colour. */
export const strong = (html: string): string => `<strong style="color:${C.ink};">${html}</strong>`;

/** Inline monospace chip — order numbers, invoice numbers. */
export const code = (txt: string): string =>
  `<span style="background:${C.panel};border:1px solid ${C.line};padding:2px 8px;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:13px;color:${C.ink};white-space:nowrap;">${esc(txt)}</span>`;

/** Centred call-to-action button (table-based so it renders in Outlook). */
export const button = (label: string, href: string): string =>
  safeUrl(href)
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 8px;">
  <tr><td align="center" bgcolor="${C.header}" style="border-radius:8px;">
    <a href="${safeUrl(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.cream};text-decoration:none;border-radius:8px;">${esc(label)}</a>
  </td></tr>
</table>`
    : "";

/** Small centred eyebrow label used inside boxes and sections. */
const label = (txt: string, mt = 0): string =>
  `<p style="margin:${mt}px 0 12px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent};text-align:center;">${esc(txt)}</p>`;

/** Panel with a heading and key → value rows (value is trusted HTML). */
export const infoBox = (title: string, rows: Array<[string, string]>): string => {
  const visible = rows.filter(([, v]) => v !== "");
  if (!visible.length) return "";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background:${C.panel};border:1px solid ${C.line};border-radius:10px;">
  <tr><td style="padding:18px 22px 10px;">
    ${label(title)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${visible
        .map(
          ([k, v]) => `<tr>
        <td style="padding:6px 0;font-family:${SANS};font-size:13px;color:${C.muted};text-align:left;vertical-align:top;">${esc(k)}</td>
        <td style="padding:6px 0 6px 12px;font-family:${SANS};font-size:13px;color:${C.ink};text-align:right;vertical-align:top;font-weight:600;">${v}</td>
      </tr>`
        )
        .join("")}
    </table>
  </td></tr>
</table>`;
};

/** Coloured call-out (e.g. "Amount due", "Reason"). Body is trusted HTML. */
export const callout = (
  title: string,
  html: string,
  tone: "accent" | "warn" | "ok" = "accent"
): string => {
  const color = tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.accent;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;border-left:3px solid ${color};background:${C.panel};border-radius:0 10px 10px 0;">
  <tr><td style="padding:16px 20px;text-align:left;">
    <p style="margin:0 0 6px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${color};">${esc(title)}</p>
    <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.text};">${html}</p>
  </td></tr>
</table>`;
};

export interface EmailLineItem {
  name: string;
  quantity: number;
  price: number;
  /** Optional small print under the name (e.g. per-day breakdown). */
  detail?: string;
}

/** Itemised order lines. */
export function itemsTable(items: EmailLineItem[], title = "Your order"): string {
  if (!items.length) return "";
  const rows = items
    .map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const detail = it.detail
        ? `<br/><span style="font-size:11px;color:${C.muted};">${esc(it.detail)}</span>`
        : "";
      return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:14px;color:${C.ink};text-align:left;">${esc(it.name)}<br/><span style="font-size:12px;color:${C.muted};">${esc(qty)} × ${money(price)}</span>${detail}</td>
    <td style="padding:12px 0 12px 12px;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};text-align:right;vertical-align:top;white-space:nowrap;">${money(qty * price)}</td>
  </tr>`;
    })
    .join("");
  return `${label(title, 18)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line};">${rows}</table>`;
}

/** Totals: [label, amount text, variant] — 'total' is the bold last line. */
export function totalsTable(rows: Array<[string, string, ("credit" | "total")?]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;">${rows
    .map(([k, v, kind]) => {
      const color = kind === "credit" ? C.ok : kind === "total" ? C.ink : C.text;
      const weight =
        kind === "total"
          ? `font-weight:700;font-size:15px;padding-top:12px;border-top:1px solid ${C.line};`
          : "font-size:13px;";
      return `<tr><td style="padding:5px 0;font-family:${SANS};color:${color};text-align:left;${weight}">${esc(k)}</td><td style="padding:5px 0;font-family:${SANS};color:${color};text-align:right;${weight}">${esc(v)}</td></tr>`;
    })
    .join("")}</table>`;
}

/** Secondary section with a small heading — security notes, "why you got this". */
export const note = (title: string, html: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid ${C.line};"><tr><td style="padding-top:22px;">${label(title)}${p(html, { small: true })}</td></tr></table>`;

/** "Or paste this link" fallback under a button. */
export const linkFallback = (href: string): string =>
  safeUrl(href)
    ? `<p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">Button not working? Paste this link into your browser:<br/><a href="${safeUrl(href)}" style="color:${C.ink};word-break:break-all;">${esc(href)}</a></p>`
    : "";

// ── Page ────────────────────────────────────────────────────────────────────

export interface RenderEmailInput {
  brand: EmailBrand;
  /** Inbox preview line (hidden in the body). */
  preheader: string;
  eyebrow: string;
  /** Plain text — escaped here. */
  title: string;
  /** Trusted HTML blocks built with the helpers above. */
  body: string[];
  /** Small print above the footer (plain text). */
  footnote?: string;
}

export function renderEmail(i: RenderEmailInput): string {
  const b = i.brand;
  const tel = b.phone.replace(/[^\d+]/g, "");
  const site = b.website.replace(/^https?:\/\//, "");
  const contact = [
    tel ? `<a href="tel:${esc(tel)}" style="color:${C.muted};text-decoration:none;">${esc(b.phone)}</a>` : "",
    b.email ? `<a href="mailto:${esc(b.email)}" style="color:${C.muted};text-decoration:none;">${esc(b.email)}</a>` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  const logo = safeUrl(b.logoUrl)
    ? `<img src="${safeUrl(b.logoUrl)}" alt="${esc(b.name)}" width="72" style="display:block;width:72px;max-width:72px;height:auto;margin:0 auto 14px;border:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${esc(i.title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .bk-card { width: 100% !important; border-radius: 0 !important; }
    .bk-pad  { padding-left: 24px !important; padding-right: 24px !important; }
    .bk-h1   { font-size: 24px !important; }
  }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${esc(i.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" class="bk-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.card};border-radius:14px;overflow:hidden;box-shadow:0 2px 24px rgba(46,35,25,0.08);">
      <tr><td align="center" bgcolor="${C.header}" style="background:${C.header};background-image:linear-gradient(135deg,${C.header} 0%,${C.header2} 100%);padding:32px 24px 26px;text-align:center;">
        ${logo}
        <p style="margin:0;font-family:${SERIF};font-size:26px;font-weight:400;letter-spacing:0.03em;color:${C.cream};line-height:1.2;">${esc(b.name)}</p>
        ${b.address ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;line-height:1.6;color:${C.accentSoft};">${esc(b.address)}</p>` : ""}
      </td></tr>
      <tr><td class="bk-pad" align="center" style="padding:40px 48px 36px;text-align:center;">
        <p style="margin:0 0 12px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${C.accent};text-align:center;">${esc(i.eyebrow)}</p>
        <h1 class="bk-h1" style="margin:0;font-family:${SERIF};font-size:28px;font-weight:400;letter-spacing:-0.01em;line-height:1.25;color:${C.ink};text-align:center;">${esc(i.title)}</h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 24px;"><tr><td width="44" height="2" bgcolor="${C.accent}" style="width:44px;height:2px;line-height:2px;font-size:2px;background:${C.accent};">&nbsp;</td></tr></table>
        ${i.body.filter(Boolean).join("\n")}
      </td></tr>
      <tr><td class="bk-pad" align="center" style="padding:26px 48px 30px;background:${C.panel};border-top:1px solid ${C.line};text-align:center;">
        <p style="margin:0 0 6px;font-family:${SERIF};font-size:17px;color:${C.ink};">${esc(b.name)}</p>
        ${b.address ? `<p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${esc(b.address)}</p>` : ""}
        ${contact ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${contact}</p>` : ""}
        ${site ? `<p style="margin:0;font-family:${SANS};font-size:12px;"><a href="${safeUrl(b.website)}" style="color:${C.accent};text-decoration:none;font-weight:600;">${esc(site)}</a></p>` : ""}
        ${b.businessNumber ? `<p style="margin:10px 0 0;font-family:${SANS};font-size:11px;color:${C.muted};">GST/BN ${esc(b.businessNumber)}</p>` : ""}
        ${i.footnote ? `<p style="margin:14px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:${C.muted};">${esc(i.footnote)}</p>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Plain-text alternative. Sent alongside the HTML so spam filters and
 * text-only clients get a readable version.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, txt: string) => {
      const t = txt.replace(/<[^>]+>/g, "").trim();
      return href.startsWith("http") && !t.includes(href) ? `${t} (${href})` : t;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|h1|table)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
