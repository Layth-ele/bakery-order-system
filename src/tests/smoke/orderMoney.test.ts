import { describe, it, expect } from 'vitest';
import { isSaleOrder, lineAmount, orderAmountDue, orderRevenue } from '../../utils/orderMoney';
import { isLegacyDiscountCopy, legacyDiscountCopiesOf } from '../../utils/productDiscount';

describe('revenue', () => {
  it('counts sales and kept cancellation fees only', () => {
    expect(isSaleOrder({ status: 'in_process' })).toBe(true);
    expect(orderRevenue({ status: 'completed', total: 100 })).toBe(100);
    expect(orderRevenue({ status: 'cancelled', total: 100, cancellationFee: 10 })).toBe(10);
    expect(orderRevenue({ status: 'pending', total: 100 })).toBe(0);
    expect(orderRevenue({ status: 'rejected', total: 100 })).toBe(0);
  });
  it('line amount is price × quantity, not the quantity', () => {
    expect(lineAmount({ price: 2.99, total: 80 })).toBe(239.2);
  });
  it('amount due is the stored value, even when credit covers it all', () => {
    expect(orderAmountDue({ total: 50, amountDue: 0, creditApplied: 50 })).toBe(0);
  });
});

describe('legacy discounted copies', () => {
  const products: any[] = [
    { id: 'a', name: 'Croissant', categoryId: 'c1' },
    { id: 'prod-1', name: 'Croissant', categoryId: 'cat-0' },
    { id: 'a-discounted', name: 'Croissant', categoryId: 'cat-0' },
    { id: 'b', name: 'Bagel', categoryId: 'c1' },
  ];
  it('finds every copy of a product and nothing else', () => {
    expect(isLegacyDiscountCopy(products[1])).toBe(true);
    expect(legacyDiscountCopiesOf(products[0], products).map((p) => p.id).sort()).toEqual(['a-discounted', 'prod-1']);
    expect(legacyDiscountCopiesOf(products[3], products)).toEqual([]);
  });
});
