/**
 * Production To Do Sheet Component
 *
 * ✅ REFACTORED (Feb 9, 2026): Performance & Safety Alignment
 * ✅ UPDATED (Mar 8, 2026): Added navigation cards for pending order management
 * ✅ RESTORED (Mar 9, 2026): Full weekly production schedule implementation
 * ✅ FIXED (Apr 25, 2026): Bug 2 — switched to useCachedActiveOrders (no 100-order cap)
 * ✅ FIXED (Apr 25, 2026): Bug 4 — midnight date refresh + selectedDayIndex sync
 * ✅ FIXED (Apr 25, 2026): Bug 11 — PDF export generates a real downloadable file
 * ✅ FIXED (Apr 25, 2026): Bug 12 — removed phantom `categories` memo dependency
 *
 * Real-time monitoring page showing IN_PROCESS orders for production planning
 */

import {useState, useMemo, useCallback, memo, useEffect, useRef} from 'react'
import {ClipboardList, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Package, Briefcase, Users, Printer, FileDown} from 'lucide-react'
import { StatCard } from '../shared/StatCard';
import { AdminPageLayout } from './AdminPageLayout';
import { Order, Product, Category } from '../../types';
import { useCachedActiveOrders } from '../../hooks/useCachedFirebase'  // BUG 2 FIX
import { useCachedProducts } from '../../hooks/useCachedProducts';
import { useCachedCategories } from '../../hooks/useCachedCategories';
import { isProductionEligible } from '../../utils/orderSelectors';
import { getISOWeekInfo, getWeekDayDate } from '../../utils/weekUtils';
import { getProductionStatusForDate } from '../../utils/time/vancouverCutoff';
import { getNowInVancouver } from '../../utils/timezone';
import { openProductionPrintView } from '../../utils/pdf/productionToDoPrint';
import type { AdminPage } from '../../config/adminNavigation';

// (Pass 1 cleanup) — removed duplicate imports of useCachedProducts/useCachedCategories that
// were causing TS2300 errors. They were already imported above on lines 20-21.

import {
  type ProductSummary,
  type DayInfo,
  calculateDayInfo,
  calculateProductSummary,
  calculateCustomerData,
  calculateCustomerCounts,
  groupProductsByCategory,
  getOrdersForDate,
} from '../../services/production/productionAggregationService';

interface ProductionToDoSheetProps {
  isActive: boolean;
  setCurrentPage?: (page: AdminPage) => void;
}

function getDynamicProductionDates(): Date[] {
  const today = getNowInVancouver();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 5);
  
  const allDates: Date[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    allDates.push(date);
  }
  
  const doneDates: Date[] = [];
  const lockedDates: Date[] = [];
  const openDates: Date[] = [];
  
  allDates.forEach(date => {
    const status = getProductionStatusForDate(date);
    if (status === 'done') {
      doneDates.push(date);
    } else if (status === 'locked') {
      lockedDates.push(date);
    } else if (status === 'open') {
      openDates.push(date);
    }
  });
  
  const last2Done = doneDates.slice(-2);
  const next2Locked = lockedDates.slice(0, 2);
  const next3Open = openDates.slice(0, 3);
  
  const dates: Date[] = [];
  dates.push(...last2Done);
  dates.push(...next2Locked);
  dates.push(...next3Open);
  
  while (dates.length < 7) {
    const lastDate = dates[dates.length - 1] || today;
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + 1);
    dates.push(nextDate);
  }
  
  return dates.slice(0, 7);
}

function getStatusBadgeClasses(status: 'done' | 'locked' | 'open') {
  switch (status) {
    case 'done':
      return { bg: 'bg-green-500', text: 'text-white', label: 'Delivered', icon: CheckCircle };
    case 'locked':
      return { bg: 'bg-red-500', text: 'text-white', label: 'In Production', icon: AlertCircle };
    case 'open':
      return { bg: 'bg-blue-500', text: 'text-white', label: 'Accepting Orders', icon: ChevronDown };
  }
}

const WORKLOAD_COLORS = {
  'Low': 'bg-green-100 text-green-800',
  'Medium': 'bg-blue-100 text-blue-800',
  'High': 'bg-orange-100 text-orange-800',
  'Very High': 'bg-red-100 text-red-800',
} as const;

const getWorkloadColor = (level: keyof typeof WORKLOAD_COLORS): string => {
  return WORKLOAD_COLORS[level] || 'bg-gray-100 text-gray-800';
};

interface DayCardProps {
  dayInfo: DayInfo;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}

const DayCard = memo(({ dayInfo, index, isSelected, onClick }: DayCardProps) => {
  const status = useMemo(() => getProductionStatusForDate(dayInfo.date), [dayInfo.date]);
  const badge = useMemo(() => getStatusBadgeClasses(status), [status]);
  const Icon = badge.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        relative p-2 sm:p-3 rounded-xl border-2 transition-all w-full text-left
        ${isSelected
          ? 'border-[#D4A574] bg-gradient-to-br from-[#FFF8DC] to-[#FAEBD7] shadow-md ring-1 ring-[#D4A574]/30'
          : 'border-gray-200 bg-white hover:border-[#D4A574]/50 hover:bg-gray-50'
        }
      `}
    >
      {/* Status icon — top-right corner */}
      <div className={`absolute top-1 right-1 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full ${badge.bg}`}>
        <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
      </div>

      {/* Day + Date */}
      <div className="pr-4 sm:pr-5 mb-1.5">
        <div className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none">
          {dayInfo.dayShort}
        </div>
        <div className="text-base sm:text-lg font-bold text-[#8B6F47] leading-tight">
          {dayInfo.date.getDate()}
        </div>
        <div className="text-[9px] sm:text-[10px] text-gray-400 leading-none">
          {dayInfo.date.toLocaleDateString('en-US', { month: 'short' })}
        </div>
      </div>

      {/* Stats — compact on mobile */}
      <div className="space-y-0.5 sm:space-y-1 mb-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] text-gray-500 leading-none">Ord</span>
          <span className="text-[10px] sm:text-xs font-bold text-[#8B6F47]">{dayInfo.orderCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] text-gray-500 leading-none">Itm</span>
          <span className="text-[10px] sm:text-xs font-bold text-[#8B6F47]">{dayInfo.productCount}</span>
        </div>
      </div>

      {/* Workload badge */}
      <div className={`px-1 py-0.5 rounded text-[8px] sm:text-[10px] font-semibold text-center leading-none ${getWorkloadColor(dayInfo.workloadLevel)}`}>
        {['Low', 'Medium', 'High', 'Very High'].includes(dayInfo.workloadLevel)
          ? dayInfo.workloadLevel.slice(0, 3).toUpperCase()
          : '—'}
      </div>
    </button>
  );
});
DayCard.displayName = 'DayCard';

export function ProductionToDoSheet({ isActive, setCurrentPage }: ProductionToDoSheetProps): JSX.Element | null {
  // BUG 2 FIX: use dedicated active-orders hook — no 100-order cap, status-filtered at Firestore level
  const { data: allOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useCachedActiveOrders(true);
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useCachedProducts();
  const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useCachedCategories();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // BUG 4 FIX: Force weekDates recompute at Vancouver midnight so date window never goes stale
  const [midnightToken, setMidnightToken] = useState(0);
  const midnightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function scheduleMidnightRefresh() {
      const now = getNowInVancouver();
      const next = new Date(now);
      next.setDate(now.getDate() + 1);
      next.setHours(0, 0, 30, 0); // 00:00:30 Vancouver — give Firestore a moment
      const msUntilMidnight = next.getTime() - now.getTime();
      midnightTimerRef.current = setTimeout(() => {
        setMidnightToken(t => t + 1);
        scheduleMidnightRefresh(); // reschedule for the following midnight
      }, msUntilMidnight);
    }
    scheduleMidnightRefresh();
    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchOrders(), refetchProducts(), refetchCategories()]);
      setLastUpdate(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchOrders, refetchProducts, refetchCategories]);
  
  const inProcessOrders = useMemo(() => {
    return allOrders.filter(order => isProductionEligible(order));
  }, [allOrders]);

  // Refresh dates when isActive changes (user navigates to page) OR at Vancouver midnight
  const weekDates = useMemo(() => getDynamicProductionDates(), [isActive, midnightToken]); // BUG 4 FIX

  const dayInfos = useMemo<DayInfo[]>(() => {
    if (weekDates.length === 0) return [];
    // Note: products are only needed for productionSummary, not for day cards
    // Day cards show order counts from inProcessOrders regardless of product catalog

    return weekDates.map((date, index) => {
      const baseInfo = calculateDayInfo(
        inProcessOrders,
        date,
        index,
        getProductionStatusForDate,
        getWeekDayDate
      );
      
      const dayIndex = date.getDay();
      const monBasedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      
      return {
        ...baseInfo,
        dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][monBasedIndex],
        dayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][monBasedIndex],
      };
    });
  }, [inProcessOrders, weekDates]);

  // Default to today's index (or first upcoming locked/open day)
  // Compute today index inline for useState initializer
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const dates = getDynamicProductionDates();
    const idx = dates.findIndex(d => {
      const dd = new Date(d);
      dd.setHours(0,0,0,0);
      return dd.getTime() === today.getTime();
    });
    return idx !== -1 ? idx : 0;
  });

  // BUG 4 FIX: Re-anchor selectedDayIndex to today whenever weekDates refreshes
  // (midnight rollover or page re-activation). Without this the index remains
  // pointing to whatever day it was when the component first mounted.
  useEffect(() => {
    const today = getNowInVancouver();
    today.setHours(0, 0, 0, 0);
    const idx = weekDates.findIndex(d => {
      const dd = new Date(d);
      dd.setHours(0, 0, 0, 0);
      return dd.getTime() === today.getTime();
    });
    setSelectedDayIndex(idx >= 0 ? idx : 0);
  }, [weekDates]);

  // Recompute todayIndex when weekDates refreshes (page re-activation)
  const todayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const idx = weekDates.findIndex(d => {
      const dd = new Date(d);
      dd.setHours(0,0,0,0);
      return dd.getTime() === today.getTime();
    });
    return idx >= 0 ? idx : 0;
  }, [weekDates]);
  const selectedDayInfo = dayInfos[selectedDayIndex];

  const productionSummary = useMemo<ProductSummary[]>(() => {
    if (!selectedDayInfo) return [];

    return calculateProductSummary(
      inProcessOrders,
      selectedDayInfo.date,
      products,
      categories,
      getWeekDayDate
    );
  }, [inProcessOrders, selectedDayInfo, products, categories]);

  const productsByCategory = useMemo(() => {
    return groupProductsByCategory(productionSummary);
  }, [productionSummary]); // BUG 12 FIX: `categories` was listed but never read by groupProductsByCategory

  const customerCounts = useMemo(() => {
    if (!selectedDayInfo) return { commercial: 0, individual: 0 };

    return calculateCustomerCounts(
      inProcessOrders,
      selectedDayInfo.date,
      getWeekDayDate
    );
  }, [inProcessOrders, selectedDayInfo]);

  const toggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }, []);

  const handlePrint = useCallback(() => {
    if (!selectedDayInfo) return;

    const ordersForDay = getOrdersForDate(inProcessOrders, selectedDayInfo.date, getWeekDayDate);
    const { week, year } = getISOWeekInfo(selectedDayInfo.date);
    
    openProductionPrintView({
      date: selectedDayInfo.date,
      weekLabel: `Week ${week}, ${year}`,
      timezoneLabel: 'America/Vancouver',
      orders: ordersForDay,
      products,
      categories,
    });
  }, [selectedDayInfo, inProcessOrders, products, categories]);

  // BUG 11 FIX: Generate a real downloadable PDF instead of opening the browser print dialog.
  // Previously handleExportPDF was byte-for-byte identical to handlePrint — both called
  // openProductionPrintView, so the PDF button was non-functional.
  const handleExportPDF = useCallback(async () => {
    if (!selectedDayInfo) return;

    const ordersForDay = getOrdersForDate(inProcessOrders, selectedDayInfo.date, getWeekDayDate);
    const { week, year } = getISOWeekInfo(selectedDayInfo.date);
    const dateLabel = selectedDayInfo.date.toLocaleDateString('en-CA'); // YYYY-MM-DD

    try {
      // Dynamically import jsPDF — only loaded when user clicks Export PDF
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = 210;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = 18;

      // ── Header ─────────────────────────────────────────────────────────────
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Production Sheet', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${selectedDayInfo.dayName}, ${dateLabel}  ·  Week ${week}, ${year}  ·  America/Vancouver`, margin, y);
      y += 5;

      // Horizontal rule
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // ── Summary stats ──────────────────────────────────────────────────────
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Orders: ${selectedDayInfo.orderCount}`, margin, y);
      doc.text(`Total items: ${selectedDayInfo.productCount}`, margin + 45, y);
      doc.text(`Workload: ${selectedDayInfo.workloadLevel}`, margin + 100, y);
      y += 10;

      // ── Product list grouped by category ───────────────────────────────────
      const grouped = Object.entries(
        productsByCategory as Record<string, Array<{ productName: string; quantity: number; orderCount: number }>>,
      );

      for (const [categoryName, items] of grouped) {
        // Category header
        doc.setFillColor(139, 111, 71); // brand brown
        doc.rect(margin, y - 4, contentW, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(categoryName.toUpperCase(), margin + 2, y + 0.5);
        const catTotal = items.reduce((s, p) => s + p.quantity, 0);
        doc.text(`Total: ${catTotal}`, pageW - margin - 2, y + 0.5, { align: 'right' });
        y += 9;

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        for (const product of items) {
          if (y > 270) { doc.addPage(); y = 18; }
          doc.text(product.productName, margin + 3, y);
          doc.text(
            `${product.quantity} units  (${product.orderCount} order${product.orderCount !== 1 ? 's' : ''})`,
            pageW - margin - 2, y, { align: 'right' },
          );
          y += 6;
        }
        y += 3;
      }

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Generated ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} (Vancouver)`,
        margin, 290,
      );

      doc.save(`production-${dateLabel}.pdf`);
    } catch (err) {
      console.error('❌ [ProductionToDoSheet] PDF export failed:', err);
      // Graceful degradation — fall back to print view so admin is never blocked
      const ordersForDay2 = getOrdersForDate(inProcessOrders, selectedDayInfo.date, getWeekDayDate);
      const { week: w2, year: y2 } = getISOWeekInfo(selectedDayInfo.date);
      openProductionPrintView({
        date: selectedDayInfo.date,
        weekLabel: `Week ${w2}, ${y2}`,
        timezoneLabel: 'America/Vancouver',
        orders: ordersForDay2,
        products,
        categories,
      });
    }
  }, [selectedDayInfo, inProcessOrders, products, categories, productsByCategory]);

  const loading = ordersLoading || productsLoading || categoriesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="size-8 animate-spin text-gray-400" />
          <p className="text-gray-600">Loading production schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminPageLayout
      icon={ClipboardList}
      title="Production To Do"
      subtitle="Weekly production schedule with confirmed payments"
      sectionTitle="Production Overview"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0 mb-4">
          <button
            onClick={handlePrint}
            disabled={!selectedDayInfo || selectedDayInfo.orderCount === 0}
            className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-[#D4A574] hover:bg-[#C49564] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Print</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!selectedDayInfo || selectedDayInfo.orderCount === 0}
            className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-[#8B6F47] hover:bg-[#7A5F3C] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">PDF</span>
          </button>
        </div>

        {selectedDayInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <StatCard icon={ClipboardList} label="Total Orders" value={selectedDayInfo.orderCount} color="orange" />
            <StatCard icon={Briefcase} label="Commercial" value={customerCounts.commercial} color="blue" />
            <StatCard icon={Users} label="Individual" value={customerCounts.individual} color="purple" />
            <StatCard icon={Package} label="Total Items" value={selectedDayInfo.productCount} color="green" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border-2 border-[#D4A574]/30 shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#8B6F47]">Production Schedule</h2>
          <div className="text-xs sm:text-sm text-gray-600">
            Select a day to view production details
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2">
          {dayInfos.map((dayInfo, index) => (
            <DayCard
              key={index}
              dayInfo={dayInfo}
              index={index}
              isSelected={index === selectedDayIndex}
              onClick={() => setSelectedDayIndex(index)}
            />
          ))}
        </div>
      </div>

      {selectedDayInfo && (
        <div className="bg-white rounded-xl border border-[#D4A574]/25 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white truncate">
              Production List — {selectedDayInfo.dayShort}, {selectedDayInfo.date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </h2>
          </div>

          <div className="p-3 sm:p-6">
            {productionSummary.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">
                  No Production Scheduled
                </h3>
                <p className="text-sm sm:text-base text-gray-500">
                  No orders scheduled for production on this day.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {Object.entries(productsByCategory).map(([categoryName, productsInCategory]) => {
                  const categoryProducts = productsInCategory as any[];
                  const isExpanded = expandedCategories.has(categoryName);
                  const totalQty = categoryProducts.reduce((sum, p) => sum + p.quantity, 0);

                  return (
                    <div key={categoryName} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(categoryName)}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574] flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A574] flex-shrink-0" />
                          )}
                          <span className="font-bold text-[#8B6F47] uppercase text-xs sm:text-sm truncate">{categoryName}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">({categoryProducts.length})</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500 hidden sm:inline">Total:</span>
                          <span className="font-bold text-[#8B6F47] text-sm sm:text-base">{totalQty}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2 sm:p-4 space-y-2">
                          {categoryProducts.map((product, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between py-2 px-2 sm:px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1 min-w-0 mr-2">
                                <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{product.name}</div>
                                <div className="text-[10px] sm:text-xs text-gray-500">
                                  {product.orderCount} order{product.orderCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg sm:text-xl font-bold text-[#8B6F47]">{product.quantity}</div>
                                <div className="text-[10px] sm:text-xs text-gray-500">units</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
