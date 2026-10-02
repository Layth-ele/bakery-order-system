/**
 * Payment reminders — one policy for every admin screen. The
 * sendPaymentReminder Cloud Function counts the reminder, writes the
 * customer's in-app notification and emails them; this only reports back.
 */
import { toast } from 'sonner';
import type { Order } from '../../types';
import { displayOrderNumber } from '../../utils/displayId';
import { describeEmailResult } from '../emailService';
import { callableErrorMessage, sendPaymentReminderViaCloudFunction } from '../firebase/cloudFunctions';

/** Text for the "send reminder?" confirmation. */
export function reminderConfirmMessage(order: Order): string {
  const next = (order.paymentReminderCount ?? 0) + 1;
  const due = typeof order.amountDue === 'number' ? order.amountDue : Math.max(0, (order.total ?? 0) - (order.creditApplied ?? 0));
  return (
    `Send payment reminder #${next} to ${order.customerName} for order ${displayOrderNumber(order)}?\n\n` +
    `Amount due: $${due.toFixed(2)}\n\n` +
    `The customer gets an in-app notification and an email with payment instructions.`
  );
}

/** Send the reminder and show the outcome. Throws (after a toast) on failure. */
export async function remindCustomerToPay(order: Order): Promise<void> {
  try {
    const r = await sendPaymentReminderViaCloudFunction(order.id);
    if (r.email.state === 'sent') {
      toast.success(`Reminder #${r.reminderNumber} sent`, {
        description: `${order.customerName} was notified in the app and by email (${r.email.to}).`,
        duration: 5000,
      });
    } else {
      toast.warning(`Reminder #${r.reminderNumber} sent in the app only`, {
        description: `The email was not sent: ${describeEmailResult(r.email)}`,
        duration: 8000,
      });
    }
  } catch (error) {
    toast.error(callableErrorMessage(error, 'send the reminder'));
    throw error;
  }
}
