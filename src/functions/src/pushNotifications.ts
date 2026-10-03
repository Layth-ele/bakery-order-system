/**
 * Phone push for every new in-app notification.
 *
 * Trigger: notifications/{parent}/items/{id} created (all notification writes
 * go through notify.ts, inside the same transaction as the change). The push
 * goes to the devices saved on the account(s) — customers/{uid}.fcmTokens —
 * set by the web app when the user turns notifications on
 * (src/services/pushNotifications.ts). Dead tokens are removed.
 *
 * Best effort: a failed push never affects the order/notification itself.
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DEAD_TOKEN_CODES, buildPushData, recipientOf } from "./lib/pushPayload";

const db = getFirestore();

export const onNotificationCreated = onDocumentCreated("notifications/{parent}/items/{id}", async (event) => {
  const content = event.data?.data();
  const { parent, id } = event.params;
  if (!content || content.read === true) return; // already-resolved records aren't news
  const to = recipientOf(parent);
  if (!to) return;

  try {
    // Who gets it, and each person's device tokens.
    const accounts =
      to.audience === "admin"
        ? (await db.collection("customers").where("customerType", "==", "admin").get()).docs
        : [await db.doc(`customers/${to.uid}`).get()].filter((d) => d.exists);
    const owners = new Map<string, string>(); // token → account id
    for (const a of accounts) {
      const tokens = a.data()?.fcmTokens;
      if (Array.isArray(tokens)) for (const t of tokens) if (typeof t === "string" && t) owners.set(t, a.id);
    }
    if (owners.size === 0) return;

    const unread = (await db.collection(`notifications/${parent}/items`).where("read", "==", false).count().get()).data().count;
    const tokens = [...owners.keys()];
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: buildPushData(content, to.audience, unread, id),
      webpush: { headers: { Urgency: "high", TTL: String(24 * 60 * 60) } },
    });

    // Remove tokens of uninstalled apps / revoked permissions.
    const dead = new Map<string, string[]>();
    res.responses.forEach((r, i) => {
      if (!r.success && r.error && DEAD_TOKEN_CODES.includes(r.error.code)) {
        const owner = owners.get(tokens[i])!;
        dead.set(owner, [...(dead.get(owner) ?? []), tokens[i]]);
      }
    });
    for (const [owner, gone] of dead) {
      await db.doc(`customers/${owner}`).update({ fcmTokens: FieldValue.arrayRemove(...gone) });
    }
    console.log(`[onNotificationCreated] ${parent}/${id}: sent ${res.successCount}/${tokens.length}, removed ${[...dead.values()].flat().length}`);
  } catch (err) {
    console.error(`[onNotificationCreated] ${parent}/${id} push failed:`, err);
  }
});
