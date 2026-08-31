/**
 * NotificationBellBase - Shared Notification Bell UI Component
 * 
 * Pure presentational component for notification bell rendering.
 * Handles UI only - no business logic or context dependencies.
 * 
 * Created: February 11, 2026
 * Updated: February 11, 2026 - Moved to /notifications/components/
 * Purpose: DRY principle - eliminate UI duplication between Admin and Customer bells
 */

import { Bell } from 'lucide-react';
import { memo } from 'react';

interface NotificationBellBaseProps {
  /**
   * Number of unread notifications
   */
  unreadCount: number;
  
  /**
   * Click handler for bell button
   */
  onClick: () => void;
  
  /**
   * ARIA label for accessibility
   */
  ariaLabel: string;
  
  /**
   * Optional: Custom hex color for bell icon
   * @default '#D4A574' (gold)
   */
  iconColor?: string;
  
  /**
   * Optional: Custom z-index for bell container
   * @default 'var(--z-notification-bell, 10000)'
   */
  zIndex?: string | number;
  
  /**
   * Optional: Disabled state
   * @default false
   */
  disabled?: boolean;
}

/**
 * NotificationBellBase Component
 * 
 * Renders a notification bell icon with optional unread badge.
 * 
 * Features:
 * - Responsive sizing (mobile: w-5 h-5, desktop: w-6 h-6)
 * - Animated unread badge with pulse effect
 * - Hover effects
 * - Full accessibility (ARIA labels, keyboard navigation)
 * - Customizable colors and z-index
 * 
 * @example
 * ```tsx
 * <NotificationBellBase
 *   unreadCount={5}
 *   onClick={handleBellClick}
 *   ariaLabel="Admin Notifications (5 unread)"
 * />
 * ```
 */
export const NotificationBellBase = memo(function NotificationBellBase({
  unreadCount,
  onClick,
  ariaLabel,
  iconColor = '#D4A574', // ✅ Default to hex color for inline styles
  zIndex = 'var(--z-notification-bell, 10000)',
  disabled = false,
}: NotificationBellBaseProps) {
  // Format unread count for badge
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;
  
  // ✅ FIX: Single style prop assignment
  const z = zIndex;
  
  return (
    <div 
      className="relative" 
      style={{ zIndex: z as any }}
    >
      {/* Bell Button */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`
          relative p-2 rounded-lg transition-all
          ${disabled 
            ? 'cursor-not-allowed opacity-40' 
            : 'hover:bg-white/10 cursor-pointer'
          }
        `}
        aria-label={ariaLabel}
      >
        {/* Bell Icon */}
        <Bell 
          className={`
            w-5 h-5 md:w-6 md:h-6
            ${disabled ? 'opacity-50' : ''}
          `}
          style={{ color: disabled ? undefined : iconColor }} // ✅ FIX: Use inline style for dynamic color
        />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 bg-[#FF5722] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-lg"
            aria-label={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
          >
            {displayCount}
          </span>
        )}
      </button>
    </div>
  );
});

/**
 * Disabled variant for cases where context is not available
 * 
 * @example
 * ```tsx
 * if (!context) {
 *   return <NotificationBellBase.Disabled />;
 * }
 * ```
 */
(NotificationBellBase as any).Disabled = memo(function NotificationBellDisabled() {
  return (
    <NotificationBellBase
      unreadCount={0}
      onClick={() => {}}
      ariaLabel="Notifications unavailable"
      disabled={true}
      iconColor="#9CA3AF" // ✅ FIX: Use hex color instead of Tailwind class name
    />
  );
});