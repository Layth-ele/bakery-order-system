/**
 * Subscription safety smoke tests.
 * Catches Firestore listener leaks in CI instead of relying on the
 * dev-only console interval in subscriptionSafety.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  safeSubscribe,
  getActiveSubscriptions,
  getSubscriptionCount,
  cleanupAllSubscriptions,
} from '../../utils/subscriptionSafety';

afterEach(() => {
  cleanupAllSubscriptions();
});

describe('safeSubscribe', () => {
  it('tracks an active subscription until unsubscribed', () => {
    const unsubscribe = safeSubscribe('test:order:1', () => () => {});

    expect(getSubscriptionCount()).toBe(1);
    expect(getActiveSubscriptions()).toContain('test:order:1');

    unsubscribe();

    expect(getSubscriptionCount()).toBe(0);
  });

  it('auto-cleans a duplicate subscription for the same key instead of leaking', () => {
    let firstUnsubscribeCalls = 0;
    safeSubscribe('test:order:2', () => () => {
      firstUnsubscribeCalls += 1;
    });

    // Re-subscribing with the same key must tear down the previous listener.
    safeSubscribe('test:order:2', () => () => {});

    expect(firstUnsubscribeCalls).toBe(1);
    expect(getSubscriptionCount()).toBe(1); // only the newest subscription remains
  });

  it('leaves no leaked subscriptions after a simulated mount/unmount cycle', () => {
    const keys = ['test:a', 'test:b', 'test:c'];
    const unsubscribes = keys.map((key) => safeSubscribe(key, () => () => {}));

    expect(getSubscriptionCount()).toBe(keys.length);

    unsubscribes.forEach((unsubscribe) => unsubscribe());

    expect(getSubscriptionCount()).toBe(0);
    expect(getActiveSubscriptions()).toEqual([]);
  });
});
