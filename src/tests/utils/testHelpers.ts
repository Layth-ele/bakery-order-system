/**
 * Test Utilities
 * 
 * Helper functions and mocks for notification system tests
 */

import { vi, expect } from 'vitest';
import {NOTIFICATION_TYPES} from '../../types/notification-contract'
import type { Notification } from '../../types/notification-canonical';
import type { Order } from '../../services/dataService';
import type { ActionType } from '../../types/notification-contract';

/**
 * Create a mock notification for testing
 */
export function createMockNotification(
  overrides?: Partial<Notification>
): Notification {
  return {
    id: 'test-notif-123',
    type: NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
    title: 'Test Notification',
    message: 'This is a test notification',
    orderId: 'test-order-123',
    read: false,
    createdAt: new Date().toISOString(),
    actions: [],
    ...overrides,
  };
}

/**
 * Create multiple mock notifications
 */
export function createMockNotifications(count: number): Notification[] {
  return Array.from({ length: count }, (_, index) =>
    createMockNotification({
      id: `notif-${index}`,
      title: `Notification ${index + 1}`,
      read: index % 2 === 0, // Alternate between read/unread
    })
  );
}

/**
 * Create a mock order for testing
 */
export function createMockOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'test-order-123',
    customerId: 'test-customer-456',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    customerAddress: '123 Test St',
    customerPhone: '604-555-0100',
    weekRange: 'Jan 15-21, 2026',
    week: 3,
    status: 'pending',
    total: 150.0,
    subtotal: 140.0,
    gst: 10.0,
    deliveryFee: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    adjustments: [],
    trigger: 'create' as const,
    ...overrides,
  } as Order;
}

/**
 * Create mock notification context
 */
export function createMockNotificationContext(
  notifications: Notification[] = []
) {
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead: vi.fn().mockResolvedValue(undefined),
    deleteNotification: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mock Firestore document reference
 */
export function createMockDocRef(id: string) {
  return {
    id,
    path: `notifications/test/${id}`,
  };
}

/**
 * Mock Firestore collection reference
 */
export function createMockCollectionRef(path: string) {
  return {
    path,
  };
}

/**
 * Create mock Firestore snapshot
 */
export function createMockSnapshot(notifications: Notification[]) {
  return {
    docs: notifications.map((notif) => ({
      id: notif.id,
      data: () => notif,
      exists: () => true,
    })),
    empty: notifications.length === 0,
    size: notifications.length,
  };
}

/**
 * Simulate time passing for timestamp tests
 */
export function advanceTime(milliseconds: number) {
  const now = Date.now();
  vi.setSystemTime(now + milliseconds);
}

/**
 * Reset time to current
 */
export function resetTime() {
  vi.useRealTimers();
}

/**
 * Create notification with specific timestamp
 */
export function createNotificationWithAge(
  ageInMinutes: number
): Notification {
  const createdAt = new Date(Date.now() - ageInMinutes * 60 * 1000);
  return createMockNotification({
    createdAt: createdAt.toISOString(),
  });
}

/**
 * Assertion helpers
 */
export const notificationAssertions = {
  /**
   * Assert notification has correct structure
   */
  assertValidNotification(notification: any) {
    expect(notification).toHaveProperty('id');
    expect(notification).toHaveProperty('type');
    expect(notification).toHaveProperty('title');
    expect(notification).toHaveProperty('message');
    expect(notification).toHaveProperty('orderId');
    expect(notification).toHaveProperty('read');
    expect(notification).toHaveProperty('createdAt');
    expect(notification).toHaveProperty('actions');
  },

  /**
   * Assert notification is unread
   */
  assertUnread(notification: Notification) {
    expect(notification.read).toBe(false);
  },

  /**
   * Assert notification is read
   */
  assertRead(notification: Notification) {
    expect(notification.read).toBe(true);
  },

  /**
   * Assert notification has actions
   */
  assertHasActions(notification: Notification) {
    expect(notification.actions).toBeDefined();
    expect(notification.actions.length).toBeGreaterThan(0);
  },

  /**
   * Assert notification has specific action type
   */
  assertHasAction(notification: Notification, actionType: string) {
    expect(notification.actions).toBeDefined();
    const hasAction = notification.actions.some(
      (action) => action.type === actionType
    );
    expect(hasAction).toBe(true);
  },
};

/**
 * Mock Firebase auth user
 */
export function createMockUser(userId: string = 'test-user-123') {
  return {
    uid: userId,
    email: 'test@example.com',
    displayName: 'Test User',
  };
}

/**
 * Mock notification action
 */
export function createMockAction(type: ActionType, label: string) {
  return {
    type,
    label,
    payload: { orderId: 'test-order-123' },
  };
}

/**
 * Test data sets
 */
export const testData = {
  notifications: {
    orderApproved: createMockNotification({
      type: NOTIFICATION_TYPES.ORDER_APPROVED_PAY_REQUIRED,
      title: 'Order Approved',
      message: 'Your order has been approved',
      actions: [{ type: 'PAY_NOW', label: 'Pay Now' }],
    }),
    
    paymentSubmitted: createMockNotification({
      type: NOTIFICATION_TYPES.PAYMENT_SUBMITTED,
      title: 'Payment Submitted',
      message: 'Payment proof submitted',
      actions: [{ type: 'CONFIRM_PAYMENT', label: 'Review Payment' }],
    }),
    
    orderCompleted: createMockNotification({
      type: NOTIFICATION_TYPES.PAYMENT_CONFIRMED,
      title: 'Order Completed',
      message: 'Your order is complete',
      actions: [createMockAction('VIEW_INVOICE', 'View Invoice')],
    }),
  },
  
  orders: {
    pending: createMockOrder({ status: 'pending' }),
    approved: createMockOrder({ status: 'approved' }),
    completed: createMockOrder({ status: 'completed' }),
    rejected: createMockOrder({ status: 'rejected' }),
    cancelled: createMockOrder({ status: 'cancelled' }),
  },
};