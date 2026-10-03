/**
 * bootstrapSettings — Cloud Function callable
 *
 * FIX T2R8-H7 (HIGH — settings bootstrap for non-admin first user):
 *
 * Background: the Firestore rule on /settings/general is
 *   allow write: if isAnyAdmin();
 * If a non-admin customer is the FIRST person to load the app after a
 * fresh deploy or settings deletion, the client-side `setDoc` call in
 * `getSettings()` fails with permission-denied — and the app's settings
 * load chain breaks for that customer.
 *
 * This CF runs with Admin SDK privileges (bypasses Firestore rules) and
 * creates the settings document with safe defaults if it doesn't exist
 * yet. Idempotent: returns the existing document if already present.
 *
 * Authorization: callable by ANY authenticated user (anyone signed in
 * can request settings bootstrap on first load). The CF only WRITES if
 * the document is missing — it never overwrites an existing settings
 * document, so a malicious caller cannot reset the admin's configured
 * settings via this endpoint.
 *
 * Idempotency: the document write is wrapped in a transaction that
 * checks existence first. Concurrent calls are safe — only one creates
 * the document; the others read the freshly-created one.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {
  DEFAULT_DELIVERY_FEE,
  DEFAULT_FREE_DELIVERY_MIN,
  DEFAULT_SERVICE_CHARGE,
  DEFAULT_TAX_RATE,
} from "./lib/settingsValues";

const db = getFirestore();

/**
 * Default settings — must match the client's DEFAULT_SETTINGS in
 * src/firebase/firestore/settings.ts. Any field added there should be added here
 * too. Kept minimal here to avoid drift; client adds optional fields via
 * subsequent admin updates.
 */
const DEFAULT_SETTINGS = {
  // Money — the field names and defaults lib/settingsValues reads, so a
  // fresh install charges exactly what the resolvers assume.
  gstRate: DEFAULT_TAX_RATE,
  freeDeliveryMin: DEFAULT_FREE_DELIVERY_MIN,
  deliveryFee: DEFAULT_DELIVERY_FEE,
  serviceChargeEnabled: true,
  serviceChargeAmount: DEFAULT_SERVICE_CHARGE,
  cancellationFeePercent: 0,    // Admin → Settings (cancel dialog default)
  // Order workflow
  weeklyOrderCutoffDay: 5,      // Friday
  weeklyOrderCutoffHour: 12,    // Noon Vancouver
  // Schema version — used by future migrations
  schemaVersion: 1,
};

export const bootstrapSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const ref = db.collection("settings").doc("general");

  // Transaction-based read-or-create. Concurrent callers see a single create.
  const settings = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      // Document already exists — never overwrite. Return existing.
      return snap.data() as Record<string, any>;
    }

    // Create with defaults. Use server timestamp for createdAt so admin
    // can audit when the auto-bootstrap happened.
    const docToCreate = {
      ...DEFAULT_SETTINGS,
      createdAt: new Date().toISOString(),
      bootstrappedBy: request.auth!.uid,
      bootstrappedAt: new Date().toISOString(),
    };
    tx.set(ref, docToCreate);
    return docToCreate;
  });

  return { settings };
});
