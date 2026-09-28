/**
 * The RESEND_API_KEY secret is created with a placeholder so functions can
 * deploy before Resend is set up; only a real "re_…" key enables email.
 */
import { describe, it, expect } from 'vitest';
import { isResendApiKey } from '../mailer';

describe('isResendApiKey', () => {
  it('accepts real Resend keys', () => {
    expect(isResendApiKey('re_123456789abcdef')).toBe(true);
    expect(isResendApiKey('  re_123456789abcdef\n')).toBe(true);
  });

  it('treats placeholders and empty values as not configured', () => {
    for (const v of ['not-configured', '', 're_', 'sk_live_123456789', undefined, null]) {
      expect(isResendApiKey(v)).toBe(false);
    }
  });
});
