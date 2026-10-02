/**
 * onOrderLifecycle — the single place order side effects happen.
 *
 * Fires on every write to orders/{orderId} and runs
 * lib/orderSideEffects.runOrderSideEffects(), which derives lifecycle events
 * and for each one:
 *   1. writes the in-app notifications (lib/orderNotifications.ts)
 *   2. sends the customer email (emails.ts → sendOrderStatusEmail)
 *
 * Because it reacts to the order document itself, every path that changes
 * an order's status — placeOrder, approveOrder / rejectOrder / cancelOrder /
 * confirmOrderPayment, completion — produces the same notifications and
 * emails exactly once. Nothing else writes lifecycle notifications.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { runOrderSideEffects } from "./lib/orderSideEffects";
import { sendOrderStatusEmail, WITH_EMAIL } from "./emails";
import { writeNotification } from "./notify";

export const onOrderLifecycle = onDocumentWritten(
  { document: "orders/{orderId}", ...WITH_EMAIL },
  async (event) => {
    const orderId = event.params.orderId;
    const results = await runOrderSideEffects(event.data?.before?.data(), event.data?.after?.data(), orderId, {
      writeNotification,
      sendStatusEmail: sendOrderStatusEmail,
    });
    for (const r of results) {
      if (!r.ok) console.error(`[onOrderLifecycle] ${orderId} ${r.label} failed:`, r.error);
    }
  }
);
