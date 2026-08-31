/**
 * Snapshot/Event customerId Backfill — Pass 4 (M2)
 *
 * One-time admin-callable function that walks all orders and, for each order,
 * walks its `snapshots` and `events` subcollections, denormalizing the parent
 * order's customerId onto each child doc that doesn't already have it.
 *
 * Why:
 *   The Pass 1 audit identified that snapshot/event reads were billing 3 reads
 *   apiece (the doc + parent-doc get() + isAnyAdmin() get()). After this
 *   backfill runs, the Firestore rule's fast path activates and reads drop to
 *   1-2 billed reads per snapshot, every read.
 *
 * Operationally:
 *   - Idempotent: running twice does nothing on already-backfilled docs
 *   - Resumable: stores progress in `backfillState/snapshotCustomerId`
 *   - Bounded: processes max 200 orders per invocation, 500 child docs per
 *     batch (Firestore batch limit)
 *   - Admin-only
 *
 * Usage:
 *   const fn = httpsCallable(functions, 'backfillSnapshotCustomerId');
 *   let cursor = null;
 *   while (true) {
 *     const result = await fn({ cursor, dryRun: false });
 *     console.log(result.data);
 *     if (result.data.done) break;
 *     cursor = result.data.nextCursor;
 *   }
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "./_shared";

const db = getFirestore();

interface BackfillInput {
  cursor?: string | null;
  dryRun?: boolean;
  pageSize?: number;
}

interface BackfillOutput {
  ordersScanned: number;
  snapshotsUpdated: number;
  snapshotsSkipped: number;
  eventsUpdated: number;
  eventsSkipped: number;
  done: boolean;
  nextCursor: string | null;
  dryRun: boolean;
}

const MAX_ORDERS_PER_INVOCATION = 200;
const MAX_BATCH_SIZE = 400; // Firestore limit is 500; leave headroom

export const backfillSnapshotCustomerId = onCall<BackfillInput>(async (request) => {
  await requireAdmin(request);

  const { cursor = null, dryRun = false, pageSize = MAX_ORDERS_PER_INVOCATION } = request.data ?? {};
  const limit = Math.min(pageSize, MAX_ORDERS_PER_INVOCATION);

  // Build orders query — paginate by document ID to be resumable
  let q = db.collection("orders").orderBy("__name__").limit(limit);
  if (cursor) {
    q = q.startAfter(cursor);
  }

  const ordersSnap = await q.get();
  if (ordersSnap.empty) {
    return {
      ordersScanned: 0,
      snapshotsUpdated: 0,
      snapshotsSkipped: 0,
      eventsUpdated: 0,
      eventsSkipped: 0,
      done: true,
      nextCursor: null,
      dryRun,
    } satisfies BackfillOutput;
  }

  let snapshotsUpdated = 0;
  let snapshotsSkipped = 0;
  let eventsUpdated = 0;
  let eventsSkipped = 0;

  // Process each order's subcollections
  for (const orderDoc of ordersSnap.docs) {
    const orderData = orderDoc.data();
    const customerId = orderData?.customerId as string | undefined;

    // Order has no customerId — skip (this is itself a data quality issue worth logging)
    if (!customerId) {
      console.warn(`[backfill] Order ${orderDoc.id} has no customerId; skipping its subcollections`);
      continue;
    }

    // Process snapshots
    const [snapsResult, eventsResult] = await Promise.all([
      backfillSubcollection(orderDoc.ref.collection("snapshots"), customerId, dryRun),
      backfillSubcollection(orderDoc.ref.collection("events"), customerId, dryRun),
    ]);
    snapshotsUpdated += snapsResult.updated;
    snapshotsSkipped += snapsResult.skipped;
    eventsUpdated += eventsResult.updated;
    eventsSkipped += eventsResult.skipped;
  }

  // Determine cursor for next invocation
  const lastDoc = ordersSnap.docs[ordersSnap.docs.length - 1];
  const done = ordersSnap.size < limit;

  // Persist progress so it's visible to admins between invocations
  if (!dryRun) {
    await db.collection("backfillState").doc("snapshotCustomerId").set(
      {
        lastCursor: lastDoc.id,
        done,
        lastRunAt: FieldValue.serverTimestamp(),
        totalSnapshotsUpdated: FieldValue.increment(snapshotsUpdated),
        totalEventsUpdated: FieldValue.increment(eventsUpdated),
      },
      { merge: true }
    );
  }

  return {
    ordersScanned: ordersSnap.size,
    snapshotsUpdated,
    snapshotsSkipped,
    eventsUpdated,
    eventsSkipped,
    done,
    nextCursor: done ? null : lastDoc.id,
    dryRun,
  } satisfies BackfillOutput;
});

async function backfillSubcollection(
  ref: FirebaseFirestore.CollectionReference,
  customerId: string,
  dryRun: boolean
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;

  const snap = await ref.get();
  if (snap.empty) return { updated: 0, skipped: 0 };

  // Walk in batches of MAX_BATCH_SIZE
  let batch = db.batch();
  let batchCount = 0;

  for (const childDoc of snap.docs) {
    const data = childDoc.data();
    if (data?.customerId) {
      // Already has customerId — skip (idempotent)
      skipped++;
      continue;
    }

    if (!dryRun) {
      batch.update(childDoc.ref, { customerId });
      batchCount++;
      // Commit when batch is full
      if (batchCount >= MAX_BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    updated++;
  }

  // Commit any remaining batched writes
  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  return { updated, skipped };
}
