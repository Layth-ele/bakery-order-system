import { useState, useMemo, useCallback } from "react";
import { usePaginatedOrders } from "../../hooks/usePaginatedOrders";
import { scrollToElement } from "../../utils/scrollUtils";
import { useRef, useEffect } from "react";
import { Pagination } from "../../components/ui/pagination";
import {
  Package,
  Tag,
  DollarSign,
  ArrowLeft,
  ShoppingCart,
} from "lucide-react";
import type { Product, Category } from "../../types";
import {
  CustomerPageLayout,
  StatCard,
} from "../../components/customer/CustomerPageLayout";
import { toast } from 'sonner';

interface ProductsCatalogProps {
  products: Product[];
  categories: Category[];
  onNavigateBack: () => void;
  onNavigateToOrder?: (productId: string) => void;
  onRefresh?: () => Promise<void>; // ✅ NEW: Refresh callback
}

export function ProductsCatalog({
  products,
  categories,
  onNavigateBack,
  onNavigateToOrder,
  onRefresh, // ✅ NEW: Destructure onRefresh
}: ProductsCatalogProps): JSX.Element | null {
  const [selectedCategory, setSelectedCategory] =
    useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false); // ✅ NEW: Refresh state

  // ✅ NEW: Refresh handler
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
      toast.success("Products refreshed", { duration: 3000 });
    } catch (error) {
      console.error("Error refreshing products:", error);
      toast.error("Failed to refresh products", { duration: 3000 });
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // ✅ PERFORMANCE: Memoize filtered products to prevent recalculation on every render
  // Filter products based on selected category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory === "all") {
        if (p.categoryId === "cat-0") {
          return true;
        }
        return !p.id.endsWith("-discounted");
      } else if (selectedCategory === "cat-0") {
        return p.categoryId === "cat-0";
      } else {
        return (
          p.categoryId === selectedCategory &&
          !p.id.endsWith("-discounted")
        );
      }
    });
  }, [products, selectedCategory]);

  // ✅ PERFORMANCE: Memoize statistics to prevent recalculation on every render
  // Calculate statistics
  // ── Pagination ────────────────────────────────────────────────────────
  const productGridRef = useRef<HTMLDivElement>(null);
  const PRODUCTS_PAGE_SIZE = 12;
  const {
    currentItems: pagedProducts,
    currentPage: productPage,
    totalPages: productTotalPages,
    totalItems: productTotalItems,
    handlePageChange: handleProductPageChange,
  } = usePaginatedOrders(filteredProducts, PRODUCTS_PAGE_SIZE);

  // Scroll to grid top on page change
  useEffect(() => {
    if (productPage > 1 && productGridRef.current) {
      scrollToElement(productGridRef.current, 8);
    }
  }, [productPage]);

  const stats = useMemo(
    () => ({
      total: products.filter(
        (p) => !p.id.endsWith("-discounted"),
      ).length,
      categories: categories.length,
      discounted: products.filter(
        (p) => p.categoryId === "cat-0",
      ).length,
      filtered: filteredProducts.length,
    }),
    [products, categories.length, filteredProducts.length],
  );

  // ✅ PERFORMANCE: Memoize handler to create stable reference
  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      setSelectedCategory(categoryId);
    },
    [],
  );

  return (
    <CustomerPageLayout
      icon={Package}
      title="Product Catalog"
      subtitle="Browse our full collection of premium bakery products"
      sectionTitle="Product Overview"
      onRefresh={onRefresh ? handleRefresh : undefined} // ✅ NEW: Pass refresh handler
      isRefreshing={isRefreshing} // ✅ NEW: Pass refresh state
    >
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard
          icon={Package}
          label="Total Products"
          value={stats.total}
          color="tan"
        />
        <StatCard
          icon={Tag}
          label="Categories"
          value={stats.categories}
          color="blue"
        />
        <StatCard
          icon={DollarSign}
          label="Discounted"
          value={stats.discounted}
          color="orange"
        />
        <StatCard
          icon={ShoppingCart}
          label="Showing"
          value={stats.filtered}
          color="green"
        />
      </div>

      {/* Category Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] px-6 py-3.5 -mx-6 -mt-6 mb-4 rounded-t-2xl">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">
            Filter by Category
          </h2>
        </div>

        {/* Flexbox Layout for All Screen Sizes */}
        <div className="flex flex-wrap gap-3 pb-2">
          <button
            type="button"
            onClick={() => handleCategoryChange("all")}
            className={`px-6 py-3 rounded-lg whitespace-nowrap transition-all font-medium shadow-sm ${
              selectedCategory === "all"
                ? "bg-gradient-to-r from-[#D4A574] to-[#C8A882] text-white shadow-md"
                : "bg-white text-neutral-700 hover:bg-[#D4A574]/10 border-2 border-[#D4A574]/30"
            }`}
          >
            All Products
          </button>
          {categories
            .sort((a, b) => a.order - b.order)
            .map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() =>
                  handleCategoryChange(category.id)
                }
                className={`px-6 py-3 rounded-lg whitespace-nowrap transition-all font-medium shadow-sm ${
                  selectedCategory === category.id
                    ? "bg-gradient-to-r from-[#D4A574] to-[#C8A882] text-white shadow-md"
                    : "bg-white text-neutral-700 hover:bg-[#D4A574]/10 border-2 border-[#D4A574]/30"
                }`}
              >
                {category.id === "cat-0" && (
                  <span className="mr-2">🔥</span>
                )}
                {category.id === "cat-0"
                  ? "DISCOUNTED ITEMS"
                  : category.name}
              </button>
            ))}
        </div>
      </div>

      {/* Products Grid */}
      <div ref={productGridRef} className="scroll-mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pagedProducts.map((product) => {
          const hasDiscount =
            (product.discount ?? 0) && (product.discount ?? 0) > 0;
          const originalPrice = hasDiscount
            ? (product.retail ?? product.price ?? 0) / (1 - (product.discount ?? 0) / 100)
            : null;

          return (
            <div
              key={product.id}
              className="group bg-gradient-to-br from-[#2c2c2c] to-[#1a1a1a] rounded-2xl overflow-hidden border-2 border-[#D4A574]/30 hover:border-[#D4A574] transition-all duration-300 hover:shadow-2xl hover:shadow-[#D4A574]/20 hover:-translate-y-1"
            >
              {/* Product Image */}
              <div className="relative h-48 bg-gradient-to-br from-[#3d3832] to-[#2c2416] overflow-hidden">
                <img
                  src={`https://via.placeholder.com/400x300/E8C4A2/333333?text=${encodeURIComponent((product.name ?? ""))}`}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x300/E8C4A2/333333?text=No+Image`;
                  }}
                />

                {/* Discount Badge */}
                {hasDiscount && (
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-[#FF6B6B] to-[#FF5252] text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg">
                    🔥 {(product.discount ?? 0)}% OFF
                  </div>
                )}

                {/* Category Badge */}
                <div className="absolute bottom-3 left-3 bg-[#1a1a1a]/90 backdrop-blur-sm text-[#D4A574] px-3 py-1 rounded-full text-xs font-semibold border border-[#D4A574]/50">
                  {categories.find(
                    (c) => c.id === product.categoryId,
                  )?.name || "Product"}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-5">
                {/* Product Name */}
                <h3 className="text-[#e8dcc8] font-bold text-lg mb-2 group-hover:text-[#D4A574] transition-colors">
                  {product.name}
                </h3>

                {/* Description (if available) */}
                {product.description && (
                  <p className="text-neutral-400 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Price Section */}
                <div className="mb-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-[#D4A574]">
                      ${(product.retail ?? 0).toFixed(2)}
                    </span>
                    {originalPrice && (
                      <span className="text-neutral-500 line-through text-sm">
                        ${originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-neutral-400 text-xs">
                    per unit
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#D4A574]/50 to-transparent mb-3"></div>

                {/* Additional Info */}
                <div className="space-y-2">
                  {/* Daily Minimum Order */}
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4 text-[#D4A574]" />
                    <span className="text-neutral-400">
                      Min Order:
                    </span>
                    <span className="text-[#e8dcc8] font-semibold">
                      {(product.dailyMinOrder ?? 0)} per day
                    </span>
                  </div>

                  {/* Product ID (for reference) */}
                  <div className="flex items-center gap-2 text-xs">
                    <Package className="w-3 h-3 text-neutral-500" />
                    <span className="text-neutral-500">
                      SKU: {product.id}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-4 pt-4 border-t border-[#D4A574]/20">
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onNavigateToOrder?.(product.id);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#D4A574] to-[#C8A882] text-white rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl hover:from-[#e8a849] hover:to-[#D4A574] transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Go to Place Order</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={productPage}
        totalPages={productTotalPages}
        totalItems={productTotalItems}
        pageSize={PRODUCTS_PAGE_SIZE}
        onPageChange={handleProductPageChange}
        itemLabel="products"
        className="mt-6"
      />

      {/* No Products Message */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 text-lg">
            No products found in this category
          </p>
        </div>
      )}
    </CustomerPageLayout>
  );
}