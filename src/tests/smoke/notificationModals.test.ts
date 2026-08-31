/**
 * Notification modal mapping smoke tests
 * Validates that notification types correctly map to modals.
 */
import { describe, it, expect } from 'vitest';
import {
  getModalForNotification,
  hasModalMapping,
  NOTIFICATION_MODAL_MAP,
} from '../../notifications/types/notification-modal-mapping';

describe('notification modal mapping', () => {
  it('maps order_placed to a modal', () => {
    const mapping = getModalForNotification('order_placed');
    expect(mapping).toBeTruthy();
    expect(mapping?.modalType).toBeTruthy();
  });

  it('maps payment_confirmed to a modal', () => {
    const mapping = getModalForNotification('PAYMENT_CONFIRMED');
    expect(mapping).toBeTruthy();
  });

  it('returns a mapping for order_approved', () => {
    expect(hasModalMapping('order_approved')).toBe(true);
  });

  it('handles unknown notification type gracefully', () => {
    const mapping = getModalForNotification('UNKNOWN_TYPE_XYZ');
    // Should return null or a fallback — must not throw
    expect(() => getModalForNotification('UNKNOWN_TYPE_XYZ')).not.toThrow();
  });

  it('has entries in the modal map', () => {
    expect(Object.keys(NOTIFICATION_MODAL_MAP).length).toBeGreaterThan(5);
  });

  it('every modal map entry has a modalType', () => {
    const invalid = Object.entries(NOTIFICATION_MODAL_MAP)
      .filter(([, v]) => !v.modalType);
    expect(invalid).toHaveLength(0);
  });
});
