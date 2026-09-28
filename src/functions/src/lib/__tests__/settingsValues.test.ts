/**
 * Cloud Functions must compute with the settings the admin edits
 * (settings/general), falling back to the legacy settings/default doc.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTaxRate,
  resolveFreeDeliveryMin,
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

  it('falls back to freeDeliveryThreshold, then the legacy doc, then $250', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryThreshold: 180 })).toBe(180);
    expect(resolveFreeDeliveryMin({}, { freeDeliveryMin: 200 })).toBe(200);
    expect(resolveFreeDeliveryMin({}, {})).toBe(DEFAULT_FREE_DELIVERY_MIN);
  });

  it('allows free delivery on every order when set to 0', () => {
    expect(resolveFreeDeliveryMin({ freeDeliveryMin: 0 })).toBe(0);
  });
});
