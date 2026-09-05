import { ReactNode } from 'react';
import { LucideIcon, RefreshCw } from 'lucide-react';

interface AdminPageLayoutProps {
  /** Icon to display in the header (LucideIcon) */
  icon: LucideIcon;
  
  /** Page title (e.g., "Pending Orders") */
  title: string;
  
  /** Page subtitle/description */
  subtitle: string;
  
  /** Section title for the gold bar */
  sectionTitle: string;
  
  /** Optional refresh callback */
  onRefresh?: () => void;
  
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  
  /** Page content */
  children: ReactNode;
}

/**
 * AdminPageLayout Component
 *
 * ✅ SINGLE SOURCE OF TRUTH for all admin page headers.
 * All visual tokens are defined here — never override in child pages.
 *
 * DESIGN TOKENS (do not change in child components):
 *   Icon container : icon-container-lg (mobile) / icon-container-xl (desktop)
 *   Icon gradient  : from-[#8B6F47] → to-[#D4A574]  (dark-to-light, br direction)
 *   Section bar    : from-[#8B6F47] → to-[#D4A574]  (same gradient, r direction)
 *   Section title  : text-sm font-bold uppercase tracking-widest text-white
 *   Refresh btn    : white bg, gold border, gold icon, no label on mobile
 */
export function AdminPageLayout({
  icon: Icon,
  title,
  subtitle,
  sectionTitle,
  onRefresh,
  isRefreshing = false,
  children,
}: AdminPageLayoutProps): JSX.Element | null {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#f0f0f0] py-8">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">

            {/* Left: icon + title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Icon container — fixed token sizes, never raw px */}
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

            {/* Right: refresh button — consistent across every page */}
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
        {/* Gradient: always dark-brown → light-gold, left-to-right */}
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
