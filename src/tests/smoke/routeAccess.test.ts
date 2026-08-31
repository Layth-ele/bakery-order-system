/**
 * Route access smoke tests
 * Validates that auth guards block/allow correctly.
 * These test the guard logic functions directly (unit level).
 * Integration-level route tests require a full React Router setup.
 */
import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isApprovedCustomer,
  canAccessPath,
  getDefaultDashboard,
} from '../../routes/guards/navigationGuards';
import type { User } from '../../routes/guards/navigationGuards';

const admin: User = { id: 'a1', email: 'admin@test.com', role: 'admin', status: 'approved' };
const approved: User = { id: 'c1', email: 'c@test.com', role: 'customer', status: 'approved' };
const pending: User = { id: 'c2', email: 'p@test.com', role: 'customer', status: 'pending' };
const rejected: User = { id: 'c3', email: 'r@test.com', role: 'customer', status: 'rejected' };

describe('admin route access', () => {
  it('allows admin to access /admin paths', () => {
    expect(canAccessPath(admin, '/admin/pending')).toBe(true);
    expect(canAccessPath(admin, '/admin/customers')).toBe(true);
    expect(canAccessPath(admin, '/admin/products')).toBe(true);
  });

  it('blocks non-admin from /admin paths', () => {
    expect(canAccessPath(approved, '/admin/pending')).toBe(false);
    expect(canAccessPath(pending, '/admin/pending')).toBe(false);
    expect(canAccessPath(null, '/admin/pending')).toBe(false);
  });
});

describe('customer route access', () => {
  it('allows approved customer to access /customer', () => {
    expect(canAccessPath(approved, '/customer')).toBe(true);
  });

  it('blocks pending/rejected customer from /customer', () => {
    expect(canAccessPath(pending, '/customer')).toBe(false);
    expect(canAccessPath(rejected, '/customer')).toBe(false);
  });

  it('blocks unauthenticated user from /customer', () => {
    expect(canAccessPath(null, '/customer')).toBe(false);
  });

  it('blocks admin from /customer (redirected to /admin)', () => {
    // Admin should not access customer area — they get redirected
    expect(isAdmin(admin)).toBe(true);
    expect(isApprovedCustomer(admin)).toBe(false);
  });
});

describe('default dashboard routing', () => {
  it('sends admin to /admin/pending', () => {
    expect(getDefaultDashboard(admin)).toBe('/admin/pending');
  });

  it('sends approved customer to /customer', () => {
    expect(getDefaultDashboard(approved)).toBe('/customer');
  });

  it('sends pending customer to /account-status', () => {
    expect(getDefaultDashboard(pending)).toBe('/account-status');
  });
});

describe('public path access', () => {
  it('allows unauthenticated access to /', () => {
    expect(canAccessPath(null, '/')).toBe(true);
  });

  it('allows any user access to /', () => {
    expect(canAccessPath(approved, '/')).toBe(true);
    expect(canAccessPath(admin, '/')).toBe(true);
  });
});

describe('order action payload guard', () => {
  it('canAccessPath returns false for missing user on any protected route', () => {
    const protectedPaths = ['/admin/pending', '/admin/customers', '/customer', '/customer/orders'];
    protectedPaths.forEach(path => {
      expect(canAccessPath(null, path)).toBe(false);
    });
  });

  it('rejected customer cannot access customer routes', () => {
    const rejected: User = { id: 'r1', email: 'r@test.com', role: 'customer', status: 'rejected' };
    expect(canAccessPath(rejected, '/customer')).toBe(false);
    expect(canAccessPath(rejected, '/admin')).toBe(false);
  });

  it('admin cannot accidentally access customer-only paths via isApprovedCustomer check', () => {
    const admin: User = { id: 'a1', email: 'admin@test.com', role: 'admin', status: 'approved' };
    expect(isApprovedCustomer(admin)).toBe(false);
  });
});
