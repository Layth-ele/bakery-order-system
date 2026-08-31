/**
 * CustomerPageLayout
 * 
 * ✅ UPDATED: March 10, 2026 - Phase 1 Layout Consistency
 * 
 * Unified layout component for all customer dashboard pages
 * Matches the Admin Dashboard production tools style with:
 * - Gold gradient headers
 * - Centered pastel grid cards
 * - Consistent spacing and styling
 * 
 * CHANGES:
 * - StatCard moved to /components/shared/StatCard.tsx for reusability
 * - Now imports shared StatCard component
 * - Maintains exact same API and functionality
 */

import { ReactNode } from 'react';
import { LucideIcon, RefreshCw } from 'lucide-react';

// ✅ Import shared StatCard component
export { StatCard } from '../shared/StatCard';

interface CustomerPageLayoutProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  sectionTitle: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: ReactNode;
}

export function CustomerPageLayout({
  icon: Icon,
  title,
  subtitle,
  sectionTitle,
  onRefresh,
  isRefreshing = false,
  children,
}: CustomerPageLayoutProps): JSX.Element | null {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#f0f0f0] py-8">
      <div className="max-w-7xl mx-auto px-4">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">

            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="icon-container-lg md:icon-container-xl flex items-center justify-center bg-gradient-to-br from-[#8B6F47] to-[#D4A574] rounded-2xl shadow-md flex-shrink-0">
                <Icon className="icon-lg md:icon-xl text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="heading-3 md:heading-2 font-bold text-[#8B6F47] truncate leading-tight">
                  {title}
                </h1>
                <p className="body-xs text-neutral-500 truncate mt-0.5">
                  {subtitle}
                </p>
              </div>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-[#D4A574]/10 border border-[#D4A574]/40 rounded-xl transition-all shadow-sm flex-shrink-0 disabled:opacity-50 active:scale-95"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={`icon-md text-[#D4A574] transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span className="body-xs text-[#8B6F47] font-semibold hidden md:inline whitespace-nowrap">
                  Refresh
                </span>
              </button>
            )}
          </div>
        </div>

        {/* ── Section Header Bar ───────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden mb-5 shadow-md">
          <div className="px-5 py-3.5 bg-gradient-to-r from-[#8B6F47] to-[#D4A574]">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              {sectionTitle}
            </h2>
          </div>
        </div>

        {/* ── Page Content ─────────────────────────────────────────────────── */}
        {children}
      </div>
    </div>
  );
}