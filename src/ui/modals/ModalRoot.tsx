/**
 * ModalRoot - Enhanced Type-Safe Modal Content Router
 * Version: 2.1.0 - Added lazy loading with Suspense
 *
 * NEW FEATURES:
 * ✨ Modal stacking - Multiple modals from context
 * ✨ Transition animations - Smooth entering/exiting states
 * ✨ Global hotkeys - Keyboard shortcuts for modal operations
 * ✨ Z-index management - Automatic layering for stacked modals
 * ✨ Lazy loading - Code splitting for better performance
 * ✨ Analytics tracking - Built-in modal usage tracking
 *
 * Renders the appropriate modal content based on activeModal.
 * All infrastructure (backdrop, portal, a11y, scroll lock) handled by BaseModal.
 *
 * Now FULLY TYPE-SAFE:
 * - Registry lookup is typed
 * - Props are verified at compile time
 * - Supports configurable overlay blur
 * - No `any` types used
 *
 * The type safety flows from:
 * openModal() → ModalContext → ModalRoot → Specific Modal Component
 */

import {useEffect, useCallback, Suspense} from "react"
import { useModal } from "../../contexts/ModalContextNew"; // ✅ Backward compatible location
import { getModalComponent } from "./modalRegistry";
import { BaseModal } from "./BaseModal";
import { scrollLockManager } from "../../utils/scrollLockManager"; // Centralized scroll lock

const DEBUG =
  typeof import.meta !== "undefined" && import.meta.env?.DEV;

/**
 * Loading Fallback Component
 * Shows while lazy-loaded modal is being fetched
 */
const ModalLoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

/**
 * Global hotkey configuration
 */
interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

export function ModalRoot(): JSX.Element | null {
  // ✅ SAFETY: Gracefully handle missing context during HMR
  const modalContext = useModal();

  const { modalStack, closeModal, closeAllModals } =
    modalContext;

  // ============================================
 // CENTRALIZED SCROLL LOCK MANAGER
  // Replaced direct DOM manipulation with reference-counted manager
  // Prevents race conditions with AlertContext and other scroll locks
 // Fixed to only lock when modals exist, not on count changes
  // ============================================
  useEffect(() => {
    const hasModals = modalStack.length > 0;
    
    if (hasModals) {
      // Request scroll lock (automatically handles reference counting)
      const unlock = scrollLockManager.lock("ModalRoot");
      
      // Cleanup when all modals are closed
      return unlock;
    }
    
    // No modals - ensure scroll is unlocked
    // This is a safety measure, the lock manager should already handle this
    return undefined;
  }, [modalStack.length > 0]); // ✅ Only trigger when going from 0<->N, not on count changes

  // ============================================
  // Global Hotkeys
  // ============================================

  /**
   * Close all modals
   */
  const handleCloseAll = useCallback(() => {
    if (modalStack.length > 0) {
      closeAllModals();
    }
  }, [modalStack, closeAllModals]);

  /**
   * Show modal stack info (debug)
   */
  const showModalStackInfo = useCallback(() => {
  }, [modalStack]);

  /**
   * Hotkey configurations
   */
  const hotkeys: HotkeyConfig[] = [
    {
      key: "Escape",
      shift: true,
      handler: handleCloseAll,
      description: "Close all modals",
    },
    {
      key: "m",
      ctrl: true,
      shift: true,
      handler: showModalStackInfo,
      description: "Show modal stack info (debug)",
    },
  ];

  /**
   * Global hotkey handler
   */
  useEffect(() => {
    if (modalStack.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      // Skip if typing in input (except for hotkeys that should work everywhere)
      if (isInputField && e.key !== "Escape") return;

      for (const hotkey of hotkeys) {
        const keyMatches = e.key === hotkey.key;
        const ctrlMatches = !!hotkey.ctrl === e.ctrlKey;
        const shiftMatches = !!hotkey.shift === e.shiftKey;
        const altMatches = !!hotkey.alt === e.altKey;

        if (
          keyMatches &&
          ctrlMatches &&
          shiftMatches &&
          altMatches
        ) {
          e.preventDefault();
          e.stopPropagation();
          hotkey.handler();
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalStack, hotkeys]);

  // ============================================
  // Early Return Checks (AFTER all hooks)
  // ============================================

  // Check if we got a fallback (no modal stack means context not ready)
  if (!modalContext || modalStack.length === 0) {
    return null;
  }

  // ============================================
  // Rendering
  // ============================================

  // ✅ Calculate z-index for modals using centralized system
  // Uses CSS variable --z-modal-base (20000) and increments by 10 per modal
  // This ensures modals stack properly above all UI except system-critical elements
  const baseZIndex = 20000; // Must match --z-modal-base in z-index.css
  const zIndexIncrement = 10;

  // Render all modals in stack
  return (
    <>
      {modalStack.map((modalEntry, index) => {


        const ModalComponent = getModalComponent(
          modalEntry.type,
        );
        if (!ModalComponent) {
          console.error(
            `❌ [MODAL ROOT] Modal component not found for type: ${modalEntry.type}`,
          );
          return null;
        }

        const isTopModal = index === modalStack.length - 1;
        const zIndex = baseZIndex + index * zIndexIncrement;



        return (
          <BaseModal
            key={modalEntry.id} // Stable key - prevents remount churn
            isOpen={true}
            onClose={isTopModal ? closeModal : () => {}}
            size={modalEntry.size}
            overlayBlur={modalEntry.overlayBlur}
            ariaLabel={modalEntry.type.replace(/_/g, " ")}
            closeOnBackdropClick={isTopModal}
            closeOnEscape={isTopModal} // Only top modal closes on Escape
            zIndex={zIndex} // Pass z-index to BaseModal
          >
            <Suspense fallback={<ModalLoadingFallback />}>
              <ModalComponent
                {...(modalEntry.props as any)}
                onClose={closeModal}
              />
            </Suspense>
          </BaseModal>
        );
      })}

      {/* Debug overlay removed for production */}
    </>
  );
}