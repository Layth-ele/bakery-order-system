/**
 * Business Default Values & Fallbacks
 *
 * ✅ FEB 18, 2026: Centralized constants for business information fallbacks
 *
 * FIX T2R3-C1 (CRITICAL — privacy/PII): Previous version of this file
 * hardcoded the real bakery's name, street address (1185/1189 16th St W,
 * North Vancouver), Yahoo email (delightbakehouse@yahoo.com), real phone
 * number (604) 984-9478, and the real CRA business registration number
 * (723420345RT0001).  Those values flowed into 13+ files via this constants
 * module — leaking real PII into every customer-facing PDF, invoice preview,
 * email template, and excel export.
 *
 * THIS FILE NOW CONTAINS ONLY GENERIC PLACEHOLDERS.  Real values must come
 * from Firestore via `getBusinessSettingsWithDefaults(settings)` after the
 * admin has configured them in System Settings.  The placeholders below are
 * obvious enough that they cannot be mistaken for production data — if a PDF
 * shows "Your Bakery Name" the operator knows settings are unconfigured.
 *
 * USAGE:
 * - Use these constants as fallback values in OR operators
 * - Example: settings.businessName || BUSINESS_DEFAULTS.NAME
 * - Never hardcode bakery-specific values directly in components
 */

/**
 * Core business identity information (placeholders only)
 */
export const BUSINESS_DEFAULTS = {
  /** Official business name (placeholder) */
  NAME: 'Your Bakery Name',

  /** Legal business entity name (placeholder) */
  LEGAL_NAME: 'Your Bakery Inc.',

  /** Business city/region (placeholder) */
  CITY: 'City',

  /** Business registration number (placeholder — real GST/HST number lives in
   *  Firestore settings only). MUST NOT be a real registration number. */
  REGISTRATION_NUMBER: '',
} as const;

/**
 * Contact information defaults (placeholders only)
 */
export const CONTACT_DEFAULTS = {
  /** Primary business phone number (placeholder — 555 is the standard
   *  fictional-phone exchange that cannot be a real number) */
  PHONE: '(555) 555-0100',

  /** Alternative/demo phone format */
  PHONE_ALT: '555-555-0100',

  /** Primary business email (placeholder — example.com is RFC-2606-reserved) */
  EMAIL: 'orders@example.com',

  /** Full physical address — multi-line format (placeholder) */
  ADDRESS_MULTILINE: '123 Example St\nCity, BC V0V 0V0\nCanada',

  /** Physical address — single-line format (placeholder) */
  ADDRESS_SINGLE: '123 Example St, City, BC V0V 0V0',

  /** Alternative address format (placeholder) */
  ADDRESS_ALT: '123 Example St, City, BC V0V 0V0',
} as const;

/**
 * Marketing and display text defaults (generic placeholders)
 */
export const MARKETING_DEFAULTS = {
  /** Business tagline/slogan */
  TAGLINE: 'Premium Baked Goods',

  /** Short description for hero sections */
  HERO_DESCRIPTION: 'Welcome to our wholesale ordering portal — your gateway to premium baked goods for businesses.',

  /** Welcome message */
  WELCOME_MESSAGE: 'Welcome To The World of\nYour Bakery',

  /** Value proposition */
  VALUE_PROP: 'Our platform streamlines your weekly ordering process, giving you access to authentic pastries, artisan breads, and specialty baked items.',

  /** Call to action */
  CTA: 'Join our wholesale program today and enjoy competitive pricing, reliable weekly deliveries, and the quality our customers depend on.',
} as const;

/**
 * Support messages for different scenarios
 */
export const SUPPORT_MESSAGES = {
  /** General support contact message */
  GENERAL: `Contact us at: ${CONTACT_DEFAULTS.EMAIL} or ${CONTACT_DEFAULTS.PHONE}`,

  /** Urgent support message */
  URGENT: `Urgent: Contact us at ${CONTACT_DEFAULTS.EMAIL} or ${CONTACT_DEFAULTS.PHONE}`,

  /** Questions support message */
  QUESTIONS: `Questions? Contact us at: ${CONTACT_DEFAULTS.EMAIL} or ${CONTACT_DEFAULTS.PHONE}`,

  /** Please contact support message */
  PLEASE_CONTACT: `Please contact us at: ${CONTACT_DEFAULTS.EMAIL} or ${CONTACT_DEFAULTS.PHONE}`,
} as const;

/**
 * Account status messages
 */
export const ACCOUNT_STATUS_MESSAGES = {
  PENDING: {
    TITLE: 'Account Pending Approval',
    DESCRIPTION: 'Your registration is being reviewed by our team',
    MESSAGE: (email: string) => `Thank you for registering with ${BUSINESS_DEFAULTS.NAME} Wholesale!

Your account (${email}) has been successfully created and is currently awaiting administrator approval.

What happens next?
• Our team will review your application within 24-48 hours
• You'll receive an email notification once your account is approved
• Once approved, you can start placing orders immediately

Important Information:
• Approval typically takes 1-2 business days

In the meantime, feel free to browse our product catalog or contact us if you have any questions.`,
  },
  REJECTED: {
    TITLE: 'Account Registration Not Approved',
    DESCRIPTION: 'Your application requires attention',
    MESSAGE: (email: string, reason?: string) => `We're sorry, but your account registration (${email}) has not been approved at this time.

${reason ? `Reason: ${reason}\n\n` : ''}Next Steps:
• Review our wholesale partnership requirements
• Contact our support team to discuss your application
• Provide any additional documentation if requested
• Re-apply with updated information if appropriate`,
  },
  SUSPENDED: {
    TITLE: 'Account Temporarily Suspended',
    DESCRIPTION: 'Your account access has been restricted',
    MESSAGE: (email: string, reason?: string) => `Your account (${email}) has been temporarily suspended.

${reason ? `Reason: ${reason}\n\n` : ''}Important:
• This is typically a temporary measure
• Your order history and data remain safe
• No further orders can be placed until resolved

To Resolve This:
• Check your email for suspension details
• Contact our support team immediately
• Discuss reinstatement options

We're here to help resolve this matter as quickly as possible.`,
  },
  ERROR: {
    TITLE: 'Error',
    DESCRIPTION: 'Something went wrong',
    MESSAGE: 'Your account is approved but you\'re seeing this screen by mistake. Please contact support.',
  },
} as const;

/**
 * Form placeholders
 */
export const FORM_PLACEHOLDERS = {
  BUSINESS_NAME: BUSINESS_DEFAULTS.NAME,
  PHONE: CONTACT_DEFAULTS.PHONE,
  EMAIL: CONTACT_DEFAULTS.EMAIL,
  ADDRESS: CONTACT_DEFAULTS.ADDRESS_SINGLE,
} as const;

/**
 * Invoice defaults
 */
export const INVOICE_DEFAULTS = {
  /** Business name for invoices */
  BUSINESS_NAME: BUSINESS_DEFAULTS.NAME,

  /** Business location for invoices */
  LOCATION: CONTACT_DEFAULTS.ADDRESS_SINGLE,

  /** Business phone for invoices */
  PHONE: CONTACT_DEFAULTS.PHONE_ALT,

  /** Business email for invoices */
  EMAIL: CONTACT_DEFAULTS.EMAIL,

  /** Business registration number — empty placeholder; real GST/HST lives in Firestore */
  BUSINESS_NUMBER: BUSINESS_DEFAULTS.REGISTRATION_NUMBER,

  /** Legal entity name */
  LEGAL_NAME: BUSINESS_DEFAULTS.LEGAL_NAME,
} as const;

/**
 * Footer information
 */
export const FOOTER_DEFAULTS = {
  /** Full address for footer */
  ADDRESS: `${BUSINESS_DEFAULTS.NAME} • ${CONTACT_DEFAULTS.ADDRESS_ALT}`,
} as const;

/**
 * Helper function to get complete business settings with fallbacks.
 * Real values come from Firestore via the settings doc; placeholders are
 * used only when the admin hasn't configured them yet.
 */
export function getBusinessSettingsWithDefaults(settings: any = {}) {
  return {
    businessName: settings.businessName || BUSINESS_DEFAULTS.NAME,
    businessLegalName: settings.businessLegalName || BUSINESS_DEFAULTS.LEGAL_NAME,
    businessLocation: settings.businessLocation || CONTACT_DEFAULTS.ADDRESS_MULTILINE,
    businessPhone: settings.businessPhone || CONTACT_DEFAULTS.PHONE,
    businessEmail: settings.businessEmail || CONTACT_DEFAULTS.EMAIL,
    businessCity: settings.businessCity || BUSINESS_DEFAULTS.CITY,
    businessNumber: settings.businessNumber || BUSINESS_DEFAULTS.REGISTRATION_NUMBER,
    orderEmail: settings.orderEmail || CONTACT_DEFAULTS.EMAIL,
    paymentAddress: settings.paymentAddress || CONTACT_DEFAULTS.ADDRESS_SINGLE,
  };
}

/**
 * Invoice / order / customer ID prefixes.
 *
 * FIX T2R4-H6 (HIGH — multi-tenancy / rebrand readiness): The prefixes
 * 'DBH', 'ORD', 'CUST' were previously hardcoded across 7+ files
 * (idCounterService.ts, generateId.ts (CF), idGenerator.ts (CF),
 * invoices.ts (CF), firestoreIdGenerator.ts, etc.). If the bakery
 * rebrands or this codebase is reused for a different business, all of
 * those need to be hunted down individually.
 *
 * Centralized here so:
 *   1. A single point of truth in source code
 *   2. Tests can assert against this constant rather than hardcoded
 *      strings
 *   3. Future multi-tenancy can read from Firestore settings if needed
 *      (settings.invoicePrefix → fallback to ID_PREFIXES.INVOICE)
 *
 * IMPORTANT: changing these values would invalidate the existing daily-
 * counter docs in Firestore (idCounters/{prefix}-YYYY-MM-DD-NNN). Only
 * change if you also migrate the counter docs.
 *
 * The Cloud Functions in functions/src/* duplicate this constant locally
 * (CFs run in a separate package and can't import from src/). Keep them
 * in sync — see CHANGES_T2R10.md.
 */
export const ID_PREFIXES = {
  /** Invoice number prefix (e.g. DBH-2026-04-30-001-47) */
  INVOICE: 'DBH',
  /** Order number prefix (e.g. ORD-2026-04-30-005-23) */
  ORDER: 'ORD',
  /** Customer code prefix (e.g. CUST-2026-04-30-012) */
  CUSTOMER: 'CUST',
} as const;

export type IdPrefixType = typeof ID_PREFIXES[keyof typeof ID_PREFIXES];