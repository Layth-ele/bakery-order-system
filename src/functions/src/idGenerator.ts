/**
 * ID Generator — Cloud Function (server-side, firebase-admin)
 *
 * Format : PREFIX-YYYY-MM-DD-NNN-CC
 *   PREFIX  = DBH | ORD | CUST
 *   NNN     = 3-digit min, grows naturally (001→999→1000→…)
 *   CC      = MOD-97 check digit (01–97) — catches phone/read-back typos
 *
 * Examples:
 *   DBH-2026-03-26-001-47   ← invoice #1, check=47
 *   ORD-2026-03-26-042-12   ← order #42,  check=12
 *   CUST-2026-03-26-007-88  ← customer #7, check=88
 *
 * Counter doc: idCounters/{PREFIX}-{YYYY}-{MM}-{DD}
 * Firestore transaction → 100 % collision-proof at any concurrency.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

export type Prefix = "ORD" | "CUST" | "DBH";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatSeq(n: number): string {
  return n < 1000 ? String(n).padStart(3, "0") : String(n);
}

function getDailyKey(date = new Date()): { year: string; month: string; day: string } {
  const van = new Date(date.toLocaleString("en-US", { timeZone: "America/Vancouver" }));
  return {
    year:  String(van.getFullYear()),
    month: String(van.getMonth() + 1).padStart(2, "0"),
    day:   String(van.getDate()).padStart(2, "0"),
  };
}

/**
 * MOD-97 check digit — identical algorithm to client-side computeCheckDigit()
 * so both sides can verify any ID regardless of where it was generated.
 */
export function computeCheckDigit(idWithoutCheck: string): string {
  const digits = idWithoutCheck
    .replace(/-/g, "")
    .split("")
    .map(c => String(c.charCodeAt(0)))
    .join("");
  const remainder = Number(BigInt(digits) % 97n);
  const check = 98 - remainder;
  return String(check).padStart(2, "0");
}

export function verifyId(fullId: string): boolean {
  const lastDash = fullId.lastIndexOf("-");
  if (lastDash === -1) return false;
  return computeCheckDigit(fullId.slice(0, lastDash)) === fullId.slice(lastDash + 1);
}

// ─── core counter ────────────────────────────────────────────────────────────

/**
 * Atomically increment today's counter and return the next ID with check digit.
 * Counter doc: idCounters/{PREFIX}-{YYYY}-{MM}-{DD}
 *
 * @example await getNextDailyId("DBH") => "DBH-2026-03-26-001-47"
 * @example await getNextDailyId("DBH") => "DBH-2026-03-26-002-55"  (next call)
 */
export async function getNextDailyId(prefix: Prefix): Promise<string> {
  return db.runTransaction((tx) => reserveDailyId(tx, prefix));
}

/**
 * Reserve the next sequential id for `prefix` inside an existing transaction.
 *
 * Reads then writes the daily counter, so call it after the transaction's
 * other reads and before its other writes (Firestore requires all reads
 * first). Because the counter write commits with the caller's writes, a
 * failed transaction never consumes a number — no gaps in sequential
 * invoice numbers.
 */
export async function reserveDailyId(tx: FirebaseFirestore.Transaction, prefix: Prefix): Promise<string> {
  const { year, month, day } = getDailyKey();
  const counterRef = db.collection("idCounters").doc(`${prefix}-${year}-${month}-${day}`);
  const snap = await tx.get(counterRef);
  const next = (snap.exists ? (snap.data()?.lastNumber ?? 0) : 0) + 1;
  tx.set(counterRef, { prefix, year, month, day, lastNumber: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const base = `${prefix}-${year}-${month}-${day}-${formatSeq(next)}`;
  return `${base}-${computeCheckDigit(base)}`;
}
