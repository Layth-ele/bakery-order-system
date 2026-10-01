/**
 * The public business card exposes ONLY public identity fields.
 */
import { describe, it, expect } from 'vitest';
import { buildPublicProfile, samePublicProfile } from '../publicProfile';

const settings = {
  businessName: '  Maple Crumb Bakery ',
  businessLocation: '42 Oven Lane, North Vancouver, BC\nUnit 2',
  businessCity: 'North Vancouver',
  businessPhone: '604-555-0142',
  businessEmail: 'hello@maplecrumb.test',
  logoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/branding%2Flogo.png?alt=media',
  // private — must never be copied
  adminEmail: 'owner@maplecrumb.test',
  paymentMethod1: 'E-transfer to pay@maplecrumb.test',
  paymentAddress: 'PO Box 1',
  deliveryFee: 15,
  gstRate: 0.05,
};

describe('buildPublicProfile', () => {
  it('copies the public identity, trimmed, with the first address line', () => {
    expect(buildPublicProfile(settings)).toEqual({
      businessName: 'Maple Crumb Bakery',
      businessAddress: '42 Oven Lane, North Vancouver, BC',
      businessCity: 'North Vancouver',
      businessPhone: '604-555-0142',
      businessEmail: 'hello@maplecrumb.test',
      logoUrl: settings.logoUrl,
    });
  });

  it('never exposes private settings', () => {
    const json = JSON.stringify(buildPublicProfile(settings));
    for (const secret of ['owner@maplecrumb.test', 'pay@maplecrumb.test', 'PO Box 1', 'gstRate', 'deliveryFee']) {
      expect(json).not.toContain(secret);
    }
  });

  it('rejects unsafe or invalid values', () => {
    const p = buildPublicProfile({ logoUrl: 'javascript:alert(1)', businessEmail: 'not-an-email', businessName: 42 });
    expect(p.logoUrl).toBe('');
    expect(p.businessEmail).toBe('');
    expect(p.businessName).toBe('');
    expect(buildPublicProfile({ logoUrl: 'http://insecure.test/logo.png' }).logoUrl).toBe('');
  });

  it('falls back to the orders email and caps long values', () => {
    expect(buildPublicProfile({ orderEmail: 'orders@x.test' }).businessEmail).toBe('orders@x.test');
    expect(buildPublicProfile({ businessName: 'x'.repeat(500) }).businessName).toHaveLength(200);
  });

  it('missing settings give an empty card (UI hides unset parts)', () => {
    expect(Object.values(buildPublicProfile(undefined)).every((v) => v === '')).toBe(true);
  });
});

describe('samePublicProfile', () => {
  it('skips rewriting when nothing public changed', () => {
    const p = buildPublicProfile(settings);
    expect(samePublicProfile({ ...p, updatedAt: 'x' } as never, p)).toBe(true);
    expect(samePublicProfile({ ...p, businessPhone: '604-555-9999' }, p)).toBe(false);
    expect(samePublicProfile(undefined, p)).toBe(false);
  });
});
