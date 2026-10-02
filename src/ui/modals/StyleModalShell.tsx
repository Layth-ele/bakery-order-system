/**
 * StyleModalShell - Styled modal shell component for luxury-themed modals
 * ✅ FEB 21, 2026: Fixed scroll behavior consistency - header/footer fixed, body scrolls
 * ✅ FEB 21, 2026: Added focus management for accessibility
 * ✅ FEB 19, 2026: Renamed from RejectStyleModalShell to StyleModalShell (more general name)
 * ✅ FEB 17, 2026: Removed duplicate overlay - now content-only
 *
 * This component provides ONLY the styled content panel.
 * The overlay/backdrop is handled by BaseModal (via ModalRoot).
 *
 * Layout (all devices):
 * - Phones: bottom sheet, full width, up to the status bar; footer clears
 *   the home bar (safe-area). sm and up: centred card, max 90dvh.
 * - Header: Fixed at top (flex-shrink-0)
 * - Body: Scrollable (flex-1, overflow-y-auto)
 * - Footer: Fixed at bottom (flex-shrink-0)
 * ✅ Result: Consistent scroll feel across all modals
 *
 * Accessibility Features:
 * - Auto-focuses first focusable element on open
 * - Returns focus to trigger element on close
 * - Traps focus within modal
 * - ESC key to close
 * - ARIA attributes for screen readers
 *
 * DO NOT add overlay, backdrop, or z-index management here.
 * That creates double-wrapping and z-index conflicts.
 */

import { ReactNode, isValidElement, useEffect, useRef } from "react";
import { X, LucideIcon } from "lucide-react";
import { logger } from '../../utils/logger';
import { useInModalFrame } from './modalFrame';
import { CopyButton } from '../../components/shared/CopyButton';


type ModalWidth =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "4xl"
  | "5xl"
  | "6xl";
type SkinType =
  | "default"
  | "danger"
  | "warning"
  | "info"
  | "success"
  | "production";

const WIDTH: Record<ModalWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

// ✅ FEB 21, 2026: Skin color mappings for semantic theming
const SKIN_COLORS: Record<
  SkinType,
  { header: string; text: string }
> = {
  default: {
    header: "bg-gradient-to-r from-[#D4A574] to-[#E8C4A2]",
    text: "text-[#333333]",
  },
  danger: {
    header: "bg-gradient-to-r from-red-500 to-red-400",
    text: "text-white",
  },
  warning: {
    header: "bg-gradient-to-r from-[#B8936F] to-[#C9A47B]",
    text: "text-white",
  },
  info: {
    header: "bg-gradient-to-r from-slate-600 to-slate-500",
    text: "text-white",
  },
  success: {
    header: "bg-gradient-to-r from-green-600 to-green-500",
    text: "text-white",
  },
  production: {
    header: "bg-gradient-to-r from-purple-600 to-purple-500",
    text: "text-white",
  },
};

type StyleModalShellProps = {
  isOpen?: boolean; // Optional - defaults to true since mounting === open
  onClose: () => void;

  title: string;
  subtitle?: ReactNode; // ✅ Changed from string to ReactNode to allow complex content
  icon?: LucideIcon | ReactNode; // Icon to show next to title (can be LucideIcon component or ReactNode)

  width?: ModalWidth;
  /** @deprecated Use `width` instead. This alias will be removed in a future version. */
  size?: ModalWidth; // ⚠️ DEPRECATED FEB 21, 2026: Use `width` instead for consistency

  skinType?: SkinType; // Semantic color theming

  headerLeft?: ReactNode; // icon slot or small header content
  headerRight?: ReactNode; // right side of header (e.g., order ID)
  footer?: ReactNode; // buttons row
  headerColor?: string; // override header background color class

  hideHeader?: boolean; // Option to hide header completely
  hideBody?: boolean; // Option to bypass body wrapper for custom scroll control
  className?: string; // Additional classes for container

  children: ReactNode;

 // Option to disable focus management if already handled by parent (e.g., BaseModal)
  disableFocusManagement?: boolean;
};

export function StyleModalShell({
  isOpen = true, // Default to true since component mounting === modal is open
  onClose,
  title,
  subtitle,
  icon,
  width = "4xl",
  size,
  skinType = "default",
  headerColor,
  headerLeft,
  headerRight,
  footer,
  children,
  hideHeader,
  hideBody,
  className,
  disableFocusManagement,
}: StyleModalShellProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  // Inside BaseModal (every registered modal), BaseModal owns Escape and focus.
  const inFrame = useInModalFrame();
  const previousActiveElement = useRef<HTMLElement | null>(
    null,
  );

  // Render icon properly - if it's a LucideIcon component, render it as JSX
  const renderIcon = () => {
    if (!icon) return null;
    
    // Already an element (<Icon className=… />): render as is.
    if (isValidElement(icon)) return icon;

    // A component (Lucide icons are forwardRef objects, not plain functions).
    const IconComponent = icon as LucideIcon;
    return <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />;
  };

  // ⚠️ Warn if deprecated `size` prop is used
  useEffect(() => {
    if (size && typeof size === "string") {
      logger.warn(
        "StyleModalShell: The `size` prop is deprecated and will be removed in a future version. Use `width` instead.",
      );
    }
  }, [size]);

 // Close on ESC key
  useEffect(() => {
    if (!isOpen || inFrame) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, inFrame, onClose]);

 // Focus management for accessibility
  useEffect(() => {
    if (!isOpen || !modalRef.current || disableFocusManagement || inFrame)
      return;

    // Save currently focused element to restore later
    previousActiveElement.current =
      document.activeElement as HTMLElement;

    // Get all focusable elements in modal
    const getFocusableElements = (): HTMLElement[] => {
      if (!modalRef.current) return [];
      const elements =
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
        );
      return Array.from(elements);
    };

    // Focus first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        focusableElements[0]?.focus();
      }, 10);
    }

    // Trap focus within modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement as HTMLElement;

      // Shift + Tab on first element -> go to last
      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
      // Tab on last element -> go to first
      else if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup: restore focus to previous element
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, disableFocusManagement, inFrame]);

  if (!isOpen) return null;

  // Order (ORD-…) or invoice (DBH-…) number shown in the subtitle, if any.
  const subtitleId =
    typeof subtitle === "string" ? subtitle.match(/\b(?:ORD|DBH)-[0-9A-Z-]+\b/)?.[0] ?? null : null;

  // Use `width` if provided, otherwise fallback to deprecated `size`
  const effectiveWidth = width || size || "4xl";

  return (
    <div
      ref={modalRef}
      className={[
        // Phones: bottom sheet (rounded top, full width, fills up to the
        // status bar). sm and up: centred card, at most 90% of the screen.
        "relative bg-white shadow-2xl w-full overflow-hidden flex flex-col",
        "rounded-t-2xl sm:rounded-2xl",
        "max-h-[calc(100dvh_-_0.75rem)] sm:max-h-[90dvh]",
        WIDTH[effectiveWidth],
        className,
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Header */}
      {!hideHeader && (
        <div
          className={[
            headerColor || SKIN_COLORS[skinType].header,
            "relative px-4 sm:px-6 pt-4 pb-3 sm:py-4 flex justify-between items-center gap-3 flex-shrink-0",
          ].join(" ")}
        >
          {/* Sheet grabber (phones only, decorative) */}
          <span aria-hidden="true" className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-black/15" />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {(icon || headerLeft) && (
              <div className={`flex-shrink-0 ${SKIN_COLORS[skinType].text}`}>
                {renderIcon() || headerLeft}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                className={`text-base sm:text-xl font-bold uppercase tracking-wide ${SKIN_COLORS[skinType].text} leading-tight truncate`}
              >
                {title}
              </h2>
              {subtitle ? (
                <div className={`mt-0.5 flex min-w-0 items-center gap-1 ${SKIN_COLORS[skinType].text}`}>
                  <div className="min-w-0 truncate text-xs sm:text-sm opacity-80 leading-snug">
                    {subtitle}
                  </div>
                  {/* An order / invoice number in the subtitle gets a copy button. */}
                  {subtitleId && (
                    <CopyButton
                      text={subtitleId}
                      label={subtitleId.startsWith('DBH') ? 'Invoice number' : 'Order number'}
                      className="-my-1.5 opacity-80 hover:opacity-100 hover:bg-black/10"
                    />
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className={`${SKIN_COLORS[skinType].text} -mr-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10 active:bg-black/15 transition-colors`}
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Body — the only part that scrolls */}
      {!hideBody && (
        <div
          className={[
            "flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6",
            footer ? "" : "pb-[calc(1rem_+_env(safe-area-inset-bottom))] sm:pb-6",
          ].join(" ")}
        >
          {children}
        </div>
      )}
      {hideBody && children}

      {/* Footer — always visible; clears the iPhone home bar */}
      {footer ? (
        <div className="border-t border-neutral-200 bg-white px-4 sm:px-6 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:py-4 flex-shrink-0">
          {footer}
        </div>
      ) : null}
    </div>
  );
}