/**
 * ProductDetailsModal — Modern bakery-brand product details
 * ✅ Redesigned: light cream bg, tan/gold palette, clean card sections
 * ✅ Sticky quick-add bar, horizontal related products scroll
 */

import { useState, useEffect } from "react";
import {
  Package, AlertCircle, ShoppingCart, Minus, Plus,
  Check, Clock, Box, Leaf, CalendarDays,
} from "lucide-react";
import { StyleModalShell } from "../../../ui/modals/StyleModalShell";
import { ProductImagePlaceholder } from "../../shared/ProductImagePlaceholder";
import { DAYS } from "../../../constants/tableColumns";
import { getWeekDayDate, formatShortDate } from "../../../utils/weekUtils";
import { CloseFooter } from "../../../ui/modals/ModalFooterButtons";
import type { Product } from "../../../types";
import { trackModalOpen } from "../../../ui/modals/modalRegistry";

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  products?: Product[];
  onAddToCart?: (productId: string, dayKey: string, quantity: number) => void;
  lockedDaysForWeek?: boolean[];
  selectedWeek?: number;
  selectedYear?: number;
}

interface NutritionalInfo {
  calories: number; protein: number; carbs: number; fat: number;
  fiber: number; sugar: number; sodium: number; servingSize: string;
}

interface ProductWithNutrition extends Product {
  nutrition?: NutritionalInfo;
  allergens?: string[];
  dietary?: string[];
  relatedProductIds?: string[];
}

const COMMON_ALLERGENS = [
  { id: "wheat",     label: "Wheat",      icon: "🌾" },
  { id: "milk",      label: "Dairy",      icon: "🥛" },
  { id: "eggs",      label: "Eggs",       icon: "🥚" },
  { id: "nuts",      label: "Tree Nuts",  icon: "🌰" },
  { id: "peanuts",   label: "Peanuts",    icon: "🥜" },
  { id: "soy",       label: "Soy",        icon: "🫘" },
  { id: "fish",      label: "Fish",       icon: "🐟" },
  { id: "shellfish", label: "Shellfish",  icon: "🦐" },
];

const DIETARY_LABELS = [
  { id: "vegan",       label: "Vegan",       icon: "🌱", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "vegetarian",  label: "Vegetarian",  icon: "🥗", bg: "bg-green-100 text-green-800 border-green-200" },
  { id: "gluten-free", label: "Gluten Free", icon: "✦",  bg: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "dairy-free",  label: "Dairy Free",  icon: "✦",  bg: "bg-sky-100 text-sky-800 border-sky-200" },
  { id: "organic",     label: "Organic",     icon: "♻️", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "low-sugar",   label: "Low Sugar",   icon: "✦",  bg: "bg-purple-100 text-purple-800 border-purple-200" },
];

const getMockNutrition = (name: string): NutritionalInfo | null => {
  const mock: Record<string, NutritionalInfo> = {
    croissant: { calories: 231, protein: 4.7, carbs: 26.1, fat: 12.0, fiber: 1.5, sugar: 6.0, sodium: 424, servingSize: "1 piece (57g)" },
    baguette:  { calories: 289, protein: 9.0, carbs: 58.0, fat: 2.0,  fiber: 2.5, sugar: 2.0, sodium: 680, servingSize: "100g" },
  };
  return mock[name.toLowerCase()] ?? null;
};

const getMockAllergens = (name: string): string[] => {
  const n = name.toLowerCase();
  const a: string[] = [];
  if (n.includes("croissant") || n.includes("bread") || n.includes("baguette")) a.push("wheat","eggs","milk");
  if (n.includes("nut") || n.includes("almond")) a.push("nuts");
  return a;
};

const getMockDietary = (name: string): string[] => {
  const n = name.toLowerCase();
  const d: string[] = [];
  if (n.includes("vegan"))       d.push("vegan","dairy-free");
  if (n.includes("gluten-free")) d.push("gluten-free");
  if (n.includes("organic"))     d.push("organic");
  return d;
};

export function ProductDetailsModal({
  product, onClose, products, onAddToCart,
  lockedDaysForWeek = [],
  selectedWeek,
  selectedYear,
}: ProductDetailsModalProps): JSX.Element | null {
  // Guard: product may be undefined if opened before data loads
  if (!product) return null;
  const [quantity, setQuantity]       = useState((product.dailyMinOrder ?? 0) || 1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [nutrition, setNutrition]     = useState<NutritionalInfo | null>(null);
  const [allergens, setAllergens]     = useState<string[]>([]);
  const [dietary, setDietary]         = useState<string[]>([]);
  // Day selector — default to first unlocked day
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const first = DAYS.find((_, i) => !lockedDaysForWeek[i]);
    return first?.key ?? DAYS[0].key;
  });
  const [addedDays, setAddedDays]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    trackModalOpen("PRODUCT_DETAILS", {
      product_id: product.id,
      product_name: product.name ?? "",
      product_category: product.categoryId,
      product_price: product.retail ?? product.price ?? 0,
      daily_min_order: product.dailyMinOrder ?? 0,
    });
  }, [product]);

  useEffect(() => {
    const p = product as ProductWithNutrition;
    // ✅ Use real saved data — fall back to null/empty (no mock data in production)
    setNutrition(p.nutrition ?? null);
    setAllergens(p.allergens ?? []);
    setDietary(p.dietary   ?? []);
  }, [product]);

  const handleQuickAdd = (dayKey?: string) => {
    if (!onAddToCart) return;
    const day = dayKey ?? selectedDay;
    onAddToCart(product.id, day, quantity);
    setAddedDays(prev => ({ ...prev, [day]: true }));
    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
      setAddedDays(prev => ({ ...prev, [day]: false }));
    }, 1800);
  };

  const minQty = (product.dailyMinOrder ?? 0) || 1;
  const price  = product.retail ?? 0;

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onClose}
      title={product.name ?? "Product Details"}
      icon={<Package className="w-5 h-5" />}
      footer={<CloseFooter onClose={onClose} />}
    >
      {/* ── Light cream page matching app palette ── */}
      <div className="bg-gradient-to-br from-[#faf8f5] to-[#f5f0e8] -mx-4 sm:-mx-6 -mt-2 px-4 sm:px-6 pb-4">

        {/* Hero image */}
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-44 sm:h-60 object-cover rounded-2xl mb-4 shadow-md border border-[#D4A574]/20"
          />
        ) : (
          <ProductImagePlaceholder
            size="lg"
            className="w-full h-44 sm:h-60 mb-4 shadow-sm"
          />
        )}

        {/* Dietary badges */}
        {dietary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {dietary.map(id => {
              const d = DIETARY_LABELS.find(x => x.id === id);
              return d ? (
                <span key={id} className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${d.bg}`}>
                  {d.icon} {d.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Price + Min Order — 2 cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3.5 border border-[#D4A574]/30 shadow-sm">
            <p className="text-[10px] sm:text-xs text-[#8B6F47]/70 font-semibold uppercase tracking-wide mb-1">Unit Price</p>
            <p className="text-[#8B6F47] text-xl sm:text-2xl font-bold">${price.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-[#D4A574]/30 shadow-sm">
            <p className="text-[10px] sm:text-xs text-[#8B6F47]/70 font-semibold uppercase tracking-wide mb-1">Daily Minimum</p>
            <p className="text-[#8B6F47] text-xl sm:text-2xl font-bold">{product.dailyMinOrder ?? 0}<span className="text-sm font-normal text-[#8B6F47]/60 ml-1">units</span></p>
          </div>
        </div>

        {/* Quick Add to Order — with 7-day selector */}
        {onAddToCart && (
          <div className="bg-white rounded-2xl border-2 border-[#D4A574]/40 shadow-sm p-4 mb-4">
            <p className="text-xs font-bold text-[#8B6F47] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Quick Add to Order
            </p>

            {/* ── Day Selector ── */}
            <div className="mb-3">
              <p className="text-[10px] text-[#8B6F47]/60 mb-1.5 uppercase tracking-wide font-medium">Select Day</p>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((day, idx) => {
                  const locked   = lockedDaysForWeek[idx] ?? false;
                  const active   = selectedDay === day.key;
                  const justAdded = addedDays[day.key];
                  return (
                    <button
                      key={day.key}
                      type="button"
                      disabled={locked}
                      onClick={() => setSelectedDay(day.key)}
                      className={`relative flex flex-col items-center py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                        locked
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                          : justAdded
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                          : active
                          ? 'bg-gradient-to-b from-[#D4A574] to-[#B8935E] text-white border-[#D4A574] shadow-sm scale-105'
                          : 'bg-[#faf8f5] text-[#8B6F47] border-[#D4A574]/30 hover:border-[#D4A574] hover:bg-[#f5f0e8]'
                      }`}
                      title={locked ? `${day.label} is locked` : day.label}
                    >
                      <span className="leading-none">{day.label}</span>
                      {selectedWeek && selectedYear ? (
                        <span className="text-[8px] leading-none mt-0.5 opacity-75">
                          {formatShortDate(getWeekDayDate(selectedWeek, idx, selectedYear))}
                        </span>
                      ) : null}
                      {justAdded && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-600 rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </span>
                      )}
                      {locked && !justAdded && <span className="text-[8px] leading-none opacity-60">🔒</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Quantity + Add Button ── */}
            <div className="flex items-center gap-2.5">
              {/* Qty stepper */}
              <div className="flex items-center bg-[#FAF5EE] border border-[#D4A574]/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(minQty, q - 1))}
                  disabled={quantity <= minQty}
                  className="px-2.5 py-2 text-[#8B6F47] hover:bg-[#D4A574]/10 transition-colors disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(minQty, parseInt(e.target.value) || minQty))}
                  className="w-10 text-center bg-transparent text-[#3d3832] font-bold text-sm focus:outline-none"
                  min={minQty}
                />
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-2.5 py-2 text-[#8B6F47] hover:bg-[#D4A574]/10 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add button */}
              <button
                onClick={() => handleQuickAdd()}
                disabled={lockedDaysForWeek[DAYS.findIndex(d => d.key === selectedDay)] ?? false}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  addedToCart
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {addedToCart
                  ? <><Check className="w-4 h-4" /> Added to {DAYS.find(d => d.key === selectedDay)?.label}!</>
                  : <><ShoppingCart className="w-4 h-4" /> Add to {DAYS.find(d => d.key === selectedDay)?.label}</>}
              </button>
            </div>

            {/* Total preview */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#D4A574]/20">
              <span className="text-xs text-[#8B6F47]/60">{quantity} × ${price.toFixed(2)} on {DAYS.find(d => d.key === selectedDay)?.label}</span>
              <span className="text-[#8B6F47] font-bold">${(quantity * price).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-4 mb-3">
            <h3 className="text-xs font-bold text-[#8B6F47] uppercase tracking-wider mb-2">About this product</h3>
            <p className="text-[#4a3728] text-sm leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Storage + Shelf Life — side by side */}
        {(product.storageDescription || product.shelfLife) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {product.storageDescription && (
              <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#D4A574]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Box className="w-4 h-4 text-[#8B6F47]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#8B6F47] uppercase tracking-wide mb-1">Storage</p>
                  <p className="text-sm text-[#4a3728]">{product.storageDescription}</p>
                </div>
              </div>
            )}
            {product.shelfLife && (
              <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#D4A574]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-[#8B6F47]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#8B6F47] uppercase tracking-wide mb-1">Shelf Life</p>
                  <p className="text-sm text-[#4a3728]">{product.shelfLife}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ingredients */}
        {product.ingredients && (
          <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-4 mb-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4A574]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Leaf className="w-4 h-4 text-[#8B6F47]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#8B6F47] uppercase tracking-wide mb-1">Ingredients</p>
              <p className="text-sm text-[#4a3728] leading-relaxed">{product.ingredients}</p>
            </div>
          </div>
        )}

        {/* Allergens */}
        {allergens.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
            <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Contains Allergens
            </h3>
            <div className="flex flex-wrap gap-2">
              {allergens.map(id => {
                const a = COMMON_ALLERGENS.find(x => x.id === id);
                return a ? (
                  <span key={id} className="bg-white border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-medium text-red-800">
                    <span>{a.icon}</span>{a.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Nutritional info */}
        {nutrition && (
          <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm p-4 mb-3">
            <h3 className="text-xs font-bold text-[#8B6F47] uppercase tracking-wider mb-3">
              Nutrition · <span className="font-normal normal-case text-[#8B6F47]/60">{nutrition.servingSize}</span>
            </h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: "Cal",     value: nutrition.calories,         unit: "",   color: "text-amber-600" },
                { label: "Protein", value: nutrition.protein,          unit: "g",  color: "text-emerald-600" },
                { label: "Carbs",   value: nutrition.carbs,            unit: "g",  color: "text-sky-600" },
                { label: "Fat",     value: nutrition.fat,              unit: "g",  color: "text-orange-500" },
              ].map(n => (
                <div key={n.label} className="bg-[#FAF8F5] rounded-lg p-2.5 text-center border border-[#D4A574]/15">
                  <p className={`text-base font-bold ${n.color}`}>{n.value}{n.unit}</p>
                  <p className="text-[9px] text-[#8B6F47]/60 mt-0.5 uppercase tracking-wide">{n.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Fiber",  value: `${nutrition.fiber}g` },
                { label: "Sugar",  value: `${nutrition.sugar}g` },
                { label: "Sodium", value: `${nutrition.sodium}mg` },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between bg-[#FAF8F5] rounded-lg px-2.5 py-2 border border-[#D4A574]/15">
                  <span className="text-[10px] text-[#8B6F47]/60">{n.label}</span>
                  <span className="text-xs font-bold text-[#4a3728]">{n.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </StyleModalShell>
  );
}
