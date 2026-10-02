/**
 * Customer Cloud Functions — HARDENED (Pass 1)
 *
 * Fixes from audit:
 *   - C4: createCustomerWithCode now RETURNS { id, customerCode } as documented.
 *   - H3: deleteCustomerAccount now performs CASCADE DELETE across:
 *         orders, invoices, creditNotes, creditApplicationHistory,
 *         orderEditHistory, notifications/user_{uid}/items/* , and storage objects.
 *         Recommended: prefer SOFT delete (archive) over hard delete; hard delete
 *         is opt-in via { hardDelete: true } parameter.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Query } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { reserveDailyId } from "./idGenerator";

const db = getFirestore();

interface CreateCustomerInput {
  uid: string;
  email: string;
  storeName: string;
  contactPerson?: string;
  phone?: string;
  storeAddress?: string;
  customerType?: "individual" | "commercial";
}

const clean = (v: unknown, max = 300): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Self-registration: create the new user's customer profile (status
 * "pending", sequential customer code) and the admin's NEW_REGISTRATION
 * notification — in one transaction, so every registration is announced
 * exactly once. The web app calls this right after creating the Auth user.
 */
export const createCustomerWithCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to create a customer profile.");
  }

  const data = (request.data ?? {}) as CreateCustomerInput;
  if (!data.uid || typeof data.uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  // Caller can only create their own profile
  if (request.auth.uid !== data.uid) {
    throw new HttpsError("permission-denied", "You can only create a customer profile for yourself.");
  }
  const email = clean(request.auth.token.email ?? data.email).toLowerCase();
  const storeName = clean(data.storeName, 200);
  if (!email) throw new HttpsError("invalid-argument", "email is required.");
  if (!storeName) throw new HttpsError("invalid-argument", "storeName is required.");
  const customerType = data.customerType === "commercial" ? "commercial" : "individual";

  const customerRef = db.collection("customers").doc(data.uid);
  const notifRef = db.collection("notifications").doc("admin").collection("items").doc(`registration_${data.uid}`);

  const customerCode = await db.runTransaction(async (tx) => {
    const existing = await tx.get(customerRef);
    if (existing.exists) {
      throw new HttpsError("already-exists", "Customer profile already exists for this user.");
    }
    const code = await reserveDailyId(tx, "CUST");
    tx.set(customerRef, {
      id: data.uid,
      customerCode: code,
      email,
      storeName,
      contactPerson: clean(data.contactPerson, 200),
      phone: clean(data.phone, 50),
      storeAddress: clean(data.storeAddress, 500),
      role: "customer",
      customerType,
      status: "pending",
      registeredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(notifRef, {
      id: notifRef.id,
      type: "NEW_REGISTRATION", // see src/types/notification-contract.ts
      title: "🆕 New Registration Request",
      message: `New customer registration: ${storeName} (${email})`,
      orderId: "",
      customerId: data.uid,
      customerName: storeName,
      actions: [{ type: "VIEW_REGISTRATION", label: "Review Request" }],
      source: "server",
      metadata: { customerId: data.uid, customerEmail: email, customerName: storeName, customerType },
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
    });
    return code;
  });

  return { id: data.uid, customerCode };
});

/**
 * Delete a single Firestore subcollection by paginated batches.
 */
async function deleteQueryBatched(query: Query, batchSize = 400): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    // If less than batchSize, we're done
    if (snap.size < batchSize) break;
  }
  return deleted;
}

/**
 * Delete all docs in a customer-keyed collection (where customerId == uid).
 */
async function deleteCustomerKeyedCollection(
  collection: string,
  uid: string,
): Promise<number> {
  return deleteQueryBatched(
    db.collection(collection).where("customerId", "==", uid)
  );
}

/**
 * Delete the customer's notifications subcollection: notifications/user_{uid}/items/*
 */
async function deleteCustomerNotifications(uid: string): Promise<number> {
  return deleteQueryBatched(
    db.collection("notifications").doc(`user_${uid}`).collection("items")
  );
}

/**
 * Delete all storage objects under a given prefix.
 */
async function deleteStoragePrefix(prefix: string): Promise<number> {
  try {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) return 0;
    await Promise.all(files.map(f => f.delete().catch(() => undefined)));
    return files.length;
  } catch (err) {
    console.warn(`[deleteStoragePrefix] Failed for ${prefix}:`, err);
    return 0;
  }
}

/**
 * Delete a customer.
 *
 * @param uid - target customer's Firebase Auth UID
 * @param hardDelete - if true (default false), permanently delete all data;
 *                     if false, soft-delete by setting status='archived' and
 *                     anonymizing PII while preserving order/invoice history.
 */
export const deleteCustomerAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to delete a customer.");
  }

  const callerUid = request.auth.uid;

  // Admin check
  const callerDoc = await db.collection("customers").doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data()?.customerType !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can delete customer accounts.");
  }

  const { uid, hardDelete = false } = (request.data ?? {}) as {
    uid?: string;
    hardDelete?: boolean;
  };
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "A valid customer uid is required.");
  }

  // Prevent self-deletion
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own admin account.");
  }

  // Verify the target exists
  const targetSnap = await db.collection("customers").doc(uid).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "Customer not found.");
  }

  // ─── SOFT DELETE PATH (default, recommended) ──────────────────────────────
  if (!hardDelete) {
    // Disable Auth account so they can't sign in, and end open sessions
    try {
      await getAuth().updateUser(uid, { disabled: true });
      await getAuth().revokeRefreshTokens(uid);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") {
        console.warn("[deleteCustomerAccount] Failed to disable Auth user:", err);
      }
    }

    // Mark customer as archived and anonymize PII (preserves order history)
    await db.collection("customers").doc(uid).update({
      status: "archived",
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: callerUid,
      // Anonymize PII per privacy regulations; keep storeName for invoice history
      email: `archived-${uid}@deleted.invalid`,
      phone: "",
      contactPerson: "",
      storeAddress: "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Audit log
    await db.collection("auditLogs").add({
      action: "CUSTOMER_ARCHIVED",
      customerId: uid,
      adminId: callerUid,
      hardDelete: false,
      timestamp: FieldValue.serverTimestamp(),
    });

    // A pending registration's admin alert is done once the account is closed.
    await db.doc(`notifications/admin/items/registration_${uid}`).update({ read: true }).catch(() => undefined);

    return { success: true, mode: "archived" };
  }

  // ─── HARD DELETE PATH (cascade) ───────────────────────────────────────────
  // FIX H3: Cascade across all customer-keyed collections + storage.
  //
  // FIX T2R6-H3 (HIGH — CRA Income Tax Act retention compliance):
  // The cascade below deletes from `invoices` and `orders` collections.
  // For a CRA-registered Canadian business, financial records (invoices,
  // orders backing invoices, GST audit trail) must be retained for **6
  // years from the end of the tax year they relate to**. Hard-deleting
  // these records exposes the bakery to CRA penalties under
  // s. 230 of the Income Tax Act and s. 286 of the Excise Tax Act.
  //
  // Mitigation already in place: the client never passes hardDelete=true
  // (always uses the soft-delete archive path above). This check defends
  // against:
  //   1. An admin manually invoking the CF with hardDelete=true via the
  //      Firebase console
  //   2. A future code path that mistakenly defaults to hardDelete=true
  //   3. A misconfigured admin tool
  //
  // Refuse the hard-delete request if the customer has ANY non-pending
  // invoices OR completed/in-process/delivered orders. Force the admin
  // to use the soft-delete archive path, which preserves all financial
  // records for the retention window.
  const customerInvoicesSnap = await db
    .collection("invoices")
    .where("customerId", "==", uid)
    .limit(1)
    .get();
  if (!customerInvoicesSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot hard-delete a customer with invoiced orders. Canadian tax " +
        "regulations require these records to be retained for 6 years from " +
        "the end of the relevant tax year. Use the soft-delete (archive) " +
        "path instead, which anonymizes PII while preserving the financial " +
        "audit trail."
    );
  }

  // Also check for any non-pending orders (completed/in_process/delivered/
  // approved). 'pending' and 'rejected' orders that never became invoices
  // are not subject to the same retention requirement.
  const retainedStatuses = ["approved", "in_process", "completed", "delivered"];
  const customerOrdersSnap = await db
    .collection("orders")
    .where("customerId", "==", uid)
    .where("status", "in", retainedStatuses)
    .limit(1)
    .get();
  if (!customerOrdersSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot hard-delete a customer with orders that progressed past " +
        "approval. These records may be subject to tax-record retention " +
        "requirements. Use the soft-delete (archive) path instead."
    );
  }

  // 1. Delete Auth user
  try {
    await getAuth().deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") {
      console.error("[deleteCustomerAccount] Failed to delete Auth user:", err);
      throw new HttpsError("internal", "Failed to delete the authentication account.");
    }
  }

  // 2. Delete Firestore documents in parallel where possible
  const cascadeResults = await Promise.allSettled([
    deleteCustomerKeyedCollection("orders", uid),
    deleteCustomerKeyedCollection("invoices", uid),
    deleteCustomerKeyedCollection("creditNotes", uid),
    deleteCustomerKeyedCollection("creditApplicationHistory", uid),
    deleteCustomerKeyedCollection("orderEditHistory", uid),
    deleteCustomerKeyedCollection("adjustments", uid),
    deleteCustomerNotifications(uid),
  ]);

  const deletedCounts = cascadeResults.map((r, i) => {
    const labels = [
      "orders",
      "invoices",
      "creditNotes",
      "creditApplicationHistory",
      "orderEditHistory",
      "adjustments",
      "notifications",
    ];
    return {
      collection: labels[i],
      ...(r.status === "fulfilled"
        ? { deleted: r.value }
        : { error: String(r.reason) }),
    };
  });

  // 3. Delete storage objects
  const storageResults = await Promise.allSettled([
    deleteStoragePrefix(`payment-proofs/${uid}/`),
    deleteStoragePrefix(`profiles/${uid}/`),
    deleteStoragePrefix(`invoices/${uid}/`),
  ]);
  const storageDeletedCounts = storageResults.map((r, i) => {
    const paths = ["payment-proofs", "profiles", "invoices"];
    return {
      path: paths[i],
      ...(r.status === "fulfilled"
        ? { deleted: r.value }
        : { error: String(r.reason) }),
    };
  });

  // 4. Finally delete the customer doc itself (and its registration alert)
  await db.collection("customers").doc(uid).delete();
  await db.doc(`notifications/admin/items/registration_${uid}`).delete().catch(() => undefined);

  // 5. Write audit log (this is the ONLY record that the customer ever existed)
  await db.collection("auditLogs").add({
    action: "CUSTOMER_HARD_DELETED",
    customerId: uid,
    adminId: callerUid,
    hardDelete: true,
    cascade: deletedCounts,
    storage: storageDeletedCounts,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    mode: "deleted",
    cascade: deletedCounts,
    storage: storageDeletedCounts,
  };
});
