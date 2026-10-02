/**
 * The admin edit screen's changes → the editOrder Cloud Function payload.
 */
import { describe, it, expect } from 'vitest';
import { toEditOrderPayload } from '../../services/orders/orderEdits';

const order = {
  id: 'o1',
  items: [{ productId: 'bread', productName: 'Bread', price: 4, monday: 2, total: 2 }],
} as any;

describe('toEditOrderPayload', () => {
  it('sends whole-number day quantities, never prices, for catalogue products', () => {
    const p = toEditOrderPayload(order, { editedItems: { bread: { monday: 3, tuesday: -1, price: 0.01 } as any } });
    expect(p.items).toEqual([
      { productId: 'bread', quantities: { monday: 3, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 } },
    ]);
    expect(p).not.toHaveProperty('discount');
  });

  it('sends name and price only for a custom product the admin just added', () => {
    const p = toEditOrderPayload(order, {
      editedItems: { 'custom-1-abc': { productName: 'Tray (Custom)', price: 12.5, friday: 1 } },
    });
    expect(p.items[0].custom).toEqual({ name: 'Tray (Custom)', price: 12.5 });
  });

  it('maps percentage and fixed discounts, and the delivery fee', () => {
    const pct = toEditOrderPayload(order, { editedItems: {}, discountType: 'percentage', discountPercentage: 10, discount: 0, deliveryFee: 15 });
    expect(pct.discount).toEqual({ type: 'percentage', value: 10, note: '' });
    expect(pct.deliveryFee).toBe(15);
    const fixed = toEditOrderPayload(order, { editedItems: {}, discountType: 'fixed', discount: 5, discountNote: 'Loyal' });
    expect(fixed.discount).toEqual({ type: 'fixed', value: 5, note: 'Loyal' });
  });
});
