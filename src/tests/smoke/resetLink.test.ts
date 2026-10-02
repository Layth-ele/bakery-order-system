/**
 * Firebase's built-in reset emails link to the site root; the app forwards
 * them to /reset-password with the code intact.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, isFirebaseConfigured: true }));
import { authActionRedirect } from '../../routes/guards/navigationGuards';

const site = 'https://delight-bakehousebakery-10c84.web.app';

describe('authActionRedirect', () => {
  it('sends a root reset link to the reset page, keeping every parameter', () => {
    const q = '?apiKey=AIza123&mode=resetPassword&oobCode=Mbq_A0-j3E&continueUrl=x&lang=en';
    expect(authActionRedirect(`${site}/${q}`)).toBe(`/reset-password${q}`);
    expect(authActionRedirect(`${site}${q}`)).toBe(`/reset-password${q}`);
  });
  it('leaves the reset page itself and ordinary pages alone', () => {
    expect(authActionRedirect(`${site}/reset-password?mode=resetPassword&oobCode=abc`)).toBeNull();
    expect(authActionRedirect(`${site}/`)).toBeNull();
    expect(authActionRedirect(`${site}/customer?mode=resetPassword`)).toBeNull(); // no code
    expect(authActionRedirect(`${site}/?mode=verifyEmail&oobCode=abc`)).toBeNull();
  });
});
