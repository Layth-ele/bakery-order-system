/**
 * usePaymentConfirmedModal
 *
 * Watches customer notifications and automatically opens PAID_ORDER_DETAILS
 * when a PAYMENT_CONFIRMED notification arrives unread.
 *
 * ✅ INFINITE LOOP FIX: Uses a module-level Set to track shown notifications
 * within the current page session. This prevents re-opening the modal when
 * Firestore snapshots fire between markAsRead() being called and completing.
 * The notification is deleted after the customer dismisses so it never fires again.
 */
import { useEffect, useRef } from 'react';
import type { ModalType, ModalProps } from '../../types/modals';
import type { ModalSize, OverlayBlur } from '../../ui/modals/BaseModal';
import type { Product, Category, Order } from '../../types';

// ✅ Module-level guard — persists across re-renders, cleared only on page reload
const sessionShown = new Set<string>();

const PAYMENT_TYPES = new Set([
  'PAYMENT_CONFIRMED_THANK_YOU',
  'payment-confirmed',
  'PAYMENT_CONFIRMED',
]);

interface Notification {
  id: string;
  type: string;
  read?: boolean;
  orderId?: string;
  data?: { orderId?: string };
}

/**
 * ✅ PASS 5: Tightened openModal signature to match the canonical
 * ModalContext.openModal type. Previously typed as
 *   (type: ModalType, props?: any, size?: string, maxSize?: string) => void
 * which masked the real signature and broke under tsc --strict because
 * ModalSize is a string-literal union, not a free string. The any on props
 * is preserved here because callers pass per-type-discriminated props that
 * would require a generic constraint to express precisely; the broader
 * type-safety of openModal is enforced at its definition site.
 */
export function usePaymentConfirmedModal(
  notifications: Notification[] | undefined,
  allOrders: Order[],
  products: Product[],
  categories: Category[],
  openModal?: <T extends ModalType>(
    type: T,
    props: ModalProps<T>,
    size?: ModalSize,
    overlayBlur?: OverlayBlur,
    modalOptions?: { onBeforeOpen?: () => void; onAfterClose?: () => void; replaceTop?: boolean },
  ) => void,
  markAsRead?: (id: string) => Promise<void>,
  deleteNotification?: (id: string) => void
) {
  // ✅ Prevent concurrent opens (guards against rapid Firestore updates)
  const isOpeningRef = useRef(false);

  useEffect(() => {
    if (!notifications?.length || !openModal || isOpeningRef.current) return;

    const unshownPayments = notifications.filter(notif =>
      PAYMENT_TYPES.has(notif.type) &&
      !notif.read &&
      !sessionShown.has(notif.id) &&
      (notif.orderId || notif.data?.orderId)
    );

    if (unshownPayments.length === 0) return;

    // Process first unshown payment notification
    const notif = unshownPayments[0];
    const orderId = notif.orderId || notif.data?.orderId || '';
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    // ✅ Mark as shown IMMEDIATELY before any async ops
    sessionShown.add(notif.id);
    isOpeningRef.current = true;

    // ✅ markAsRead returns Promise<void> — fire-and-forget via async IIFE (useEffect can't be async)
    if (markAsRead) {
      void (async () => { try { await markAsRead(notif.id); } catch { /* non-fatal */ } })();
    }

    openModal('PAID_ORDER_DETAILS', {
      order,
      products,
      categories,
      onClose: () => {
        // ✅ Delete notification after customer dismisses — prevents it from ever re-firing
        if (deleteNotification) {
          deleteNotification(notif.id);
        }
        isOpeningRef.current = false;
      },
    } as ModalProps<'PAID_ORDER_DETAILS'>, 'lg', 'md');

    // Safety: release lock after 5s even if onClose never fires
    setTimeout(() => { isOpeningRef.current = false; }, 5000);

  }, [notifications, openModal, allOrders, products, categories, markAsRead, deleteNotification]);
}
