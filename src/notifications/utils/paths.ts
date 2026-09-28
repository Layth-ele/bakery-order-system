/**
 * Firestore notification paths — the only place these are spelled out
 * (the Cloud Functions use the same layout in orderLifecycleTrigger.ts,
 * and firestore.rules protects it):
 *
 *   notifications/admin/items/{id}         admin feed
 *   notifications/user_{uid}/items/{id}    one feed per customer
 */

/** ['notifications', 'user_{customerId}', 'items'] — spread into collection()/doc(). */
export function getCustomerNotificationPath(customerId: string): [string, string, string] {
  return ['notifications', `user_${customerId}`, 'items'];
}

/** ['notifications', 'admin', 'items'] — spread into collection()/doc(). */
export function getAdminNotificationPath(): [string, string, string] {
  return ['notifications', 'admin', 'items'];
}
