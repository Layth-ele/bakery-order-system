/**
 * useModalRouter Hook
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Manages modal state via URL search params instead of component state.
 * 
 * ✅ BENEFITS:
 * - Shareable modal links
 * - Browser back closes modal
 * - Modal state survives page refresh
 * - Multiple modals can coexist in URL
 * - Better debugging (see modal state in URL)
 * 
 * 📖 USAGE:
 * ```tsx
 * // Instead of:
 * const [isOpen, setIsOpen] = useState(false);
 * const [orderId, setOrderId] = useState(null);
 * 
 * // Use:
 * const { isOpen, modalData, openModal, closeModal } = useModalRouter('order-details');
 * 
 * // Open modal with data
 * <Button onClick={() => openModal({ orderId: '123' })}>
 *   View Order
 * </Button>
 * 
 * // Check if open
 * {isOpen && <OrderDetailsModal orderId={modalData.orderId} onClose={closeModal} />}
 * 
 * // URL becomes: /admin/pending?modal=order-details&orderId=123
 * ```
 * 
 * 🔗 SHAREABLE LINKS:
 * - Users can share direct links to modals
 * - Refresh page keeps modal open
 * - Browser back/forward works correctly
 * 
 * Created: March 10, 2026
 */

import { useSearchParams } from 'react-router';
import { logger } from '../../utils/logger';


export interface ModalRouterOptions {
  /**
   * Whether to preserve existing query params when opening modal
   * @default true
   */
  preserveParams?: boolean;
  
  /**
   * Whether to replace history state instead of pushing
   * @default false
   */
  replace?: boolean;
}

export interface ModalRouterReturn {
  /**
   * Whether this modal is currently open
   */
  isOpen: boolean;
  
  /**
   * Data passed to the modal (from URL params)
   */
  modalData: Record<string, string>;
  
  /**
   * Open the modal with optional data
   */
  openModal: (data?: Record<string, string>) => void;
  
  /**
   * Close the modal and clean up params
   */
  closeModal: () => void;
  
  /**
   * Update modal data without closing
   */
  updateModal: (data: Record<string, string>) => void;
}

/**
 * Hook for managing modal state via URL search params
 * 
 * @param modalName - Unique identifier for this modal
 * @param options - Configuration options
 * @returns Modal control functions and state
 * 
 * @example
 * ```tsx
 * const { isOpen, modalData, openModal, closeModal } = useModalRouter('edit-customer');
 * 
 * return (
 *   <>
 *     <Button onClick={() => openModal({ customerId: '123' })}>
 *       Edit Customer
 *     </Button>
 *     
 *     {isOpen && (
 *       <EditCustomerModal
 *         customerId={modalData.customerId}
 *         onClose={closeModal}
 *       />
 *     )}
 *   </>
 * );
 * ```
 */
export function useModalRouter(
  modalName: string,
  options: ModalRouterOptions = {}
): ModalRouterReturn {
  const { preserveParams = true, replace = false } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Check if this modal is currently open
  const isOpen = searchParams.get('modal') === modalName;
  
  // Extract modal-specific data from URL params
  const modalData: Record<string, string> = {};
  if (isOpen) {
    searchParams.forEach((value, key) => {
      if (key !== 'modal') {
        modalData[key] = value;
      }
    });
  }
  
  /**
   * Open the modal with optional data
   */
  const openModal = (data?: Record<string, string>) => {
    const params = preserveParams 
      ? new URLSearchParams(searchParams)
      : new URLSearchParams();
    
    // Set modal name
    params.set('modal', modalName);
    
    // Add modal data
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
    }
    
    setSearchParams(params, { replace });
  };
  
  /**
   * Close the modal and remove modal-specific params
   */
  const closeModal = () => {
    const params = new URLSearchParams(searchParams);
    
    // Remove modal name
    params.delete('modal');
    
    // Remove modal-specific params
    Object.keys(modalData).forEach(key => {
      params.delete(key);
    });
    
    setSearchParams(params, { replace });
  };
  
  /**
   * Update modal data without closing
   */
  const updateModal = (data: Record<string, string>) => {
    if (!isOpen) {
      logger.warn(`[useModalRouter] Cannot update modal '${modalName}' - not open`);
      return;
    }
    
    const params = new URLSearchParams(searchParams);
    
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    
    setSearchParams(params, { replace: true }); // Always replace for updates
  };
  
  return {
    isOpen,
    modalData,
    openModal,
    closeModal,
    updateModal,
  };
}

/**
 * Type-safe version of useModalRouter with typed modal data
 * 
 * @example
 * ```tsx
 * interface OrderModalData {
 *   orderId: string;
 *   customerId?: string;
 * }
 * 
 * const { isOpen, modalData, openModal } = useTypedModalRouter<OrderModalData>('order-details');
 * 
 * // modalData is now typed as Partial<OrderModalData>
 * ```
 */
export function useTypedModalRouter<T extends Record<string, any>>(
  modalName: string,
  options?: ModalRouterOptions
) {
  const router = useModalRouter(modalName, options);
  
  return {
    ...router,
    modalData: router.modalData as Partial<T>,
    openModal: (data?: Partial<T>) => router.openModal(data as Record<string, string>),
    updateModal: (data: Partial<T>) => router.updateModal(data as Record<string, string>),
  };
}

/**
 * Get the currently open modal name from URL
 * 
 * @example
 * ```tsx
 * const currentModal = useCurrentModal();
 * logger.log(currentModal); // 'order-details' or null
 * ```
 */
export function useCurrentModal(): string | null {
  const [searchParams] = useSearchParams();
  return searchParams.get('modal');
}

/**
 * Check if any modal is currently open
 * 
 * @example
 * ```tsx
 * const hasOpenModal = useHasOpenModal();
 * 
 * // Disable background interactions when modal open
 * <div className={hasOpenModal ? 'pointer-events-none' : ''}>
 *   {content}
 * </div>
 * ```
 */
export function useHasOpenModal(): boolean {
  const currentModal = useCurrentModal();
  return currentModal !== null;
}
