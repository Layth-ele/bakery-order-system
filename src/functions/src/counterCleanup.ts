/**
 * counterCleanup — Scheduled Cloud Function
 *
 * Deletes idCounters documents older than 90 days.
 * Runs on the 1st of every month at 03:00 Vancouver time.
 *
 * Why 90 days?
 *   - Keeps ~3 months of counter history for auditing
 *   - Prevents unbounded collection growth (1 doc/day × 3 prefixes = ~90 docs/month)
 *   - After 90 days the counters are no longer needed (IDs are embedded in invoices/orders)
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();
const RETENTION_DAYS = 90;

export const cleanupOldCounters = onSchedule(
  {
    schedule: "0 3 1 * *",          // 1st of every month, 03:00 UTC
    timeZone: "America/Vancouver",   // Vancouver midnight = business day boundary
    region: "us-central1",
  },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffTs = Timestamp.fromDate(cutoff);

    const countersRef = db.collection("idCounters");

    // Fetch all counter documents updated before the cutoff
    const snapshot = await countersRef
      .where("updatedAt", "<", cutoffTs)
      .get();

    if (snapshot.empty) {
      console.log("✅ [counterCleanup] No old counter documents to delete.");
      return;
    }

    // Delete in batches of 400 (Firestore batch limit = 500)
    const BATCH_SIZE = 400;
    let deleted = 0;

    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      snapshot.docs.slice(i, i + BATCH_SIZE).forEach(doc => {
        batch.delete(doc.ref);
        deleted++;
      });
      await batch.commit();
    }

    console.log(`✅ [counterCleanup] Deleted ${deleted} counter documents older than ${RETENTION_DAYS} days.`);
  }
);
