import { describe, it, expect, vi } from 'vitest';
vi.unmock('firebase/firestore'); // toDate() checks for FieldValue
import { changeNotices, documentDays, documentLines, documentTotals } from '../../utils/documents/orderDocument';

const z = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
const order: any = {
  id: 'o1', week: 41, year: 2026, status: 'in_process', paymentReceived: true,
  items: [
    { productId: 'p1', productName: 'Brioche', price: 4.6, ...z, monday: 10, wednesday: 6 },
    { productId: 'gone', productName: 'Old loaf', price: 3, ...z, wednesday: 2 },
  ],
  subtotal: 79.6, gst: 3.98, deliveryFee: 0, serviceCharge: 0, total: 83.58, creditApplied: 0, amountDue: 100, creditIssued: 16.42,
};

describe('order documents (PDF, Excel, on-screen invoice)', () => {
  it('shows only the days that were ordered, with dates', () => {
    expect(documentDays(order).map((d) => `${d.short} ${d.date}`)).toEqual(['Mon 10/5', 'Wed 10/7']);
  });
  it('prices lines at the price charged, keeps removed products', () => {
    const lines = documentLines(order, [{ id: 'p1', name: 'Brioche (renamed)', categoryId: 'c' }], [{ id: 'c', name: 'Bread', order: 1 }]);
    expect(lines.map((l) => [l.name, l.categoryName, l.total, l.price, l.amount])).toEqual([
      ['Brioche', 'Bread', 16, 4.6, 73.6],
      ['Old loaf', 'Other items', 2, 3, 6],
    ]);
  });
  it('totals: paid orders show what was paid and what came back as credit', () => {
    const rows = documentTotals(order);
    expect(rows.find((r) => r.kind === 'total')?.amount).toBe(83.58);
    expect(rows.find((r) => r.kind === 'paid')?.amount).toBe(100);
    expect(rows.find((r) => r.label.startsWith('Returned as store credit'))?.amount).toBe(16.42);
  });
  it('change notices: history + order events, oldest first, readable days', () => {
    const at = (d: string) => ({ toDate: () => new Date(d) });
    const n = changeNotices(
      { ...order, approvedAt: at('2026-10-03T10:00:00Z'), paidAt: at('2026-10-03T12:00:00Z') },
      [{ kind: 'partial_cancel', editedAt: at('2026-10-04T10:00:00Z'), changesSummary: 'Cancelled tuesday, friday', creditIssued: 10, cancellationFee: 1 }]
    );
    expect(n.map((x) => x.title)).toEqual(['Approved by the bakery', 'Payment confirmed', 'Delivery days cancelled']);
    expect(n[2].detail).toMatch(/^Tuesday, Friday\. .*\$10\.00 returned as store credit\. Cancellation fee \$1\.00\./);
  });
});
