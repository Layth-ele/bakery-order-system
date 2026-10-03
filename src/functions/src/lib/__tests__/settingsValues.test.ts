/**
 * Cloud Functions must compute with the settings the admin edits
 * (settings/general), falling back to the legacy settings/default doc.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTaxRate,
  resolveFreeDeliveryMin,
  isFreeDeliveryEnabled,
  resolvePolicy,
  DEFAULT_TAX_RATE,
  DEFAULT_FREE_DELIVERY_MIN,
} from '../settingsValues';

describe('resolveTaxRate', () => {
  it('uses gstRate from settings/general (what Admin → System Settings saves)', () => {
    expect(resolveTaxRate({ gstRate: 0.12 }, { taxRate: 0.05 })).toBe(0.12);
  });

  it('accepts the legacy taxRate field and the legacy document', () => {
    expect(resolveTaxRate({ taxRate: 0.07 })).toBe(0.07);
    expect(resolveTaxRate({}, { gstRate: 0.13 })).toBe(0.13);
  });

  it('ignores invalid values (percent instead of fraction, negative, non-number)', () => {
    expect(resolveTaxRate({ gstRate: 5 }, { gstRate: -1 })).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate({ gstRate: '0.05' as unknown as number })).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate(undefined, undefined)).toBe(DEFAULT_TAX_RATE);
  });

  it('a zero rate is a real value, not "missing"', () => {
    expect(resolveTaxRate({ gstRate: 0 }, { gstRate: 0.05 })).toBe(0);
  });
});

describe('resolveFreeDeliveryMin', () => {
  it('uses freeDeliveryMin from settings/general over the legacy document', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryMin: 300 }, { freeDeliveryMin: 250 })).toBe(300);
  });

  it('falls back to freeDeliveryThreshold, then the legacy doc, then $500', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryThreshold: 180 })).toBe(180);
    expect(resolveFreeDeliveryMin({}, { freeDeliveryMin: 200 })).toBe(200);
    expect(resolveFreeDeliveryMin({}, {})).toBe(DEFAULT_FREE_DELIVERY_MIN);
  });

  it('allows free delivery on every order when set to 0', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryMin: 0 })).toBe(0);
  });
});

describe('free delivery switch', () => {
  it('off → no order qualifies (delivery always charged)', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryEnabled: false, freeDeliveryMin: 500 })).toBe(Number.POSITIVE_INFINITY);
    expect(isFreeDeliveryEnabled({ freeDeliveryEnabled: false })).toBe(false);
  });
  it('on → the minimum applies; settings saved before the switch count as on', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryEnabled: true, freeDeliveryMin: 500 })).toBe(500);
    expect(isFreeDeliveryEnabled({ freeDeliveryMin: 300 })).toBe(true);
  });
});

describe('bakery policy timings', () => {
  it('defaults: 48 h order cutoff, payment due = cutoff, 24 h free cancellation, no fee', () => {
    expect(resolvePolicy({})).toMatchObject({ orderCutoffHours: 48, paymentDueHours: 48, cancellationNoticeHours: 24, lateCancellationFeePercent: 0 });
  });
  it('reads the admin values from Settings', () => {
    const p = resolvePolicy({ orderCutoffHours: 36, paymentDueHours: 72, cancellationNoticeHours: 12, cancellationFeePercent: 25 });
    expect(p).toMatchObject({ orderCutoffHours: 36, paymentDueHours: 72, cancellationNoticeHours: 12, lateCancellationFeePercent: 25 });
  });
  it('ignores nonsense values', () => {
    expect(resolvePolicy({ orderCutoffHours: -5, cancellationFeePercent: 400 })).toMatchObject({ orderCutoffHours: 48, lateCancellationFeePercent: 0 });
  });
});

describe('order cutoff follows the setting', () => {
  it('dayCutoff = noon Vancouver minus the configured hours', async () => {
    const { dayCutoff, deliveryNoon } = await import('../orderPlacement');
    // 2026-W40 Monday Sep 28 noon PDT = 19:00Z
    expect(deliveryNoon(2026, 40, 'monday').toISOString()).toBe('2026-09-28T19:00:00.000Z');
    expect(dayCutoff(2026, 40, 'monday').toISOString()).toBe('2026-09-26T19:00:00.000Z'); // default 48 h
    expect(dayCutoff(2026, 40, 'monday', 24).toISOString()).toBe('2026-09-27T19:00:00.000Z');
  });
});
