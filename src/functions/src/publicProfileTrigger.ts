/**
 * onSettingsWritten — keeps publicProfile/business in sync with
 * settings/general (see lib/publicProfile.ts for what is public and why).
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { buildPublicProfile, samePublicProfile } from "./lib/publicProfile";

const db = getFirestore();

export const onSettingsWritten = onDocumentWritten("settings/general", async (event) => {
  const profile = buildPublicProfile(event.data?.after?.data());
  const ref = db.doc("publicProfile/business");
  const current = (await ref.get()).data();
  // Saving unrelated settings (prices, policies…) shouldn't rewrite the card.
  if (samePublicProfile(current, profile)) return;
  await ref.set({ ...profile, updatedAt: FieldValue.serverTimestamp() });
  console.log("[onSettingsWritten] public profile updated");
});
