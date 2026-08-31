/**
 * Firestore Triggers — Pass 4 (M2 belt-and-braces)
 *
 * Auto-denormalizes parent order's customerId onto new snapshots / events
 * whenever they're created without it.
 *
 * Why both this AND client-side denormalization (in invoiceSnapshotService.ts)?
 *   The client-side denormalization is the primary path — it's free, and it
 *   means the field is set on the initial write. This trigger is a safety
 *   net for:
 *     1. Legacy code paths that write snapshots/events without going through
 *        invoiceSnapshotService.ts
 *     2. Admin scripts that bulk-create snapshots
 *     3. Future code that the original author forgot to update
 *
 * Cost: One write per snapshot/event creation that lacks customerId. Free
 * after the codebase fully migrates (no triggers fire because every write
 * already has the field).
 *
 * Idempotency: Trigger only fires once on `create`. If the field is already
 * present, the function exits without writing.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Backfill customerId onto a newly-created snapshot if missing.
 * Triggered: orders/{orderId}/snapshots/{snapId} on create.
 */
export const onSnapshotCreatedDenormalizeCustomerId = onDocumentCreated(
  "orders/{orderId}/snapshots/{snapId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Already has customerId — nothing to do
    if (data.customerId) return;

    const orderId = event.params.orderId;
    try {
      const orderSnap = await db.collection("orders").doc(orderId).get();
      if (!orderSnap.exists) return;
      const customerId = orderSnap.data()?.customerId as string | undefined;
      if (!customerId) return;

      await event.data!.ref.update({ customerId });
    } catch (err) {
      // Non-fatal — the rule's legacy fallback path (parent-doc get()) still
      // works, this trigger is just an optimization
      console.warn(
        `[onSnapshotCreated] Failed to denormalize customerId for ${event.params.snapId}:`,
        err
      );
    }
  }
);

/**
 * Same for events subcollection.
 * Triggered: orders/{orderId}/events/{eventId} on create.
 */
export const onEventCreatedDenormalizeCustomerId = onDocumentCreated(
  "orders/{orderId}/events/{eventId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.customerId) return;

    const orderId = event.params.orderId;
    try {
      const orderSnap = await db.collection("orders").doc(orderId).get();
      if (!orderSnap.exists) return;
      const customerId = orderSnap.data()?.customerId as string | undefined;
      if (!customerId) return;

      await event.data!.ref.update({ customerId });
    } catch (err) {
      console.warn(
        `[onEventCreated] Failed to denormalize customerId for ${event.params.eventId}:`,
        err
      );
    }
  }
);
