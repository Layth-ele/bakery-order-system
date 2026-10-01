/**
 * publicProfile — the business "card" anyone may read (publicProfile/business).
 *
 * settings/general is readable only by signed-in users and also holds private
 * data (admin emails, payment details, prices). The public login page needs
 * just the business identity, so the onSettingsWritten trigger copies an
 * explicit allow-list of fields here whenever Admin → System Settings is saved.
 *
 * Pure: no Firebase imports (tested in __tests__/publicProfile.test.ts).
 */

export interface PublicProfile {
  businessName: string;
  /** First line of the business address (street, city). */
  businessAddress: string;
  businessCity: string;
  businessPhone: string;
  businessEmail: string;
  /** https URL of the uploaded logo, or "" for the default artwork. */
  logoUrl: string;
}

const MAX_LEN = 200;
const str = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "");
const https = (v: unknown): string => (/^https:\/\/\S+$/i.test(str(v)) ? str(v) : "");
const email = (v: unknown): string => (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(str(v)) ? str(v) : "");

/**
 * Public fields from the raw settings document. Anything not listed here —
 * adminEmail, payment methods, prices, policies — never leaves settings.
 */
export function buildPublicProfile(settings: Record<string, unknown> | null | undefined): PublicProfile {
  const s = settings ?? {};
  const location = typeof s.businessLocation === "string" ? s.businessLocation : "";
  return {
    businessName: str(s.businessName),
    businessAddress: str(s.businessAddress) || str(location.split("\n")[0]),
    businessCity: str(s.businessCity),
    businessPhone: str(s.businessPhone),
    // The public contact address; orderEmail is the orders inbox customers reply to.
    businessEmail: email(s.businessEmail) || email(s.orderEmail),
    logoUrl: https(s.logoUrl),
  };
}

export function samePublicProfile(a: Partial<PublicProfile> | null | undefined, b: PublicProfile): boolean {
  if (!a) return false;
  return (Object.keys(b) as Array<keyof PublicProfile>).every((k) => (a[k] ?? "") === b[k]);
}
