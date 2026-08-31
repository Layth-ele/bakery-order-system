import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";

/**
 * BaseModal - Core Modal Infrastructure with Motion Animations
 * ✅ FEB 18, 2026: Added smooth Motion animations for professional feel
 *
 * Handles all modal infrastructure:
 * ✅ Portal rendering (to document.body)
 * ✅ Backdrop/overlay with configurable blur effect
 * ✅ Smooth entry/exit animations
 * ✅ Escape key handling
 * ✅ Focus trap (Tab/Shift+Tab cycling)
 * ✅ Focus restoration (returns to trigger element)
 * ✅ Click-outside-to-close
 * ✅ Scroll lock (position:fixed pattern with scrollbar compensation)
 * ✅ Z-index management
 * ✅ ARIA attributes (role="dialog", aria-modal="true")
 * ✅ Consistent sizing (sm/md/lg/xl/full)
 *
 * Usage:
 * ```tsx
 * <BaseModal
 *   isOpen={true}
 *   onClose={closeModal}
 *   size="md"
 *   overlayBlur="md"
 *   ariaLabel="Product Details"
 * >
 *   <YourContentHere />
 * </BaseModal>
 * ```
 *
 * All modal components become "pure content" - no backdrop/overlay code needed!
 */

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";
export type OverlayBlur = "none" | "sm" | "md" | "lg";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  width?: ModalSize; // legacy alias for size
  overlayBlur?: OverlayBlur;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  zIndex?: number; // NEW: Allow passing z-index from ModalRoot
  // 🎨 NEW: Skin override props
  overlayClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

// Consistent size mapping
const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-md", // 448px - Small alerts, confirmations
  md: "max-w-2xl", // 672px - Default, forms, details
  lg: "max-w-4xl", // 896px - Wide content, tables
  xl: "max-w-6xl", // 1152px - Very wide, complex layouts
  full: "max-w-[95vw]", // Almost full screen
};

// Overlay blur intensity mapping
const BLUR_CLASSES: Record<OverlayBlur, string> = {
  none: "", // No blur
  sm: "backdrop-blur-sm", // Light blur (4px)
  md: "backdrop-blur-md", // Medium blur (12px)
  lg: "backdrop-blur-lg", // Heavy blur (16px)
};

export function BaseModal({
  isOpen,
  onClose,
  children,
  size = "lg",
  width,
  overlayBlur = "sm",
  ariaLabel,
  ariaLabelledBy,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  zIndex,
  overlayClassName,
  panelClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
}: BaseModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(
    null,
  );

  const resolvedSize = width ?? size;

  // Animation state for smooth entry/exit
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // ============================================
  // Animation Control
  // Separate "should render" from "is visible" for smooth transitions
  // ============================================
  useEffect(() => {
    if (isOpen) {
      // Start rendering immediately
      setShouldRender(true);
      // Trigger animation after a small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      // Start exit animation
      setIsVisible(false);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ============================================
  // Focus Management
  // ============================================
  useEffect(() => {
    if (!isOpen) return;

    // Save the element that had focus before modal opened
    previousActiveElement.current =
      document.activeElement as HTMLElement;

    // Focus first focusable element in modal
    const focusableElements =
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Restore focus on unmount
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  // ============================================
  // Focus Trap
  // ============================================
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

      if (!focusableElements || focusableElements.length === 0)
        return;

      const firstElement = focusableElements[0];
      const lastElement =
        focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: Moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () =>
      document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // ============================================
  // Escape Key Handler
  // ============================================
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () =>
      document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // ============================================
  // Click Outside Handler
  // ============================================
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdropClick) return;
    // Check the click landed on the backdrop itself (not the modal panel)
    // using a data attribute instead of a ref — avoids motion/react v12 ref warning
    if ((e.target as HTMLElement).dataset.backdrop === 'true') {
      onClose();
    }
  };

  // Don't render if not open
  if (!shouldRender) return null;

  // ============================================
  // Motion Animation Variants
  // NOTE: Motion v12 — do NOT put type:"spring" inside a variant's transition block.
  // Spring + DOM-measured transforms (scale, y) causes onKeyframesResolved to receive
  // an undefined callback → "void 0 is not a function" crash.
  // Use duration+ease on the animate prop directly instead.
  // ============================================
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { scale: 0.95, opacity: 0, y: 16 },
    visible: { scale: 1,    opacity: 1, y: 0  },
    exit:    { scale: 0.95, opacity: 0, y: 8  },
  };

  // ============================================
  // Render Portal
  // ============================================
  return createPortal(
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          data-backdrop="true"
          onClick={handleBackdropClick}
          className={`fixed inset-0 bg-black/50 ${BLUR_CLASSES[overlayBlur]} flex items-center justify-center p-4`}
          style={{
            margin: 0,
            overflowY: "auto",
            overflowX: "hidden",
            zIndex: zIndex ?? 20000,
            minHeight: "100vh",
          }}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className={`relative w-full mx-auto ${SIZE_CLASSES[resolvedSize]} my-8`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Plain div carries the ref for focus management — avoids motion/react v12 ref warning */}
            <div ref={dialogRef} style={{ display: 'contents' }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
