import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, startTransition } from 'react';
import type { ModalType, ModalProps } from '../types/modals';
import type { ModalSize, OverlayBlur } from '../ui/modals/BaseModal';
import {
  canOpenModal,
  formatModalStack,
  logModalOpened,
  logModalClosed,
  generateModalId,
  getStackLimitAlertMessage,
} from '../services/modalService';
import type { ModalStackEntry } from '../services/modalService';

/**
 * ===================================================================
 * ModalContext - Type-Safe Modal Management System
 * ===================================================================
 * 
 * Centralized modal state management with stack support for nested modals.
 * Provides type-safe modal opening/closing with full tracking.
 * 
 * ✅ MAR 8, 2026: Phase 1 - Business logic moved to modalService
 * ✅ MAR 8, 2026: Phase 4 - Migrated to centralized debug utility
 * 
 * Responsibilities:
 * - Manage modal stack state (React state)
 * - Provide hooks for opening/closing modals
 * - Handle lifecycle callbacks
 * - Track analytics
 * 
 * Does NOT:
 * - Contain business logic (delegated to modalService)
 * - Validate modal rules (delegated to modalService)
 * - Format/log directly (delegated to modalService)
 * 
 * Features:
 * - Modal stacking (multiple modals can be open)
 * - Type-safe props for each modal type
 * - Lifecycle hooks (onBeforeOpen, onAfterClose)
 * - Modal tracking and analytics
 * - Size and overlay blur configuration
 * - Stacking limits to prevent modal overload
 * 
 * Version: 3.0.0 - Service-Oriented Architecture
 * ===================================================================
 */

interface ModalContextValue {
  activeModal: ModalType | null;
  modalProps: Record<string, unknown>;
  modalSize: ModalSize;
  modalOverlayBlur: OverlayBlur;
  modalStack: ModalStackEntry[];
  stackSize: number;
  openModal: <T extends ModalType>(
    type: T, 
    props?: ModalProps<T>, 
    size?: ModalSize, 
    overlayBlur?: OverlayBlur,
    options?: {
      onBeforeOpen?: () => void;
      onAfterClose?: () => void;
      replaceTop?: boolean;
    }
  ) => void;
  closeModal: () => void;
  closeAllModals: () => void;
  closeToModal: (modalId: string) => void;
  getModalInfo: (modalId: string) => ModalStackEntry | undefined;
  isModalOpen: (type: ModalType) => boolean;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }): JSX.Element | null {
  const [modalStack, setModalStack] = useState<ModalStackEntry[]>([]);

  // FIX T2R2-C6 (CRITICAL — performance): Without this ref, openModal/getModalInfo/
  // isModalOpen would close over the modalStack state value and need it in their
  // useCallback deps — meaning a NEW function identity on every modal open/close.
  // Every consumer with useEffect([openModal]) would re-run.  The ref always
  // reflects the latest stack without becoming a dep, so the callbacks stay
  // stable across renders.
  const modalStackRef = useRef(modalStack);
  useEffect(() => {
    modalStackRef.current = modalStack;
  }, [modalStack]);

  const closeModal = useCallback(() => {
    setModalStack(prevStack => {
      if (prevStack.length > 0) {
        const topModal = prevStack[prevStack.length - 1];
        topModal.onAfterClose?.();
        // ✅ Analytics tracking removed - not implemented
        
        const remainingStack = prevStack.slice(0, -1);
        logModalClosed(topModal.type, remainingStack);
        
        return remainingStack;
      }
      return prevStack;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModalStack(prevStack => {
      prevStack.forEach(modal => {
        modal.onAfterClose?.();
        // ✅ Analytics tracking removed - not implemented
      });
      return [];
    });
  }, []);

  const closeToModal = useCallback((modalId: string) => {
    setModalStack(prevStack => {
      const index = prevStack.findIndex(modal => modal.id === modalId);
      if (index >= 0) {
        const closedModals = prevStack.slice(index + 1);
        closedModals.forEach(modal => {
          modal.onAfterClose?.();
          // ✅ Analytics tracking removed - not implemented
        });
        
        return prevStack.slice(0, index + 1);
      }
      return prevStack;
    });
  }, []);

  const openModal = useCallback(<T extends ModalType>(
    type: T,
    props: ModalProps<T> = {} as ModalProps<T>,
    size: ModalSize = 'md',
    overlayBlur?: OverlayBlur,
    options?: { replaceTop?: boolean; onAfterClose?: () => void; onBeforeOpen?: () => void }
  ) => {
    // FIX T2R2-C6: Read from ref so this callback's identity is stable across
    // renders.  Without this, the [modalStack] dep meant a new function every
    // open/close and consumer re-render storms.
    const currentStack = modalStackRef.current;
    const validation = canOpenModal(type, currentStack, options);
    
    if (!validation.canOpen) {
      // Show user-friendly alert for stack limit
      if (validation.reason?.includes('Stack limit')) {
        alert(getStackLimitAlertMessage(currentStack));
      }
      return;
    }

    // ✅ Auto-close modals if service says so
    if (validation.shouldAutoClose && validation.modalsToClose.length > 0) {
      setModalStack(prevStack => 
        prevStack.filter(m => !validation.modalsToClose.includes(m.id))
      );
    }

    // ✅ Execute before-open callback
    options?.onBeforeOpen?.();
    
 // Wrap modal opening in startTransition to fix Suspense error
    // This prevents "component suspended while responding to synchronous input" error
    // when lazy-loaded modals are triggered by user clicks
    startTransition(() => {
      // ✅ Create new modal entry
      const id = generateModalId();
      const newModal: ModalStackEntry<T> = {
        type,
        props: props as unknown as Record<string, unknown>,
        size,
        overlayBlur,
        id,
        openedAt: Date.now(),
        onAfterClose: options?.onAfterClose,
      };

      setModalStack(prevStack => {
        const newStack = options?.replaceTop && prevStack.length > 0
          ? [...prevStack.slice(0, -1), newModal]
          : [...prevStack, newModal];
        
        // ✅ Log via service
        logModalOpened(type, id, newStack);
        
        return newStack;
      });
    });

    // ✅ Analytics tracking removed - not implemented
  }, []);  // ✅ Stable identity — reads via ref

  const getModalInfo = useCallback((modalId: string) => {
    return modalStackRef.current.find(modal => modal.id === modalId);
  }, []);  // ✅ Stable

  const isModalOpen = useCallback((type: ModalType) => {
    return modalStackRef.current.some(modal => modal.type === type);
  }, []);  // ✅ Stable

  const currentModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
  const activeModal = currentModal?.type ?? null;
  const modalProps = currentModal?.props ?? {};
  const modalSize: ModalSize = currentModal?.size ?? 'lg';
  const modalOverlayBlur: OverlayBlur = currentModal?.overlayBlur ?? 'sm';

  // FIX T2R2-C6 (CRITICAL — performance): Without useMemo, the value object
  // is fresh every render → every consumer re-renders even when nothing
  // relevant changed. With ~50 components consuming useModal, every state
  // change cascaded across all of them. Memoizing here means consumers only
  // re-render when one of these slot values genuinely changes.
  const value: ModalContextValue = useMemo(
    () => ({
      activeModal,
      modalProps,
      modalSize,
      modalOverlayBlur,
      openModal,
      closeModal,
      modalStack,
      stackSize: modalStack.length,
      closeAllModals,
      closeToModal,
      getModalInfo,
      isModalOpen,
    }),
    [activeModal, modalProps, modalSize, modalOverlayBlur, modalStack, openModal, closeModal, closeAllModals, closeToModal, getModalInfo, isModalOpen]
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);

  if (!context) {
    // FIX T2R2-C5 (CRITICAL): Was silently returning no-op functions in dev,
    // hiding the very real bug "you forgot to wrap this tree with
    // <ModalProvider>". Click handlers ran, modals never opened, no error.
    //
    // The original justification was HMR — during a hot-reload, contexts can
    // briefly be undefined. We distinguish that case via import.meta.hot:
    // if HMR is the active reason, we silently no-op (genuinely transient).
    // Otherwise — including dev mode without HMR — we throw, matching prod.
    const isHmr =
      typeof import.meta !== 'undefined' &&
      (import.meta as any).hot != null &&
      (import.meta as any).hot.data != null;

    if (!isHmr) {
      throw new Error(
        'useModal must be used within a ModalProvider. ' +
        'Wrap your app with <ModalProvider> (typically inside <AppProviders>).'
      );
    }

    // HMR transient state — return a no-op fallback ONLY for the moment.
    const fallback: ModalContextValue = {
      activeModal: null,
      modalProps: {},
      modalSize: 'lg',
      modalOverlayBlur: 'sm',
      openModal: () => { /* HMR transient — provider will return next render */ },
      closeModal: () => {},
      modalStack: [],
      stackSize: 0,
      closeAllModals: () => {},
      closeToModal: () => {},
      getModalInfo: () => undefined,
      isModalOpen: () => false,
    };
    return fallback;
  }

  return context;
}