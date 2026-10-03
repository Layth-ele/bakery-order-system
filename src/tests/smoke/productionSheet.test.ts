import { describe, it, expect } from 'vitest';
import {
  OTHER_ITEMS,
  calculateDayInfo,
  calculateProductSummary,
  calculateCustomerCounts,
} from '../../services/production/productionAggregationService';
import { getWeekDayDate } from '../../utils/weekUtils';

const z = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
const date = getWeekDayDate(41, 0, 2026); // Monday of week 41
const order = (id: string, status: string, items: any[], extra: any = {}) =>
  ({ id, status, week: 41, year: 2026, items, customerName: id, ...extra }) as any;
const products: any[] = [{ id: 'bread', name: 'Bread', categoryId: 'c1' }];
const categories: any[] = [{ id: 'c1', name: 'Bread' }];

describe('production sheet counts', () => {
  const orders = [
    order('a', 'in_process', [
      { productId: 'bread', productName: 'Bread', ...z, monday: 10 },
      { productId: 'custom-1', productName: 'Birthday cake (Custom)', ...z, monday: 1 },
    ], { customerType: 'commercial' }),
    order('b', 'approved', [{ productId: 'bread', productName: 'Bread', ...z, monday: 5 }]), // unpaid: not baked
    order('c', 'completed', [{ productId: 'bread', productName: 'Bread', ...z, monday: 2 }]),
  ];

  it('the product list adds up to the day total, custom items included', () => {
    const day = calculateDayInfo(orders, date, 0, () => 'locked', getWeekDayDate);
    const list = calculateProductSummary(orders, date, products, categories, getWeekDayDate);
    expect(day.productCount).toBe(11);
    expect(list.reduce((s, p) => s + p.quantity, 0)).toBe(11);
    expect(list.find((p) => p.productId === 'custom-1')?.categoryName).toBe(OTHER_ITEMS);
  });

  it('unpaid orders are not on the sheet; completed ones only when the day counts them', () => {
    const withCompleted = (o: any) => o.status === 'in_process' || o.status === 'completed';
    expect(calculateDayInfo(orders, date, 0, () => 'done', getWeekDayDate, withCompleted).productCount).toBe(13);
  });

  it('splits commercial and individual by the account type', () => {
    expect(calculateCustomerCounts(orders, date, getWeekDayDate)).toEqual({ commercial: 1, individual: 0 });
  });
});
