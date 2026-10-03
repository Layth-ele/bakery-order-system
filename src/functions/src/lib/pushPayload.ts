/**
 * pushPayload — what a phone push says for an in-app notification
 * (no Firebase). Used by pushNotifications.ts; tested in __tests__.
 */
type Doc = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export interface PushData {
  title: string;
  body: string;
  /** Page the tap opens. */
  url: string;
  /** Same tag replaces an older notification about the same thing. */
  tag: string;
  /** Unread count for the app-icon badge (string: FCM data is strings). */
  badge: string;
  [key: string]: string;
}

/** Where a notification lives: notifications/{parent}/items/{id}. */
export function recipientOf(parent: string): { audience: "admin" } | { audience: "customer"; uid: string } | null {
  if (parent === "admin") return { audience: "admin" };
  if (parent.startsWith("user_") && parent.length > 5) return { audience: "customer", uid: parent.slice(5) };
  return null;
}

/** Plain-text body: first lines of the message, emoji bullets kept, max 180 chars. */
export function pushBody(message: string): string {
  const flat = message.replace(/\s*\n+\s*/g, " · ").replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 177).trimEnd()}…` : flat;
}

export function buildPushData(content: Doc, audience: "admin" | "customer", unread: number, id: string): PushData {
  return {
    title: str(content.title) || "Delight Bakehouse",
    body: pushBody(str(content.message)),
    url: audience === "admin" ? "/admin" : "/customer",
    tag: str(content.orderId) ? `order-${str(content.orderId)}` : id,
    badge: String(Math.max(0, Math.floor(unread))),
  };
}

/** FCM errors meaning the token is gone for good (remove it from the account). */
export const DEAD_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];
