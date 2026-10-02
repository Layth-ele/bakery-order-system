/**
 * Account lifecycle rules (functions/src/lib/accountRules.ts).
 */
import { describe, it, expect } from 'vitest';
import { AccountRuleError, canSignIn, nextStatus, parseNewAccount } from '../accountRules';

describe('account status transitions', () => {
  it('approve: pending or rejected → approved', () => {
    expect(nextStatus('pending', 'approve')).toBe('approved');
    expect(nextStatus('rejected', 'approve')).toBe('approved');
  });
  it('reject only a pending request', () => {
    expect(nextStatus('pending', 'reject')).toBe('rejected');
    expect(() => nextStatus('approved', 'reject')).toThrow(/active/);
  });
  it('suspend only active accounts; reactivate only suspended ones', () => {
    expect(nextStatus('approved', 'suspend')).toBe('suspended');
    expect(nextStatus('suspended', 'reactivate')).toBe('approved');
    expect(() => nextStatus('pending', 'suspend')).toThrow(AccountRuleError);
    expect(() => nextStatus('approved', 'reactivate')).toThrow(/can't be reactivated/);
  });
  it('archived accounts are closed for good', () => {
    for (const a of ['approve', 'reject', 'suspend', 'reactivate'] as const) {
      expect(() => nextStatus('archived', a)).toThrow(/archived/);
    }
  });
  it('sign-in is enabled only for approved and pending accounts', () => {
    expect(canSignIn('approved')).toBe(true);
    expect(canSignIn('pending')).toBe(true);
    expect(canSignIn('rejected')).toBe(false);
    expect(canSignIn('suspended')).toBe(false);
    expect(canSignIn('archived')).toBe(false);
  });
});

describe('admin "Add account" input', () => {
  const ok = {
    email: ' Cafe@Example.COM ', password: 'temp-pass-1', storeName: 'Corner Cafe', contactPerson: 'Sam',
    phone: '604-555-0100', storeAddress: '1 Main St', customerType: 'commercial',
  };
  it('normalises email and keeps the details', () => {
    expect(parseNewAccount(ok)).toMatchObject({ email: 'cafe@example.com', customerType: 'commercial', storeName: 'Corner Cafe' });
  });
  it('individuals default their store name to the contact person', () => {
    expect(parseNewAccount({ ...ok, customerType: 'individual', storeName: '' }).storeName).toBe('Sam');
  });
  it('admins need no phone or address', () => {
    expect(parseNewAccount({ ...ok, customerType: 'admin', phone: '', storeAddress: '' }).customerType).toBe('admin');
  });
  it.each([
    ['bad email', { ...ok, email: 'nope' }, /valid email/],
    ['short password', { ...ok, password: 'short' }, /8 characters/],
    ['no contact', { ...ok, contactPerson: ' ' }, /Contact person/],
    ['commercial without business name', { ...ok, storeName: '' }, /Business legal name/],
    ['customer without phone', { ...ok, phone: '' }, /Phone/],
    ['customer without address', { ...ok, storeAddress: '' }, /Address/],
    ['unknown type', { ...ok, customerType: 'owner' }, /account type/],
  ])('rejects %s', (_l, input, msg) => {
    expect(() => parseNewAccount(input)).toThrow(msg as RegExp);
  });
});
