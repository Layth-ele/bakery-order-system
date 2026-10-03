import { describe, it, expect } from 'vitest';
import { buildPushData, pushBody, recipientOf } from '../pushPayload';

describe('push notifications', () => {
  it('routes admin and customer feeds', () => {
    expect(recipientOf('admin')).toEqual({ audience: 'admin' });
    expect(recipientOf('user_abc123')).toEqual({ audience: 'customer', uid: 'abc123' });
    expect(recipientOf('something-else')).toBeNull();
    expect(recipientOf('user_')).toBeNull();
  });

  it('turns the in-app message into a short one-line body', () => {
    expect(pushBody('Your order has been approved!\n\nAmount due: $96.60')).toBe('Your order has been approved! · Amount due: $96.60');
    const long = pushBody('x'.repeat(400));
    expect(long.length).toBe(178);
    expect(long.endsWith('…')).toBe(true);
  });

  it('builds the FCM data (strings only) with badge, link and a per-order tag', () => {
    const d = buildPushData({ title: '✅ Order Approved', message: 'Amount due: $96.60', orderId: 'o1' }, 'customer', 3, 'n1');
    expect(d).toEqual({ title: '✅ Order Approved', body: 'Amount due: $96.60', url: '/customer', tag: 'order-o1', badge: '3' });
    expect(Object.values(d).every((v) => typeof v === 'string')).toBe(true);
    expect(buildPushData({}, 'admin', 0, 'n2')).toMatchObject({ title: 'Delight Bakehouse', url: '/admin', tag: 'n2', badge: '0' });
  });
});
