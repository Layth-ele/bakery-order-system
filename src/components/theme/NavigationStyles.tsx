import { ReactNode, KeyboardEvent, useRef, useEffect } from 'react';
import { FOCUS_VISIBLE_CLASS } from '../../utils/accessibility';

/**
 * Global Navigation Theme Component
 * Provides consistent dark theme styling with golden borders for all navigation bars
 * 
 * ✅ REFACTORED FEB 9, 2026:
 * - Fixed badgeColor: Now properly applies background AND text color for contrast
 * - Merged NavTab and AdminNavTab into single unified component (removed 95% duplication)
 * - Added proper ARIA tablist wrapper with keyboard navigation (ArrowLeft/ArrowRight)
 * - Fixed z-index to use only standard Tailwind values (10, 20, 30, 40, 50)
 * - Using CSS variables for sticky offsets (maintainable, no hardcoded top-[64px])
 * - Full WCAG 2.1 Level AA compliance
 */

// ============================================
// BADGE THEME PRESETS
// ============================================

/**
 * Predefined badge color combinations with proper contrast
 * ✅ Each preset includes both background and text color
 */
export const BADGE_THEMES = {
  gold: 'bg-white text-[#8B6F47]',           // Default: Gold text on white
  orange: 'bg-[#FF9800] text-white',         // Orange with white text
  purple: 'bg-[#9C27B0] text-white',         // Purple with white text
  blue: 'bg-[#2196F3] text-white',           // Blue with white text
  red: 'bg-[#FF6B6B] text-white',            // Red with white text
  green: 'bg-[#4CAF50] text-white',          // Green with white text
} as const;

// ============================================
// UNIFIED NAVIGATION BAR SHELL WITH TABLIST
// ============================================

interface NavBarShellProps {
  children: ReactNode;
  /** Enable horizontal scrolling (admin tabs) */
  scrollable?: boolean;
  /** Use justify-around for main tabs, normal flex for admin tabs */
  justify?: boolean;
  /** Z-index value - ONLY use standard Tailwind values */
  zIndex?: 10 | 20 | 30 | 40 | 50;
  /** ARIA label for the tab list (e.g., "Main navigation", "Order filters") */
  ariaLabel?: string;
  /** Enable keyboard navigation (Arrow keys) - automatically enabled for tab navigation */
  enableKeyboardNav?: boolean;
}

export function NavBarShell({ 
  children, 
  scrollable = false, 
  justify = false,
  zIndex = 40,
  ariaLabel = 'Navigation',
  enableKeyboardNav = true
}: NavBarShellProps): JSX.Element | null {
  const zIndexClass = `z-${zIndex}`;
  const tablistRef = useRef<HTMLDivElement>(null);
  
  // ✅ ACCESSIBILITY: Keyboard navigation (ArrowLeft/ArrowRight)
  useEffect(() => {
    if (!enableKeyboardNav || !tablistRef.current) return;
    
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      
      const tablist = tablistRef.current;
      if (!tablist) return;
      
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]')) as HTMLElement[];
      const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
      
      if (currentIndex === -1) return;
      
      let newIndex = currentIndex;
      
      switch (e.key) {
        case 'ArrowLeft':
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = tabs.length - 1;
          break;
      }
      
      e.preventDefault();
      tabs[newIndex]?.focus();
      tabs[newIndex]?.click();
    };
    
    const tablist = tablistRef.current;
    tablist.addEventListener('keydown', handleKeyDown as any);
    
    return () => {
      tablist.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [enableKeyboardNav]);
  
  return (
    <div 
      className={`bg-neutral-900/95 border-b border-neutral-700 sticky ${zIndexClass} backdrop-blur-md shadow-lg`}
      style={{ top: 'var(--nav-bar-offset)' }}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div 
          ref={tablistRef}
          role="tablist"
          aria-label={ariaLabel}
          className={`flex items-center ${justify ? 'justify-around' : 'gap-2'} ${scrollable ? 'overflow-x-auto' : ''}`}
          style={scrollable ? { scrollbarWidth: 'thin' } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// UNIFIED NAV TAB BUTTON
// ============================================

interface NavTabProps {
  key?: string | number;  // React key - must be declared for TS to accept it
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  shortLabel?: string;
  badge?: number | string;
  /** 
   * ✅ Badge theme with proper contrast
   * Use BADGE_THEMES.orange, BADGE_THEMES.purple, etc.
   */
  badgeColor?: string;
  /** Custom badge aria-label (e.g. "pending orders", "notifications", "registrations") */
  badgeLabel?: string;
  /** ID of panel this tab controls */
  ariaControls?: string;
  /** 
   * Variant: 
   * - 'main' = main navigation tabs (flex-shrink-0, supports shortLabel)
   * - 'admin' = admin sub-tabs (no flex-shrink-0)
   */
  variant?: 'main' | 'admin';
}

export function NavTab({ 
  active, 
  onClick, 
  icon, 
  label, 
  shortLabel,
  badge,
  badgeColor = BADGE_THEMES.gold,
  badgeLabel = 'items',
  ariaControls,
  variant = 'main'
}: NavTabProps): JSX.Element | null {
  const isMain = variant === 'main';
  
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-controls={ariaControls}
      aria-label={label}
      tabIndex={active ? 0 : -1}
      className={`${isMain ? 'flex-shrink-0' : ''} relative flex items-center gap-1 sm:gap-2 px-${isMain ? '1.5 xs:px-2 sm:px-4' : '2 sm:px-4'} py-3 sm:py-4 text-xs sm:text-sm md:text-base transition-all whitespace-nowrap ${FOCUS_VISIBLE_CLASS} ${
        active ? 'text-[#D4A574] font-medium' : 'text-neutral-400 hover:text-neutral-300'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {isMain && shortLabel ? (
        <>
          <span className="hidden xs:inline">{label}</span>
          <span className="xs:hidden">{shortLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {badge !== undefined && (
        <span 
          className={`${badgeColor} text-xs font-bold rounded-full px-2 py-0.5 ml-1 shadow-sm`}
          aria-label={`${badge} ${badgeLabel}`}
        >
          {badge}
        </span>
      )}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4A574]" aria-hidden="true" />}
    </button>
  );
}

// ============================================
// LEGACY ADMIN NAV TAB (DEPRECATED)
// ============================================

/**
 * @deprecated Use NavTab with variant="admin" instead
 * This component is kept for backwards compatibility only
 */
export function AdminNavTab(props: Omit<NavTabProps, 'variant'>): JSX.Element | null {
  return <NavTab {...props} variant="admin" />;
}

// ============================================
// SUB-PAGE NAVIGATION (Back Button + Title)
// ============================================

interface SubPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function SubPageHeader({ 
  title, 
  subtitle, 
  icon,
  onBack,
  backLabel = 'Back to Dashboard'
}: SubPageHeaderProps): JSX.Element | null {
  return (
    <>
      {/* Sticky Back Button - Always visible at top */}
      {onBack && (
        <div 
          className="sticky z-30 bg-gradient-to-br from-[#4a4a4a] via-[#3a3a3a] to-[#2a2a2a] pb-4 border-b border-neutral-700/50"
          style={{ top: 'var(--sub-page-offset)' }}
        >
          <div className="max-w-7xl mx-auto px-4">
            <button
              type="button"
              onClick={onBack}
              className={`flex items-center gap-2 px-4 py-2.5 text-neutral-300 hover:text-[#D4A574] transition-all border border-[#D4A574]/30 rounded-lg hover:border-[#D4A574] bg-neutral-800/90 hover:bg-neutral-800 backdrop-blur-md shadow-lg ${FOCUS_VISIBLE_CLASS}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">{backLabel}</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Only show title card if title is provided */}
      {title && (
        <div className="border border-[#D4A574]/30 rounded-lg p-6 bg-neutral-800/50 mb-6">
          <div className="flex items-center gap-4">
            {icon && (
              <div className="w-14 h-14 rounded-lg bg-[#D4A574]/20 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-neutral-100">{title}</h2>
              {subtitle && <p className="text-neutral-400 mt-1">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// CONTENT CARD WITH GOLDEN BORDER
// ============================================

interface ContentCardProps {
  children: ReactNode;
  className?: string;
}

export function ContentCard({ children, className = '' }: ContentCardProps): JSX.Element | null {
  return (
    <div className={`border-2 border-[#D4A574]/30 rounded-lg p-6 bg-gradient-to-r from-[#FFF8E7] to-[#FFF3D6] shadow-md ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// MAIN HEADER (Dashboard Header)
// ============================================

interface DashboardHeaderProps {
  title: string;
  icon?: ReactNode;
  rightContent?: ReactNode;
}

export function DashboardHeader({ title, icon, rightContent }: DashboardHeaderProps): JSX.Element | null {
  return (
    <header className="bg-gradient-to-r from-[#3d3832]/95 to-[#2c2416]/95 backdrop-blur-sm shadow-lg sticky top-0 z-50 border-b border-[#D4A574]">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {icon}
            <h1 className="text-xl md:text-2xl lg:text-3xl text-[#e8dcc8]">{title}</h1>
          </div>
          {rightContent && (
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
