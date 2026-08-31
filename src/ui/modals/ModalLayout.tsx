/**
 * ModalLayout - Standardized Modal Layout Slots
 * Version: 2.0.0 - Added drag functionality and size presets
 *
 * Provides consistent structure for all modals:
 * ✅ Sticky header (always visible at top)
 * ✅ Scrollable body (overflow-y-auto)
 * ✅ Optional sticky footer (always visible at bottom)
 * ✅ Draggable modals (desktop only)
 * ✅ Size presets for different content types
 *
 * Usage Pattern 1 (Simple - with title/onClose):
 * ```tsx
 * <ModalLayout
 *   title="My Modal"
 *   onClose={closeModal}
 *   footer={<button>Save</button>}
 *   draggable // Enable drag functionality
 *   sizePreset="form" // Use form size preset
 * >
 *   <p>Content goes here</p>
 * </ModalLayout>
 * ```
 *
 * Usage Pattern 2 (Advanced - custom header slot):
 * ```tsx
 * <ModalLayout
 *   header={<CustomHeader />}
 *   footer={<button>Save</button>}
 *   draggable
 * >
 *   <p>Content goes here</p>
 * </ModalLayout>
 * ```
 */

import { useState, useRef, useEffect } from "react";
import type {
  ReactNode,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";

/**
 * Size presets for different content types
 * Provides consistent sizing across the application
 */
export const MODAL_SIZE_PRESETS = {
  alert: "max-w-md", // Small alerts and confirmations
  form: "max-w-lg", // Forms with inputs
  table: "max-w-4xl", // Tables and data grids
  dashboard: "max-w-6xl", // Dashboard widgets and analytics
  full: "max-w-[95vw]", // Near full-screen modals
} as const;

export type ModalSizePreset = keyof typeof MODAL_SIZE_PRESETS;

interface ModalLayoutProps {
  /** Sticky header content (title, close button, etc.) - use this for custom headers */
  header?: ReactNode;

  /** Simple title text - auto-generates header with close button (cannot be used with header prop) */
  title?: string;

  /** Close handler - required when using title prop */
  onClose?: () => void;

  /** Subtitle text - optional, only works with title prop */
  subtitle?: string;

  /** Header actions (right side) - only works with title prop */
  actions?: ReactNode;

  /** Scrollable body content */
  children: ReactNode;

  /** Optional sticky footer (action buttons, etc.) */
  footer?: ReactNode;

  /** Custom className for container */
  className?: string;

  /** Custom className for header */
  headerClassName?: string;

  /** Custom className for body */
  bodyClassName?: string;

  /** Custom className for footer */
  footerClassName?: string;

  /** Enable drag functionality (desktop only) */
  draggable?: boolean;

  /** Size preset for modal - overrides className max-width */
  sizePreset?: ModalSizePreset;

  /** Custom drag handle selector (default: entire header) */
  dragHandleClassName?: string;

  // 🎨 NEW: Skin override props
  /** Custom className for overlay backdrop */
  overlayClassName?: string;

  /** Custom className for panel/container */
  containerClassName?: string;
}

/**
 * Hook for draggable functionality
 */
function useDraggable(
  enabled: boolean,
  containerRef: RefObject<HTMLDivElement>,
) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;

    // DOM MouseEvent for document listeners
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - initialMousePos.current.x;
      const deltaY = e.clientY - initialMousePos.current.y;

      setPosition({
        x: dragStartPos.current.x + deltaX,
        y: dragStartPos.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener(
        "mousemove",
        handleMouseMove,
      );
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, enabled]);

  // React MouseEvent for React event handlers
  const handleMouseDown = (e: ReactMouseEvent) => {
    if (!enabled) return;

    // Only allow dragging from header area
    const target = e.target as HTMLElement;
    const isButton = target.closest("button");
    const isInput = target.closest("input, textarea, select");

    if (isButton || isInput) return;

    setIsDragging(true);
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = position;
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  return {
    isDragging,
    position,
    handleMouseDown,
    resetPosition,
  };
}

/**
 * ModalLayout Component
 *
 * Standard three-slot layout:
 * - Header: Sticky at top (optional)
 * - Body: Scrollable content area
 * - Footer: Sticky at bottom (optional)
 */
export function ModalLayout({
  header,
  title,
  onClose,
  subtitle,
  actions,
  children,
  footer,
  className = "",
  headerClassName = "",
  bodyClassName = "",
  footerClassName = "",
  draggable = false,
  sizePreset,
  dragHandleClassName,
  // 🎨 NEW: Skin override props
  overlayClassName,
  containerClassName,
}: ModalLayoutProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isDragging,
    position,
    handleMouseDown,
    resetPosition,
  } = useDraggable(draggable, containerRef);

  // Validation: cannot use both header and title
  if (header && title) {
    console.error(
      'ModalLayout: Cannot use both "header" and "title" props. Use one or the other.',
    );
  }

  // If title is provided, generate header automatically
  const autoGeneratedHeader = title ? (
    <ModalHeader
      title={title}
      onClose={onClose!}
      subtitle={subtitle}
      actions={actions}
      draggable={draggable}
      isDragging={isDragging}
    />
  ) : null;

  const finalHeader = header || autoGeneratedHeader;

  // Apply size preset if provided
  const sizeClass = sizePreset
    ? MODAL_SIZE_PRESETS[sizePreset]
    : "";

  // Combine transform styles
  const transformStyle = draggable
    ? {
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging
          ? "none"
          : "transform 0.2s ease-out",
      }
    : {};

  return (
    <div
      ref={containerRef}
      className={`flex flex-col max-h-[85vh] overflow-hidden ${sizeClass} ${className}`}
      style={transformStyle}
      onDoubleClick={draggable ? resetPosition : undefined}
    >
      {/* Sticky Header */}
      {finalHeader && (
        <div
          className={`flex-shrink-0 sticky top-0 z-sticky-header ${headerClassName} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
          onMouseDown={draggable ? handleMouseDown : undefined}
        >
          {finalHeader}
        </div>
      )}

      {/* Scrollable Body */}
      <div
        className={`flex-1 overflow-y-auto ${bodyClassName}`}
      >
        {children}
      </div>

      {/* Sticky Footer */}
      {footer && (
        <div
          className={`flex-shrink-0 sticky bottom-0 z-sticky-footer ${footerClassName}`}
        >
          {footer}
        </div>
      )}

      {/* Drag indicator (only visible when dragging) */}
      {draggable && isDragging && (
        <div className="absolute top-2 right-2 text-white/50 text-xs pointer-events-none">
          Dragging... (Double-click to reset)
        </div>
      )}
    </div>
  );
}

/**
 * Pre-styled Modal Header Component
 *
 * Standard header with title and close button
 */
interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Custom header actions (right side, before close button) */
  actions?: ReactNode;
  /** Custom background gradient/color */
  variant?: "luxury" | "success" | "warning" | "error" | "info";
  className?: string;
  /** Enable drag functionality */
  draggable?: boolean;
  /** Current drag state */
  isDragging?: boolean;
}

const HEADER_VARIANTS = {
  luxury:
    "bg-gradient-to-r from-[#3d3832]/95 to-[#2c2416]/95 border-b border-[#D4A574]",
  success:
    "bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] border-b border-[#4CAF50]",
  warning:
    "bg-gradient-to-r from-[#FF9800] to-[#FFA726] border-b border-[#FF9800]",
  error:
    "bg-gradient-to-r from-[#f44336] to-[#e57373] border-b border-[#f44336]",
  info: "bg-gradient-to-r from-[#2196F3] to-[#42A5F5] border-b border-[#2196F3]",
};

export function ModalHeader({
  title,
  onClose,
  subtitle,
  actions,
  variant = "luxury",
  className = "",
  draggable = false,
  isDragging = false,
}: ModalHeaderProps): JSX.Element | null {
  return (
    <div
      className={`${HEADER_VARIANTS[variant]} backdrop-blur-sm px-6 py-4 ${className} ${isDragging ? "select-none" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-white text-xl font-semibold flex items-center gap-2">
            {draggable && (
              <svg
                className="w-4 h-4 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Drag handle"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            )}
            {title}
          </h2>
          {subtitle && (
            <p className="text-white/80 text-sm mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
          <button
            onClick={onClose}
            type="button"
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-styled Modal Actions Component
 *
 * Standard footer with cancel and confirm buttons
 */
interface ModalActionsProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?:
    | "primary"
    | "success"
    | "warning"
    | "error"
    | "info";
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  isLoading?: boolean;
}

const CONFIRM_VARIANTS = {
  primary:
    "bg-[#D4A574] text-white hover:bg-[#C49564] border border-[#D4A574]",
  success:
    "bg-[#4CAF50] text-white hover:bg-[#45A049] border border-[#4CAF50]",
  warning:
    "bg-[#FF9800] text-white hover:bg-[#FB8C00] border border-[#FF9800]",
  error:
    "bg-[#f44336] text-white hover:bg-[#d32f2f] border border-[#f44336]",
  info: "bg-[#2196F3] text-white hover:bg-[#1976d2] border border-[#2196F3]",
};

export function ModalActions({
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  confirmDisabled = false,
  cancelDisabled = false,
  isLoading = false,
}: ModalActionsProps): JSX.Element | null {
  return (
    <>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelDisabled || isLoading}
          className="flex-1 px-6 py-3 bg-black/20 text-neutral-300 rounded-xl font-bold hover:bg-black/30 transition-colors border border-[#D4A574]/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
      )}
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled || isLoading}
          className={`flex-1 px-6 py-3 rounded-xl font-bold transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${CONFIRM_VARIANTS[confirmVariant]}`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading...
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      )}
    </>
  );
}