/**
 * Account administration — the only way an account's status changes or an
 * admin creates an account. Each function changes the profile, the Firebase
 * Auth user (sign-in really enabled/disabled) and the audit log together.
 * Rules: lib/accountRules.ts.
 *
 *   approveCustomer       pending/rejected → approved; customer emailed
 *   rejectCustomer        pending → rejected; sign-in disabled
 *   setCustomerSuspended  approved ⇄ suspended; sign-in disabled/enabled,
 *                         open sessions signed out
 *   adminCreateAccount    admin "Add account": Auth user + profile + code
 *
 * Deleting/archiving: deleteCustomerAccount (customers.ts).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { requireAdmin, appendAuditLog, type CallerProfile } from "./_shared";
import { reserveDailyId } from "./idGenerator";
import { WITH_EMAIL, emailAccountApproved, type EmailCallResult } from "./emails";
import {
  AccountRuleError,
  canSignIn,
  nextStatus,
  parseNewAccount,
  type AccountAction,
  type AccountStatus,
} from "./lib/accountRules";

const db = getFirestore();
/** Field prefix per action: approvedAt/By, rejectedAt/By, suspendedAt/By, reactivatedAt/By. */
const PAST: Record<AccountAction, string> = { approve: "approved", reject: "rejected", suspend: "suspended", reactivate: "reactivated" };
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function asHttps(err: unknown): never {
  if (err instanceof AccountRuleError) throw new HttpsError(err.code, err.message);
  throw err;
}

function targetUid(data: unknown, admin: CallerProfile): string {
  const uid = (data as any)?.uid;
  if (typeof uid !== "string" || !uid || uid.includes("/")) throw new HttpsError("invalid-argument", "uid is required.");
  if (uid === admin.uid) throw new HttpsError("failed-precondition", "You can't change your own account here.");
  return uid;
}

/** Enable/disable sign-in to match the status. Missing Auth users are tolerated. */
async function syncSignIn(uid: string, status: AccountStatus): Promise<void> {
  try {
    await getAuth().updateUser(uid, { disabled: !canSignIn(status) });
    if (!canSignIn(status)) await getAuth().revokeRefreshTokens(uid);
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") throw err;
  }
}

/** Change status in a transaction (so two admins can't race), then sync Auth. */
async function transition(
  admin: CallerProfile,
  uid: string,
  action: AccountAction,
  extra: Record<string, unknown> = {}
): Promise<{ status: AccountStatus; profile: Record<string, unknown> }> {
  const ref = db.doc(`customers/${uid}`);
  const out = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Account not found.");
    const profile = snap.data() ?? {};
    let status: AccountStatus;
    try {
      status = nextStatus(profile.status, action);
    } catch (err) {
      asHttps(err);
    }
    // Approving an account that never got a customer code assigns one.
    const code = action === "approve" && !str(profile.customerCode) && profile.customerType !== "admin"
      ? await reserveDailyId(tx, "CUST")
      : null;
    tx.update(ref, {
      status,
      ...extra,
      ...(code ? { customerCode: code } : {}),
      [`${PAST[action]}At`]: FieldValue.serverTimestamp(),
      [`${PAST[action]}By`]: admin.email,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { status, profile: { ...profile, ...(code ? { customerCode: code } : {}) } };
  });
  await syncSignIn(uid, out.status);
  await appendAuditLog({
    collection: "auditLogs",
    // Plain values only (extra may hold FieldValue.delete() for the profile).
    payload: {
      action: `ACCOUNT_${action.toUpperCase()}`,
      customerId: uid,
      adminId: admin.uid,
      adminEmail: admin.email,
      status: out.status,
      ...Object.fromEntries(Object.entries(extra).filter(([, v]) => typeof v === "string")),
    },
  });
  return out;
}

/** The admin's "new registration" alert is done once the request is decided. */
async function resolveRegistrationAlert(uid: string): Promise<void> {
  await db
    .doc(`notifications/admin/items/registration_${uid}`)
    .update({ read: true, updatedAt: FieldValue.serverTimestamp() })
    .catch(() => undefined); // older registrations have no alert
}

export const approveCustomer = onCall(WITH_EMAIL, async (request): Promise<{ uid: string; email: EmailCallResult }> => {
  const admin = await requireAdmin(request);
  const uid = targetUid(request.data, admin);
  const { profile } = await transition(admin, uid, "approve", { rejectionReason: FieldValue.delete() });
  await resolveRegistrationAlert(uid);
  const email = await emailAccountApproved(
    uid,
    { email: str(profile.email), storeName: str(profile.storeName), contactPerson: str(profile.contactPerson) },
    admin.email
  );
  return { uid, email };
});

export const rejectCustomer = onCall(async (request): Promise<{ uid: string }> => {
  const admin = await requireAdmin(request);
  const uid = targetUid(request.data, admin);
  const reason = str((request.data as any)?.reason).slice(0, 500);
  await transition(admin, uid, "reject", reason ? { rejectionReason: reason } : {});
  await resolveRegistrationAlert(uid);
  return { uid };
});

export const setCustomerSuspended = onCall(async (request): Promise<{ uid: string; status: AccountStatus }> => {
  const admin = await requireAdmin(request);
  const uid = targetUid(request.data, admin);
  const suspended = (request.data as any)?.suspended;
  if (typeof suspended !== "boolean") throw new HttpsError("invalid-argument", "suspended must be true or false.");
  const reason = str((request.data as any)?.reason).slice(0, 500);
  const { status } = await transition(
    admin,
    uid,
    suspended ? "suspend" : "reactivate",
    suspended ? (reason ? { suspensionReason: reason } : {}) : { suspensionReason: FieldValue.delete() }
  );
  return { uid, status };
});

export const adminCreateAccount = onCall(async (request): Promise<{ uid: string; customerCode: string | null }> => {
  const admin = await requireAdmin(request);
  let input;
  try {
    input = parseNewAccount(request.data);
  } catch (err) {
    asHttps(err);
  }

  let uid: string;
  try {
    const user = await getAuth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.contactPerson,
    });
    uid = user.uid;
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists.");
    }
    if (err?.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "The temporary password isn't strong enough.");
    }
    throw err;
  }

  try {
    const customerCode = await db.runTransaction(async (tx) => {
      const ref = db.doc(`customers/${uid}`);
      const code = input.customerType === "admin" ? null : await reserveDailyId(tx, "CUST");
      tx.set(ref, {
        id: uid,
        email: input.email,
        storeName: input.storeName,
        contactPerson: input.contactPerson,
        phone: input.phone,
        storeAddress: input.storeAddress,
        customerType: input.customerType,
        role: input.customerType === "admin" ? "admin" : "customer",
        status: "approved",
        ...(code ? { customerCode: code } : {}),
        createdBy: admin.email,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: admin.email,
        registeredAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return code;
    });
    await appendAuditLog({
      collection: "auditLogs",
      payload: { action: "ACCOUNT_CREATED_BY_ADMIN", customerId: uid, customerType: input.customerType, adminId: admin.uid, adminEmail: admin.email },
    });
    return { uid, customerCode };
  } catch (err) {
    // Never leave a sign-in without a profile behind.
    await getAuth().deleteUser(uid).catch(() => undefined);
    throw err;
  }
});
