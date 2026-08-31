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
 * Scroll Behavior (FEB 21, 2026):
 * - Modal container: max-h-[90vh], overflow-hidden, flex-col
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

import { ReactNode, useEffect, useRef } from "react";
import { X, LucideIcon } from "lucide-react";
import { logger } from '../../utils/logger';


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
  const previousActiveElement = useRef<HTMLElement | null>(
    null,
  );

  // Render icon properly - if it's a LucideIcon component, render it as JSX
  const renderIcon = () => {
    if (!icon) return null;
    
    // If icon is a function (LucideIcon component), render it as JSX
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />;
    }
    
    // Otherwise it's already a ReactNode, render it directly
    return icon;
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
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

 // Focus management for accessibility
  useEffect(() => {
    if (!isOpen || !modalRef.current || disableFocusManagement)
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
  }, [isOpen, disableFocusManagement]);

  if (!isOpen) return null;

  // Use `width` if provided, otherwise fallback to deprecated `size`
  const effectiveWidth = width || size || "4xl";

  return (
    <div
      ref={modalRef}
      className={[
        "relative bg-white rounded-2xl shadow-2xl w-full",
        WIDTH[effectiveWidth],
        "max-h-[90vh] overflow-hidden flex flex-col",
        className,
      ].join(" ")}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      {!hideHeader && (
        <div
          className={[
            headerColor || SKIN_COLORS[skinType].header,
            "px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center flex-shrink-0",
          ].join(" ")}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {(icon || headerLeft) && (
              <div className={`flex-shrink-0 ${SKIN_COLORS[skinType].text}`}>
                {renderIcon() || headerLeft}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                className={`text-base sm:text-xl font-bold ${SKIN_COLORS[skinType].text} truncate`}
              >
                {title}
              </h2>
              {subtitle ? (
                <div
                  className={`text-xs ${SKIN_COLORS[skinType].text} opacity-70 break-all leading-tight mt-0.5`}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerRight}
            <button
              onClick={onClose}
              className={`${SKIN_COLORS[skinType].text} hover:opacity-80 transition-opacity`}
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {!hideBody && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      )}
      {hideBody && children}

      {/* Footer */}
      {footer ? (
        <div className="border-t border-neutral-200 bg-white px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          {footer}
        </div>
      ) : null}
    </div>
  );
}