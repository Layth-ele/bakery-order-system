/**
 * Notification type → modal/page mapping.
 */
import { describe, it, expect } from 'vitest';
import {
  getModalForNotification,
  hasModalMapping,
  NOTIFICATION_MODAL_MAP,
} from '../../notifications/types/notification-modal-mapping';
import { NOTIFICATION_TYPES, normalizeNotificationType } from '../../types/notification-contract';

describe('notification modal mapping', () => {
  it('maps every current notification type', () => {
    for (const type of Object.values(NOTIFICATION_TYPES)) {
      expect(hasModalMapping(type)).toBe(true);
      expect(NOTIFICATION_MODAL_MAP[type].modalType).toBeTruthy();
    }
  });

  it('opens the right modal for key lifecycle notifications', () => {
    expect(getModalForNotification('ORDER_APPROVED_PAY_REQUIRED').modalType).toBe('SUBMIT_PAYMENT');
    expect(getModalForNotification('ORDER_COMPLETED').modalType).toBe('COMPLETED_ORDER_INVOICE');
    expect(getModalForNotification('PAYMENT_SUBMITTED').modalType).toBe('ADMIN_ORDER_VIEW');
  });

  it('sends new registrations to the Registrations page', () => {
    expect(getModalForNotification('NEW_REGISTRATION').route).toBe('/admin/registrations');
  });

  it('keeps notifications stored under legacy type names clickable', () => {
    expect(normalizeNotificationType('new_registration')).toBe('NEW_REGISTRATION');
    expect(normalizeNotificationType('PAYMENT_SUBMITTED_TRACKING')).toBe('PAYMENT_SUBMITTED');
    expect(normalizeNotificationType('order-approved')).toBe('ORDER_APPROVED_PAY_REQUIRED');
    expect(getModalForNotification('new_registration').route).toBe('/admin/registrations');
  });

  it('falls back to the details modal for unknown types without throwing', () => {
    expect(getModalForNotification('UNKNOWN_TYPE_XYZ').modalType).toBe('NOTIFICATION_DETAILS');
    expect(hasModalMapping('UNKNOWN_TYPE_XYZ')).toBe(false);
    expect(hasModalMapping(undefined)).toBe(false);
  });
});
