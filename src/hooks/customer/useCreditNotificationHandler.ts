/**
 * useCreditNotificationHandler
 *
 * Handles credit-received notification events and shows the celebration modal.
 * In Firebase mode: listens to 'creditReceived' DOM events dispatched after
 * a Firestore credit notification is created.
 */
import type { ModalType } from '../../types/modals';
import { useEffect } from 'react';

interface CreditNotificationData {
  customerId: string;
  amount: number;
  reason?: string;
  creditType?: string;
  timestamp?: number;
}

export function useCreditNotificationHandler(
  userId: string,
  openModal?: (type: ModalType, props?: any) => void
) {
  useEffect(() => {
    if (!userId || !openModal) return;

    function showCreditCelebration(data: CreditNotificationData) {
      openModal?.('CREDIT_RECEIVED_CELEBRATION', {
        amount: data.amount,
        reason: data.reason,
        creditType: data.creditType,
      });
    }

    // Listen for real-time credit events (fired by AddCreditModal)
    function handleCreditReceived(event: Event) {
      const data = (event as CustomEvent<CreditNotificationData>).detail;
      if (data?.customerId === userId) {
        showCreditCelebration(data);
      }
    }

    window.addEventListener('creditReceived', handleCreditReceived);
    return () => window.removeEventListener('creditReceived', handleCreditReceived);
  }, [userId, openModal]);
}
