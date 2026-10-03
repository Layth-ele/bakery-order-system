/**
 * Product discounts are a field on the product (`discount`, a percentage).
 * "Discounted items" (cat-0) is a filter, not a category products live in.
 *
 * An older version saved a second copy of each discounted product in cat-0
 * (or with an id ending "-discounted"). Those copies are hidden everywhere
 * and removed the next time the product is saved or deleted.
 */
import type { Product } from '../types';

export const DISCOUNTED_FILTER_ID = 'cat-0';

export const isLegacyDiscountCopy = (p: Pick<Product, 'id' | 'categoryId'>): boolean =>
  p.categoryId === DISCOUNTED_FILTER_ID || p.id.endsWith('-discounted');

export const isOnSale = (p: Pick<Product, 'discount'>): boolean =>
  typeof p.discount === 'number' && p.discount > 0 && p.discount < 100;

/** Old copies of `product` (same name, or the "<id>-discounted" id). */
export function legacyDiscountCopiesOf(product: { id?: string; name?: string }, products: Product[]): Product[] {
  const name = (product.name ?? '').trim().toLowerCase();
  return products.filter(
    (p) =>
      p.id !== product.id &&
      isLegacyDiscountCopy(p) &&
      ((!!product.id && p.id === `${product.id}-discounted`) || (!!name && (p.name ?? '').trim().toLowerCase() === name))
  );
}
