/**
 * Products tab (customer) — the catalogue with each product's price for this
 * customer: wholesale for commercial accounts, retail for individuals, after
 * any product discount. Same rule as the order screen and the server
 * (functions/src/lib/orderPlacement.ts unitPriceFor).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Package, Tag, ShoppingCart, Percent } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Category } from '../../types';
import { usePaginatedOrders } from '../../hooks/usePaginatedOrders';
import { scrollToElement } from '../../utils/scrollUtils';
import { Pagination } from '../ui/pagination';
import { ProductImagePlaceholder } from '../shared/ProductImagePlaceholder';
import { CustomerPageLayout, StatCard } from './CustomerPageLayout';
import { unitPriceFor } from '../../functions/src/lib/orderPlacement';
import { isLegacyDiscountCopy, isOnSale } from '../../utils/productDiscount';

interface ProductsCatalogProps {
  products: Product[];
  categories: Category[];
  customerType?: string;
  onNavigateToOrder?: (productId: string) => void;
  onRefresh?: () => Promise<void>;
}

const PAGE_SIZE = 12;
const money = (n: number) => `$${n.toFixed(2)}`;

export function ProductsCatalog({ products, categories, customerType, onNavigateToOrder, onRefresh }: ProductsCatalogProps): JSX.Element | null {
  const tier = customerType === 'commercial' ? 'commercial' : 'individual';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const available = useMemo(() => products.filter((p) => p.available !== false && !isLegacyDiscountCopy(p)), [products]);
  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return available;
    if (selectedCategory === '__discounted__') return available.filter(isOnSale);
    return available.filter((p) => p.categoryId === selectedCategory);
  }, [available, selectedCategory]);
  const usedCategories = useMemo(
    () => categories.filter((c) => available.some((p) => p.categoryId === c.id)),
    [categories, available]
  );

  const { currentItems, currentPage, totalPages, totalItems, handlePageChange } = usePaginatedOrders(filtered, PAGE_SIZE);
  useEffect(() => {
    if (currentPage > 1 && gridRef.current) scrollToElement(gridRef.current, 8);
  }, [currentPage]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success('Products refreshed', { duration: 3000 });
    } catch {
      toast.error('Failed to refresh products', { duration: 3000 });
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const chip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setSelectedCategory(id)}
      className={`min-h-[40px] whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        selectedCategory === id
          ? 'border-[#8B6F47] bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white shadow-sm'
          : 'border-[#D4A574]/40 bg-white text-[#8B6F47] hover:bg-[#D4A574]/10'
      }`}
    >
      {label}
    </button>
  );

  return (
    <CustomerPageLayout
      icon={Package}
      title="Product Catalog"
      subtitle={`Your ${tier === 'commercial' ? 'wholesale' : 'retail'} prices`}
      sectionTitle="Product Overview"
      onRefresh={onRefresh ? handleRefresh : undefined}
      isRefreshing={isRefreshing}
    >
      <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3">
        <StatCard icon={Package} label="Products" value={available.length} color="tan" />
        <StatCard icon={Tag} label="Categories" value={usedCategories.length} color="blue" />
        <StatCard icon={Percent} label="On sale" value={available.filter(isOnSale).length} color="orange" />
      </div>

      {/* Category filter — scrolls sideways on phones */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 pb-1">
          {chip('all', 'All')}
          {available.some(isOnSale) && chip('__discounted__', 'On sale')}
          {usedCategories.map((c) => chip(c.id, c.name))}
        </div>
      </div>

      <div ref={gridRef} className="scroll-mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {currentItems.map((product) => {
          const price = unitPriceFor(product as any, tier);
          const fullPrice = unitPriceFor({ ...(product as any), discount: 0 }, tier);
          const onSale = price < fullPrice - 0.004;
          const category = categories.find((c) => c.id === product.categoryId)?.name;
          return (
            <div key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#D4A574]/30 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="relative aspect-[4/3] bg-[#faf8f5]">
                {product.image ? (
                  <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <ProductImagePlaceholder size="lg" className="h-full w-full" />
                )}
                {onSale && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                    {product.discount}% off
                  </span>
                )}
                {category && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#8B6F47] shadow-sm">
                    {category}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-bold leading-snug text-[#2d2416]">{product.name}</h3>
                {product.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{product.description}</p>}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[#8B6F47]">{money(price)}</span>
                  {onSale && <span className="text-sm text-neutral-400 line-through">{money(fullPrice)}</span>}
                  <span className="text-xs text-neutral-500">/ {product.unit || 'unit'}</span>
                </div>
                {(product.dailyMinOrder ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">Minimum {product.dailyMinOrder} per delivery day</p>
                )}
                {onNavigateToOrder && (
                  <button
                    type="button"
                    onClick={() => onNavigateToOrder(product.id)}
                    className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4A574] to-[#E8C4A2] px-4 py-2.5 text-sm font-semibold text-[#333] shadow-sm transition-all hover:shadow-md active:scale-95"
                  >
                    <ShoppingCart className="h-4 w-4" /> Order this
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
          <p className="text-neutral-500">No products in this category.</p>
        </div>
      ) : (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          itemLabel="products"
          className="mt-6"
        />
      )}
    </CustomerPageLayout>
  );
}
