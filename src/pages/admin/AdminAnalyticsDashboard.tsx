/**
 * 📊 ADMIN ANALYTICS DASHBOARD
 * ✅ MAR 27, 2026: Full rebuild — fixed Timestamp bug, 8 analytics sections
 */

import { useCachedOrders, useCachedCustomers, useCachedProducts } from '../../hooks/useCachedFirebase';
import { useMemo, useState, useCallback } from 'react';
import { useSalesAnalytics, TimePeriod } from '../../hooks/useSalesAnalytics';
import { withAdminGuard } from '../../guards/adminGuards';
import { AdminPageLayout } from '../../components/admin/AdminPageLayout';
import { StatCard } from '../../components/shared/StatCard';
import { toDate } from '../../utils/timestampFormatting';
import type { Order } from '../../types';
import type { User } from '../../hooks/useAuth';
import {
  TrendingUp, ShoppingBag, DollarSign, Users, Package,
  Calendar, Receipt, BarChart2, Star,
  CheckCircle, Clock, XCircle, AlertCircle, Wallet, X, ChevronRight, Sparkles,
} from 'lucide-react';

interface AdminAnalyticsDashboardProps {
  isActive?: boolean;
  user: User;
  onLogout?: () => void;
  onBack: () => void;
  allOrders?: Order[];
}

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'last7days',    label: 'Last 7 Days' },
  { value: 'last30days',   label: 'Last 30 Days' },
  { value: 'last3months',  label: 'Last 3 Months' },
  { value: 'last6months',  label: 'Last 6 Months' },
  { value: 'last12months', label: 'Last 12 Months' },
];

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-[#D4A574]/25 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#D4A574]/20">
        <Icon className="w-5 h-5 text-[#D4A574]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#8B6F47]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProgressRow({ label, count, total, color, extra }: {
  label: string; count: number; total: number; color: string; extra?: string;
}) {
  const pct = total > 0 ? Math.min((count / total) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-neutral-700">{label}</span>
        <span className="text-neutral-500">
          {count} <span className="text-neutral-400">({pct.toFixed(1)}%)</span>
          {extra && <span className="ml-1 text-neutral-300">{extra}</span>}
        </span>
      </div>
      <div className="w-full bg-neutral-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function toJSDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') return new Date(raw.seconds * 1000);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function getFilterRange(period: TimePeriod) {
  const end = new Date(); end.setHours(23,59,59,999);
  const start = new Date();
  if (period === 'last7days') start.setDate(start.getDate() - 7);
  else if (period === 'last30days') start.setDate(start.getDate() - 30);
  else if (period === 'last3months') start.setMonth(start.getMonth() - 3);
  else if (period === 'last6months') start.setMonth(start.getMonth() - 6);
  else start.setMonth(start.getMonth() - 12);
  start.setHours(0,0,0,0);
  return { start, end };
}

function AdminAnalyticsDashboardComponent({ user, onLogout }: AdminAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<TimePeriod>('last30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd]     = useState<string>('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [modalStart, setModalStart] = useState<string>('');
  const [modalEnd, setModalEnd]     = useState<string>('');

  // Derived Date objects for the hook
  const customStartDate = customStart ? new Date(customStart + 'T00:00:00') : undefined;
  const customEndDate   = customEnd   ? new Date(customEnd   + 'T23:59:59') : undefined;

  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useCachedOrders(true);
  const { data: customers = [], isLoading: customersLoading, refetch: refetchCustomers } = useCachedCustomers(true);
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useCachedProducts();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchOrders(), refetchCustomers(), refetchProducts()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchOrders, refetchCustomers, refetchProducts]);

  const analyticsData = useSalesAnalytics({ orders, period, customStart: customStartDate, customEnd: customEndDate });

  const extras = useMemo(() => {
    const { start, end } = period === 'custom' && customStartDate && customEndDate
      ? { start: customStartDate, end: customEndDate }
      : getFilterRange(period);
    const filtered = orders.filter(o => {
      const d = toJSDate(o.completedAt || o.approvedAt || o.createdAt);
      return d && d >= start && d <= end;
    });

    const totalServiceCharge = filtered.reduce((s, o) => s + (o.serviceCharge || 0), 0);
    const serviceChargeOrders = filtered.filter(o => (o.serviceCharge || 0) > 0).length;
    const waivedOrders = filtered.filter(o => o.serviceChargeWaived).length;
    const totalGST = filtered.reduce((s, o) => s + (o.gst || 0), 0);
    const totalDelivery = filtered.reduce((s, o) => s + (o.deliveryFee || 0), 0);
    const totalCreditIssued = filtered.reduce((s, o) => s + ((o as any).creditIssued || 0), 0);
    const totalCreditApplied = filtered.reduce((s, o) => s + ((o as any).creditApplied || 0), 0);

    const paymentTimes: number[] = [];
    filtered.filter(o => o.status === 'in_process' || o.status === 'completed').forEach(o => {
      const approved = toDate(o.approvedAt);
      const paid = toDate((o as any).paymentReceivedAt);
      if (approved && paid) {
        const days = (paid.getTime() - approved.getTime()) / 86400000;
        if (days >= 0 && days < 60) paymentTimes.push(days);
      }
    });
    const avgPaymentDays = paymentTimes.length > 0
      ? paymentTimes.reduce((s, d) => s + d, 0) / paymentTimes.length : 0;

    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dayKeys  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const dayCount: Record<string, number> = {};
    dayLabels.forEach(d => { dayCount[d] = 0; });
    filtered.forEach(o => {
      o.items?.forEach(item => {
        dayKeys.forEach((dk, i) => {
          dayCount[dayLabels[i]] += (item as any)[dk] || 0;
        });
      });
    });
    const maxDay = Math.max(...Object.values(dayCount), 1);

    const custMap: Record<string, number> = {};
    filtered.forEach(o => {
      const cid = o.customerId || o.customerEmail || '';
      if (cid) custMap[cid] = (custMap[cid] || 0) + 1;
    });
    const newCustomers = Object.values(custMap).filter(c => c === 1).length;
    const returningCustomers = Object.values(custMap).filter(c => c > 1).length;

    const weekRevenue: Record<string, number> = {};
    filtered.forEach(o => {
      if (!o.week) return;
      const wk = `W${o.week}`;
      weekRevenue[wk] = (weekRevenue[wk] || 0) + (o.total || 0);
    });
    const weekEntries = Object.entries(weekRevenue)
      .sort((a,b) => a[0].localeCompare(b[0])).slice(-10);
    const maxWeekRevenue = Math.max(...Object.values(weekRevenue), 1);

    return {
      filtered, totalServiceCharge, serviceChargeOrders, waivedOrders,
      totalGST, totalDelivery, totalCreditIssued, totalCreditApplied,
      avgPaymentDays, dayCount, maxDay, dayLabels,
      newCustomers, returningCustomers, weekEntries, maxWeekRevenue,
    };
  }, [orders, period]);

  const isLoading = ordersLoading || customersLoading;

  if (isLoading) {
    return (
      <AdminPageLayout icon={TrendingUp} title="Analytics Dashboard"
        subtitle="Real-time insights & performance metrics" sectionTitle="Analytics Overview">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      </AdminPageLayout>
    );
  }

  if (!analyticsData) {
    return (
      <AdminPageLayout icon={TrendingUp} title="Analytics Dashboard"
        subtitle="Real-time insights & performance metrics" sectionTitle="Analytics Overview">
        <div className="text-center py-16 text-neutral-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders found for this period.</p>
        </div>
      </AdminPageLayout>
    );
  }

  const { metrics, topProducts, topCustomers } = analyticsData;
  const top5Products  = topProducts.slice(0, 5);
  const top5Customers = topCustomers.slice(0, 5);

  const statusItems = [
    { label:'Completed',     count: metrics.completedOrders,  color:'bg-emerald-500' },
    { label:'In Production', count: extras.filtered.filter(o=>o.status==='in_process').length, color:'bg-purple-500' },
    { label:'Approved',      count: metrics.approvedOrders,   color:'bg-green-500' },
    { label:'Pending',       count: metrics.pendingOrders,    color:'bg-amber-500' },
    { label:'Cancelled',     count: metrics.cancelledOrders,  color:'bg-neutral-400' },
    { label:'Rejected',      count: metrics.rejectedOrders,   color:'bg-red-500' },
  ].filter(s => s.count > 0);

  const totalStatuses = statusItems.reduce((s, i) => s + i.count, 0);

  return (
    <AdminPageLayout icon={TrendingUp} title="Analytics Dashboard"
      subtitle="Real-time insights & performance metrics" sectionTitle="Analytics Overview"
      onRefresh={handleRefresh} isRefreshing={isRefreshing}>

      {/* ── Period Filter ─────────────────────────────────────────────── */}
      <div className="bg-white border border-[#D4A574]/30 rounded-xl shadow-sm mb-5 overflow-hidden">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-xs uppercase tracking-widest">Date Range</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/90 border border-emerald-400 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide">
            ⚡ Live
          </div>
        </div>

        {/* Period grid — 2-col on mobile, all in one row on desktop */}
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {PERIODS.map(p => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setCustomStart(''); setCustomEnd(''); }}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 active:scale-95 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-br from-[#C49564] to-[#D4A574] text-white shadow-md shadow-[#D4A574]/30 border border-[#C49564]'
                    : 'bg-white text-[#5a4535] border border-[#D4A574]/35 hover:border-[#D4A574]/70 hover:bg-[#fdf8f3]'
                }`}
              >
                {isActive && <span className="text-[9px]">✓</span>}
                {p.label}
              </button>
            );
          })}

          {/* Custom Date button */}
          <button
            onClick={() => {
              setModalStart(customStart);
              setModalEnd(customEnd);
              setShowDateModal(true);
            }}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 active:scale-95 whitespace-nowrap col-span-2 sm:col-span-1 ${
              period === 'custom'
                ? 'bg-gradient-to-br from-[#7B5EA7] to-[#9B7EC8] text-white shadow-md shadow-purple-400/30 border border-purple-500'
                : 'bg-white text-[#5a4535] border border-[#D4A574]/35 hover:border-[#D4A574]/70 hover:bg-[#fdf8f3]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {period === 'custom' && customStart && customEnd
              ? `${new Date(customStart + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} → ${new Date(customEnd + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
              : 'Custom Range'
            }
            {period === 'custom' && (
              <button
                onClick={e => { e.stopPropagation(); setPeriod('last30days'); setCustomStart(''); setCustomEnd(''); }}
                className="ml-1 w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </button>
        </div>
      </div>

      {/* ── Custom Date Range Modal ────────────────────────────────────────── */}
      {showDateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowDateModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative w-full sm:max-w-sm bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header — matches app tan/brown theme */}
            <div className="bg-gradient-to-r from-[#8B6F47] to-[#D4A574] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm uppercase tracking-wide">Custom Date Range</h3>
                  <p className="text-white/70 text-[10px]">Filter analytics by any period</p>
                </div>
              </div>
              <button
                onClick={() => setShowDateModal(false)}
                className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Quick presets */}
              <div>
                <p className="text-[10px] font-bold text-[#8B6F47] uppercase tracking-wider mb-2">Quick Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'This Month', days: 0, preset: 'thisMonth' },
                    { label: 'Last Month', days: 0, preset: 'lastMonth' },
                    { label: 'This Year',  days: 0, preset: 'thisYear'  },
                  ].map(({ label, preset }) => {
                    const today = new Date();
                    let s: Date, e: Date;
                    if (preset === 'thisMonth') {
                      s = new Date(today.getFullYear(), today.getMonth(), 1);
                      e = today;
                    } else if (preset === 'lastMonth') {
                      s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      e = new Date(today.getFullYear(), today.getMonth(), 0);
                    } else {
                      s = new Date(today.getFullYear(), 0, 1);
                      e = today;
                    }
                    const fmt = (d: Date) => d.toISOString().split('T')[0];
                    return (
                      <button
                        key={preset}
                        onClick={() => { setModalStart(fmt(s)); setModalEnd(fmt(e)); }}
                        className="px-2 py-2.5 rounded-xl text-[11px] font-semibold bg-[#FFF8EF] text-[#8B6F47] border border-[#D4A574]/40 hover:bg-[#D4A574]/20 hover:border-[#D4A574] transition-all active:scale-95"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#D4A574]/20" />
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">or pick dates</span>
                <div className="flex-1 h-px bg-[#D4A574]/20" />
              </div>

              {/* Date inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#8B6F47] uppercase tracking-wider mb-1.5">
                    From
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D4A574] pointer-events-none" />
                    <input
                      type="date"
                      value={modalStart}
                      onChange={e => setModalStart(e.target.value)}
                      max={modalEnd || undefined}
                      className="w-full pl-9 pr-2 py-2.5 border-2 border-[#D4A574]/40 rounded-xl text-xs font-medium text-[#333] focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 bg-[#FFFBF5] cursor-pointer transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8B6F47] uppercase tracking-wider mb-1.5">
                    To
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#D4A574] pointer-events-none" />
                    <input
                      type="date"
                      value={modalEnd}
                      onChange={e => setModalEnd(e.target.value)}
                      min={modalStart || undefined}
                      className="w-full pl-9 pr-2 py-2.5 border-2 border-[#D4A574]/40 rounded-xl text-xs font-medium text-[#333] focus:outline-none focus:border-[#D4A574] focus:ring-2 focus:ring-[#D4A574]/20 bg-[#FFFBF5] cursor-pointer transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {modalStart && modalEnd && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-[#FFF8EF] to-[#fdf8f3] border border-[#D4A574]/30 rounded-xl px-4 py-3">
                  <Calendar className="w-4 h-4 text-[#D4A574] flex-shrink-0" />
                  <span className="text-xs font-semibold text-[#8B6F47]">
                    {new Date(modalStart + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    {' '}→{' '}
                    {new Date(modalEnd + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                  </span>
                </div>
              )}
            </div>

            {/* Footer — matches app button style */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowDateModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modalStart && modalEnd) {
                    setCustomStart(modalStart);
                    setCustomEnd(modalEnd);
                    setPeriod('custom');
                  }
                  setShowDateModal(false);
                }}
                disabled={!modalStart || !modalEnd}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#8B6F47] to-[#D4A574] text-white text-sm font-bold shadow-md shadow-[#D4A574]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <StatCard icon={ShoppingBag} label="Total Orders"  value={metrics.totalOrders}                        color="tan"    />
        <StatCard icon={DollarSign}  label="Total Revenue" value={`$${metrics.totalSales.toFixed(0)}`}       color="green"  />
        <StatCard icon={Users}       label="Customers"     value={customers.length}                          color="blue"   />
        <StatCard icon={Package}     label="Avg Order"     value={`$${metrics.averageOrderValue.toFixed(0)}`} color="orange" />
        <StatCard icon={Receipt}     label="Service Fees"  value={`$${extras.totalServiceCharge.toFixed(0)}`} color="tan"   />
        <StatCard icon={Wallet}      label="GST Collected" value={`$${extras.totalGST.toFixed(0)}`}          color="green"  />
      </div>

      {/* ── Top Products + Order Status ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="🏆 Top Products" icon={Package}>
          {top5Products.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-8">No product data for this period</p>
            : <div className="space-y-3">
                {top5Products.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i===0?'bg-amber-500':i===1?'bg-neutral-400':i===2?'bg-amber-700':'bg-neutral-300'}`}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-neutral-800 truncate">{p.productName}</span>
                        <span className="text-emerald-600 font-bold ml-2 flex-shrink-0">${p.totalRevenue.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5">
                        <div className="bg-[#D4A574] h-1.5 rounded-full" style={{ width: `${top5Products[0]?.totalRevenue>0?(p.totalRevenue/top5Products[0].totalRevenue)*100:0}%` }} />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{p.totalQuantity} units sold</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </Section>

        <Section title="📊 Order Status Distribution" icon={BarChart2}>
          {statusItems.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-8">No orders for this period</p>
            : <div className="space-y-3">
                {statusItems.map(s => <ProgressRow key={s.label} label={s.label} count={s.count} total={totalStatuses} color={s.color} />)}
              </div>
          }
        </Section>
      </div>

      {/* ── Top Customers + Delivery Days ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="🌟 Top Customers" icon={Users}>
          {top5Customers.length === 0
            ? <p className="text-sm text-neutral-400 text-center py-8">No customer data for this period</p>
            : <div className="space-y-3">
                {top5Customers.map((c, i) => (
                  <div key={c.customerId} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${i===0?'bg-blue-500':i===1?'bg-blue-400':i===2?'bg-blue-300':'bg-neutral-300'}`}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-neutral-800 truncate">{c.customerName||'Unknown'}</span>
                        <span className="text-emerald-600 font-bold ml-2 flex-shrink-0">${c.totalRevenue.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${top5Customers[0]?.totalRevenue>0?(c.totalRevenue/top5Customers[0].totalRevenue)*100:0}%` }} />
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{c.orderCount} orders</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </Section>

        <Section title="📅 Busiest Delivery Days" icon={Calendar}>
          <div className="space-y-2.5">
            {extras.dayLabels.map(day => (
              <ProgressRow key={day} label={day} count={extras.dayCount[day]||0} total={extras.maxDay} color="bg-[#D4A574]" extra="units" />
            ))}
          </div>
        </Section>
      </div>

      {/* ── Service Charge + Financial Breakdown ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="💳 Service Charge Summary" icon={Receipt}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label:'Total Collected', value:`$${extras.totalServiceCharge.toFixed(2)}`, color:'text-emerald-600' },
              { label:'Orders Charged',  value:extras.serviceChargeOrders,               color:'text-neutral-800' },
              { label:'Orders Waived',   value:extras.waivedOrders,                      color:'text-amber-600'   },
              { label:'Avg per Order',   value: extras.serviceChargeOrders>0 ? `$${(extras.totalServiceCharge/extras.serviceChargeOrders).toFixed(2)}` : '—', color:'text-neutral-800' },
            ].map(item => (
              <div key={item.label} className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <ProgressRow label="Charged" count={extras.serviceChargeOrders} total={Math.max(extras.serviceChargeOrders+extras.waivedOrders,1)} color="bg-emerald-500" />
            <ProgressRow label="Waived"  count={extras.waivedOrders}        total={Math.max(extras.serviceChargeOrders+extras.waivedOrders,1)} color="bg-amber-400" />
          </div>
        </Section>

        <Section title="💰 Financial Breakdown" icon={DollarSign}>
          <div className="space-y-3">
            {[
              { label:'Gross Revenue',   value:metrics.totalSales,          icon:TrendingUp,  color:'text-emerald-600' },
              { label:'Service Charges', value:extras.totalServiceCharge,   icon:Receipt,     color:'text-[#D4A574]'   },
              { label:'GST Collected',   value:extras.totalGST,             icon:Wallet,      color:'text-blue-600'    },
              { label:'Delivery Fees',   value:extras.totalDelivery,        icon:Package,     color:'text-purple-600'  },
              { label:'Credits Issued',  value:extras.totalCreditIssued,    icon:Star,        color:'text-amber-600'   },
              { label:'Credits Applied', value:extras.totalCreditApplied,   icon:CheckCircle, color:'text-emerald-500' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                <div className="flex items-center gap-2">
                  <row.icon className="w-4 h-4 text-neutral-300" />
                  <span className="text-sm text-neutral-600">{row.label}</span>
                </div>
                <span className={`text-sm font-bold ${row.color}`}>${row.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── New vs Returning + Payment Speed ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="👥 New vs Returning Customers" icon={Users}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-2xl font-bold text-blue-600">{extras.newCustomers}</p>
              <p className="text-xs text-blue-500 font-semibold mt-1">New</p>
              <p className="text-[10px] text-neutral-400">1st order this period</p>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-2xl font-bold text-emerald-600">{extras.returningCustomers}</p>
              <p className="text-xs text-emerald-500 font-semibold mt-1">Returning</p>
              <p className="text-[10px] text-neutral-400">2+ orders this period</p>
            </div>
          </div>
          <div className="space-y-2">
            <ProgressRow label="New"       count={extras.newCustomers}       total={Math.max(extras.newCustomers+extras.returningCustomers,1)} color="bg-blue-400" />
            <ProgressRow label="Returning" count={extras.returningCustomers} total={Math.max(extras.newCustomers+extras.returningCustomers,1)} color="bg-emerald-500" />
          </div>
        </Section>

        <Section title="⏱ Payment Speed & Health" icon={Clock}>
          <div className="flex flex-col items-center justify-center py-3 mb-4">
            <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${extras.avgPaymentDays<2?'border-emerald-400 bg-emerald-50':extras.avgPaymentDays<5?'border-amber-400 bg-amber-50':'border-red-400 bg-red-50'}`}>
              <span className={`text-2xl font-bold ${extras.avgPaymentDays<2?'text-emerald-600':extras.avgPaymentDays<5?'text-amber-600':'text-red-600'}`}>
                {extras.avgPaymentDays.toFixed(1)}
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">days avg</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 text-center">Approval → Payment received</p>
          </div>
          <div className="space-y-2">
            {[
              { label:'Completed',       count:metrics.completedOrders,  icon:CheckCircle, color:'text-emerald-600' },
              { label:'Pending Payment', count:metrics.approvedOrders,   icon:Clock,       color:'text-amber-600'   },
              { label:'Cancelled',       count:metrics.cancelledOrders,  icon:XCircle,     color:'text-neutral-400' },
              { label:'Rejected',        count:metrics.rejectedOrders,   icon:AlertCircle, color:'text-red-500'     },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <r.icon className={`w-3.5 h-3.5 ${r.color}`} />
                  <span className="text-neutral-600">{r.label}</span>
                </div>
                <span className="font-bold text-neutral-800">{r.count}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Revenue by Week bar chart ─────────────────────────────────────── */}
      {extras.weekEntries.length > 0 && (
        <Section title="📈 Revenue by Week" icon={TrendingUp}>
          <div className="flex items-end gap-1.5 h-40 px-1">
            {extras.weekEntries.map(([wk, rev]) => (
              <div key={wk} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[9px] text-neutral-500 font-medium leading-none">
                  {rev>=1000?`$${(rev/1000).toFixed(1)}k`:`$${rev.toFixed(0)}`}
                </span>
                <div className="w-full bg-[#D4A574] rounded-t transition-all duration-700 min-h-[4px]"
                  style={{ height: `${Math.max(4,(rev/extras.maxWeekRevenue)*110)}px` }} />
                <span className="text-[9px] text-neutral-400 truncate w-full text-center">{wk}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">⚡ All analytics calculated client-side — zero server cost, instant updates, works offline.</p>
      </div>

    </AdminPageLayout>
  );
}

export const AdminAnalyticsDashboard = withAdminGuard(
  AdminAnalyticsDashboardComponent,
  'analytics dashboard',
);
