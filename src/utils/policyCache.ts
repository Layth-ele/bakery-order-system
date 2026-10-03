/**
 * The bakery's live policy (Settings → Policies & timing) for code that
 * can't use hooks (cutoff helpers). Kept current by GlobalSettingsSync
 * (contexts/AppProviders); defaults until Settings load.
 * Same resolver the Cloud Functions use (functions/src/lib/settingsValues).
 */
import { resolvePolicy, type BakeryPolicy } from '../functions/src/lib/settingsValues';

let current: BakeryPolicy = resolvePolicy(null);

export function setPolicySettings(settings: Record<string, unknown> | null | undefined): void {
  current = resolvePolicy(settings ?? null);
}

export const getPolicy = (): BakeryPolicy => current;
