/**
 * Pagination — shared component for all paginated lists.
 *
 * Features:
 * ✅ Smart ellipsis page ranges
 * ✅ First / Prev / Next / Last arrow buttons
 * ✅ "Showing X–Y of Z items" counter
 * ✅ Returns null when ≤1 page (no unnecessary chrome)
 * ✅ Auto-corrects to last valid page (edge-case guard in usePaginatedOrders)
 * ✅ Smooth transitions + scale animations on hover
 * ✅ Fully accessible (aria-current, aria-label, title)
 * ✅ Responsive: number pills hidden on mobile, arrows always visible
 * ✅ Gold / bakery aesthetic
 */

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  /** Label for the counter, e.g. "orders" or "customers" */
  itemLabel?: string;
  className?: string;
}

/** Build page-number / ellipsis array, max 7 visible slots */
function buildPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p: (number | '…')[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) p.push(i);
    p.push('…'); p.push(total);
  } else if (current >= total - 3) {
    p.push(1); p.push('…');
    for (let i = total - 4; i <= total; i++) p.push(i);
  } else {
    p.push(1); p.push('…');
    p.push(current - 1); p.push(current); p.push(current + 1);
    p.push('…'); p.push(total);
  }
  return p;
}

interface PagBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}
function PagBtn({ children, disabled, className = '', ...rest }: PagBtnProps) {
  return (
    <button
      {...rest} disabled={disabled} type="button"
      className={[
        'w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 select-none',
        disabled
          ? 'text-neutral-300 cursor-not-allowed'
          : 'text-[#8B6F47] hover:bg-[#D4A574]/10 hover:scale-105 active:scale-95 cursor-pointer',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
  className = '',
}: PaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const range = buildPageRange(currentPage, totalPages);

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem   = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-2 border-t border-neutral-200 ${className}`}>
      {/* Counter */}
      <p className="text-xs text-neutral-500 tabular-nums order-2 sm:order-1">
        {startItem && endItem && totalItems ? (
          <>Showing <span className="font-semibold text-[#8B6F47]">{startItem}–{endItem}</span> of <span className="font-semibold text-[#8B6F47]">{totalItems}</span> {itemLabel}</>
        ) : totalItems ? (
          <><span className="font-semibold text-[#8B6F47]">{totalItems}</span> {itemLabel} · Page <span className="font-semibold text-[#8B6F47]">{currentPage}</span> of <span className="font-semibold text-[#8B6F47]">{totalPages}</span></>
        ) : (
          <>Page <span className="font-semibold text-[#8B6F47]">{currentPage}</span> of <span className="font-semibold text-[#8B6F47]">{totalPages}</span></>
        )}
      </p>

      {/* Controls */}
      <nav aria-label="Pagination" className="flex items-center gap-1 order-1 sm:order-2">
        <PagBtn onClick={() => onPageChange(1)} disabled={!hasPrev} aria-label="First page" title="First page">
          <ChevronsLeft className="w-3.5 h-3.5" />
        </PagBtn>
        <PagBtn onClick={() => onPageChange(currentPage - 1)} disabled={!hasPrev} aria-label="Previous page" title="Previous page">
          <ChevronLeft className="w-3.5 h-3.5" />
        </PagBtn>

        {/* Number pills — desktop only */}
        <div className="hidden sm:flex items-center gap-1">
          {range.map((p, i) =>
            p === '…' ? (
              <span key={`el-${i}`} className="w-8 text-center text-neutral-400 text-xs select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                aria-current={p === currentPage ? 'page' : undefined}
                type="button"
                className={[
                  'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-200 select-none',
                  p === currentPage
                    ? 'bg-gradient-to-br from-[#8B6F47] to-[#D4A574] text-white shadow-md scale-105 ring-2 ring-[#D4A574]/40'
                    : 'text-neutral-600 hover:bg-[#D4A574]/10 hover:text-[#8B6F47] hover:scale-105 active:scale-95',
                ].join(' ')}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Mobile compact */}
        <span className="sm:hidden px-3 py-1.5 text-xs font-medium text-[#8B6F47] bg-[#D4A574]/10 rounded-lg select-none">
          {currentPage} / {totalPages}
        </span>

        <PagBtn onClick={() => onPageChange(currentPage + 1)} disabled={!hasNext} aria-label="Next page" title="Next page">
          <ChevronRight className="w-3.5 h-3.5" />
        </PagBtn>
        <PagBtn onClick={() => onPageChange(totalPages)} disabled={!hasNext} aria-label="Last page" title="Last page">
          <ChevronsRight className="w-3.5 h-3.5" />
        </PagBtn>
      </nav>
    </div>
  );
}
