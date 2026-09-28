/**
 * Real Resend API keys start with "re_". Anything else (e.g. the
 * "not-configured" placeholder the RESEND_API_KEY secret is created with so
 * functions can deploy before Resend is set up) counts as not configured.
 *
 * Pure: no Firebase imports (tested in __tests__/mailer.test.ts).
 */
export const isResendApiKey = (v: unknown): boolean => typeof v === "string" && /^re_\S{8,}$/.test(v.trim());
