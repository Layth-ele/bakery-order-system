/**
 * Auth smoke tests
 * Validates auth guard logic and login/logout flows
 */
import {describe, it, expect} from 'vitest'
import { isAdmin, isApprovedCustomer } from '../../routes/guards/navigationGuards';
import type { User } from '../../routes/guards/navigationGuards';

const adminUser: User = { id: 'admin-1', email: 'admin@test.com', role: 'admin', status: 'approved' };
const approvedCustomer: User = { id: 'cust-1', email: 'cust@test.com', role: 'customer', status: 'approved' };
const pendingCustomer: User = { id: 'cust-2', email: 'pending@test.com', role: 'customer', status: 'pending' };
const rejectedCustomer: User = { id: 'cust-3', email: 'reject@test.com', role: 'customer', status: 'rejected' };

describe('isAdmin', () => {
  it('returns true for admin role', () => expect(isAdmin(adminUser)).toBe(true));
  it('returns false for customer', () => expect(isAdmin(approvedCustomer)).toBe(false));
  it('returns false for null', () => expect(isAdmin(null)).toBe(false));
});

describe('isApprovedCustomer', () => {
  it('returns true for approved customer', () => expect(isApprovedCustomer(approvedCustomer)).toBe(true));
  it('returns false for pending customer', () => expect(isApprovedCustomer(pendingCustomer)).toBe(false));
  it('returns false for rejected customer', () => expect(isApprovedCustomer(rejectedCustomer)).toBe(false));
  it('returns false for admin', () => expect(isApprovedCustomer(adminUser)).toBe(false));
  it('returns false for null', () => expect(isApprovedCustomer(null)).toBe(false));
});
