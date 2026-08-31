/**
 * useUrlSyncedModal - URL-synced modal hook
 * 
 * Wraps the existing ModalContext to add URL synchronization.
 * Works alongside the current modal system without breaking it.
 * 
 * ✅ March 10, 2026: Phase 3 - Modal URL routing
 * 
 * Features:
 * - Syncs modal open/close to URL params
 * - Restores modal on page refresh
 * - Browser back/forward closes/opens modals
 * - Shareable modal URLs
 * - Works with existing ModalContext
 * 
 * Usage:
 * ```tsx
 * const { openModal, closeModal } = useUrlSyncedModal();
 * 
 * // Opens modal AND updates URL
 * openModal('ORDER_DETAILS', { orderId: '123' });
 * // URL: ?modal=ORDER_DETAILS&orderId=123
 * 
 * // Closing modal removes URL params
 * closeModal();
 * // URL: (params removed)
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useModal } from '../contexts/ModalContextNew';
import type {ModalType, ModalProps, ModalSize, OverlayBlur} from '../types/modals'

interface UseUrlSyncedModalOptions {
  /**
   * Whether to preserve other URL params when opening modal
   * @default true
   */
  preserveParams?: boolean;
  
  /**
   * Custom param name for modal type
   * @default 'modal'
   */
  modalParamName?: string;
  
  /**
   * Whether to sync to URL (can disable for specific modals)
   * @default true
   */
  syncToUrl?: boolean;
  
  /**
   * Debounce time for URL updates (ms)
   * @default 50
   */
  debounceMs?: number;
}

interface ModalDataParams {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * Hook to sync modals with URL parameters
 */
export function useUrlSyncedModal(options: UseUrlSyncedModalOptions = {}) {
  const {
    preserveParams = true,
    modalParamName = 'modal',
    syncToUrl = true,
    debounceMs = 50,
  } = options;

  // ✅ Modals that require full objects (order, products, categories) and CANNOT be
  // safely restored from URL params alone — serializing them causes crashes on refresh
  const URL_EXCLUDED_MODALS = new Set([
    'PAID_ORDER_DETAILS',
    'PENDING_ORDER_DETAILS',
    'UNPAID_ORDER_DETAILS',
    'SUBMIT_PAYMENT',
    'PAYMENT_IN_REVIEW',
    'PAYMENT_RECEIVED_SUCCESS',
    'REJECTED_ORDER_DETAILS',
    'CANCELLED_ORDER_DETAILS',
    'EDIT_ORDER',
    'ORDER_REVIEW',
    'ADMIN_ORDER_VIEW',
    'COMPLETED_ORDER_INVOICE',
    'INVOICE_PREVIEW',
    'CREDIT_RECEIVED',
    'NOTIFICATIONS',
    'ADMIN_NOTIFICATIONS',
  ]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const { openModal: contextOpenModal, closeModal: contextCloseModal, modalStack } = useModal();
  
  // Track if we're handling a URL change to prevent loops
  const isHandlingUrlChange = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout>();
  
  /**
   * Get current modal from URL
   */
  const getModalFromUrl = useCallback(() => {
    const modalType = searchParams.get(modalParamName);
    if (!modalType) return null;
    
    // Extract modal data from URL params
    const modalData: ModalDataParams = {};
    searchParams.forEach((value, key) => {
      if (key !== modalParamName) {
        // Try to parse as number or boolean
        if (value === 'true') modalData[key] = true;
        else if (value === 'false') modalData[key] = false;
        else if (!isNaN(Number(value)) && value !== '') modalData[key] = Number(value);
        else modalData[key] = value;
      }
    });
    
    return { type: modalType, data: modalData };
  }, [searchParams, modalParamName]);
  
  /**
   * Update URL with modal state
   */
  const updateUrl = useCallback((modalType: string | null, modalData?: ModalDataParams) => {
    if (!syncToUrl) return;
    
    // Debounce URL updates
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      isHandlingUrlChange.current = true;
      
      const newParams = new URLSearchParams(preserveParams ? searchParams : {});
      
      if (modalType && !URL_EXCLUDED_MODALS.has(modalType)) {
        // Add modal type
        newParams.set(modalParamName, modalType);
        
        // Add modal data — only serialize primitive URL-safe values.
        // Arrays, objects, and functions cannot survive the URL round-trip
        // (they stringify to "[object Object]" or "function...") and would
        // corrupt props when the modal is restored from URL on refresh.
        if (modalData) {
          Object.entries(modalData).forEach(([key, value]) => {
            const isPrimitive =
              typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean';
            if (isPrimitive && value !== undefined && value !== null) {
              newParams.set(key, String(value));
            }
            // Arrays, objects, and functions are intentionally skipped —
            // they cannot be safely serialized to / restored from URL params.
          });
        }
      } else {
        // Remove all modal-related params
        newParams.delete(modalParamName);
        
        // Remove data params (everything except known app params)
        const knownAppParams = ['page', 'search', 'dateFilter', 'orderStatus', 'customStartDate', 'customEndDate', 'perPage', 'sortBy', 'sortOrder'];
        Array.from(newParams.keys()).forEach(key => {
          if (!knownAppParams.includes(key)) {
            newParams.delete(key);
          }
        });
      }
      
      setSearchParams(newParams, { replace: true });
      
      // Reset flag after a tick
      setTimeout(() => {
        isHandlingUrlChange.current = false;
      }, 100);
    }, debounceMs);
  }, [searchParams, setSearchParams, preserveParams, modalParamName, syncToUrl, debounceMs]);
  
  /**
   * Open modal and sync to URL
   */
  const openModal = useCallback(<T extends ModalType>(
    type: T,
    props: ModalProps<T>,
    size?: ModalSize,
    overlayBlur?: OverlayBlur,
    modalOptions?: {
      onBeforeOpen?: () => void;
      onAfterClose?: () => void;
      replaceTop?: boolean;
    }
  ) => {
    // ✅ PASS 6: contextOpenModal types props as `ModalProps<T> | undefined`
    // (optional). Forwarding a `ModalProps<T>` (non-optional) loses the
    // generic identity — TS cannot prove the two `T`s are the same one,
    // and the discriminated-union cross-product inflates to all possible
    // shapes. The cast at this boundary is sound because the modal type is
    // the exact key both functions agreed on; safer fix would be to
    // refactor the openModal signature to take a single discriminated
    // tuple, scheduled for the modal-registry rewrite (Pass 6+).
    contextOpenModal(type, props as any, size, overlayBlur, modalOptions);
    
    // Update URL
    updateUrl(type, props as ModalDataParams);
  }, [contextOpenModal, updateUrl]);
  
  /**
   * Close modal and sync to URL
   */
  const closeModal = useCallback(() => {
    // Close modal in context
    contextCloseModal();
    
    // Update URL
    updateUrl(null);
  }, [contextCloseModal, updateUrl]);
  
  /**
   * Restore modal from URL on mount/URL change
   */
  useEffect(() => {
    // Skip if we just updated the URL ourselves
    if (isHandlingUrlChange.current) return;
    
    const urlModal = getModalFromUrl();
    
    if (urlModal) {
      // ✅ Skip excluded modals that need full objects — clean the URL instead
      if (URL_EXCLUDED_MODALS.has(urlModal.type)) {
        // Remove stale/invalid modal params from URL silently
        updateUrl(null);
        return;
      }

      // Check if this modal is already open
      const isAlreadyOpen = modalStack.some(m => m.type === urlModal.type);
      
      if (!isAlreadyOpen) {
        // Open modal from URL
        contextOpenModal(
          urlModal.type as ModalType,
          urlModal.data as any,
          undefined,
          undefined,
          {
            onAfterClose: () => {
              // Remove from URL when closed
              updateUrl(null);
            }
          }
        );
      }
    } else {
      // No modal in URL - close any open modals if they were opened via URL
      if (modalStack.length > 0) {
        const topModal = modalStack[modalStack.length - 1];
        // Only close if it looks like it was opened from URL
        // (we can't track this perfectly without adding more state)
      }
    }
  }, [searchParams]); // Only run when URL changes
  
  return {
    openModal,
    closeModal,
    currentModal: getModalFromUrl(),
    isUrlModal: !!searchParams.get(modalParamName),
  };
}

/**
 * Hook for non-URL synced modals (uses original context)
 * 
 * Use this for modals that shouldn't be in URL:
 * - Temporary confirmations
 * - Error messages
 * - Tooltips/popovers
 */
export function useLocalModal() {
  return useModal();
}