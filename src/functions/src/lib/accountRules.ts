/**
 * accountRules — the account lifecycle, defined once (no Firebase).
 *
 *   pending ──approve──▶ approved ──suspend──▶ suspended
 *      │                    ▲   ◀──reactivate──┘
 *      └──reject──▶ rejected ┘ (approve undoes a rejection)
 *   any (except admins deleting themselves) ──archive/delete──▶ archived
 *
 * What each status means for sign-in (enforced by disabling the Firebase
 * Auth user, not just by the app):
 *   approved            can sign in and order
 *   pending             can sign in only to see "awaiting approval"
 *   rejected/suspended/archived   Auth disabled — cannot sign in
 *
 * Used by accountAdmin.ts; tested in __tests__/accountRules.test.ts.
 */

export type AccountStatus = "pending" | "approved" | "rejected" | "suspended" | "archived";
export type AccountAction = "approve" | "reject" | "suspend" | "reactivate";

export class AccountRuleError extends Error {
  constructor(public readonly code: "invalid-argument" | "failed-precondition", message: string) {
    super(message);
  }
}

const TRANSITIONS: Record<AccountAction, { from: AccountStatus[]; to: AccountStatus }> = {
  approve: { from: ["pending", "rejected"], to: "approved" },
  reject: { from: ["pending"], to: "rejected" },
  suspend: { from: ["approved"], to: "suspended" },
  reactivate: { from: ["suspended"], to: "approved" },
};

const LABEL: Record<string, string> = {
  pending: "awaiting approval",
  approved: "active",
  rejected: "rejected",
  suspended: "suspended",
  archived: "archived (deleted)",
};

/** The status an action leads to; throws if the account can't take it. */
export function nextStatus(current: unknown, action: AccountAction): AccountStatus {
  const t = TRANSITIONS[action];
  const from = typeof current === "string" ? current : "";
  if (!t.from.includes(from as AccountStatus)) {
    throw new AccountRuleError(
      "failed-precondition",
      `This account is ${LABEL[from] ?? from ?? "in an unknown state"} — it can't be ${action === "reactivate" ? "reactivated" : `${action}d`}.`
    );
  }
  return t.to;
}

/** Whether Firebase Auth sign-in should be enabled for a status. */
export const canSignIn = (status: AccountStatus): boolean => status === "approved" || status === "pending";

// ── Admin "Add account" input ───────────────────────────────────────────────

export interface NewAccountInput {
  email: string;
  password: string;
  storeName: string;
  contactPerson: string;
  phone: string;
  storeAddress: string;
  customerType: "commercial" | "individual" | "admin";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseNewAccount(raw: unknown): NewAccountInput {
  const d = (raw ?? {}) as Record<string, unknown>;
  const bad = (m: string) => new AccountRuleError("invalid-argument", m);
  const customerType =
    d.customerType === "admin" ? "admin" : d.customerType === "individual" ? "individual" : d.customerType === "commercial" ? "commercial" : null;
  if (!customerType) throw bad("Choose an account type.");
  const email = clean(d.email, 200).toLowerCase();
  if (!EMAIL.test(email)) throw bad("Enter a valid email address.");
  const password = typeof d.password === "string" ? d.password : "";
  if (password.length < 8) throw bad("The temporary password must be at least 8 characters.");
  if (password.length > 128) throw bad("The temporary password is too long.");
  const contactPerson = clean(d.contactPerson, 200);
  if (!contactPerson) throw bad(customerType === "admin" ? "Full name is required." : "Contact person is required.");
  const storeName = clean(d.storeName, 200) || (customerType === "individual" ? contactPerson : "");
  if (!storeName) throw bad(customerType === "admin" ? "Admin name is required." : "Business legal name is required.");
  const phone = clean(d.phone, 50);
  const storeAddress = clean(d.storeAddress, 500);
  if (customerType !== "admin") {
    if (!phone) throw bad("Phone number is required.");
    if (!storeAddress) throw bad("Address is required.");
  }
  return { email, password, storeName, contactPerson, phone, storeAddress, customerType };
}
