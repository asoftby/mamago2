import { familyHomeCacheKey, type HomeFamilyContext } from "./familyHome";
export const HOME_CACHE_TTL_MS = 120_000;
export const HOME_DISMISS_TTL_MS = 60 * 86_400_000;
export type HomeDismissal = { id: string; at: number; token: string; exposureId: string | null; city: string; saved: boolean; selectedChildId?: string | null };
export function readHomeDismissals(actor: string, now = Date.now()): HomeDismissal[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`mg_family_home_dismissed:${actor}`) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is HomeDismissal => entry && typeof entry.id === "string" && typeof entry.at === "number"
      && typeof entry.token === "string" && typeof entry.city === "string" && typeof entry.saved === "boolean"
      && (entry.exposureId === null || typeof entry.exposureId === "string")
      && (entry.selectedChildId == null || typeof entry.selectedChildId === "string") && entry.at <= now && now - entry.at < HOME_DISMISS_TTL_MS).slice(-200);
  } catch { return []; }
}
export function writeHomeDismissals(actor: string, entries: HomeDismissal[]) {
  try { localStorage.setItem(`mg_family_home_dismissed:${actor}`, JSON.stringify(entries.slice(-200))); } catch { /* Visit memory still applies. */ }
}
/** Each pending token is attempted at most once per pass. A rejected/removed
 * child must not block later valid dismissals; failures remain retryable. */
export async function drainPendingHomeDismissals(
  entries: () => HomeDismissal[],
  canSend: () => boolean,
  send: (entry: HomeDismissal) => Promise<void>,
  onSaved: () => void,
  onFailed: () => void,
) {
  const attempted = new Set<string>();
  while (canSend()) {
    const entry = entries().find(value => !value.saved && !attempted.has(value.token));
    if (!entry) return;
    attempted.add(entry.token);
    try {
      await send(entry);
      if (!canSend()) return;
      entry.saved = true;
      onSaved();
    } catch {
      // Preserve the failed entry for a later pass; continue past 404/5xx.
      if (canSend()) onFailed();
    }
  }
}
export class FamilyHomeCache<T extends { items: { id: string }[]; window: { horizonDays: 7 | 30 } }> {
  private entries = new Map<string, { data: T; until: number }>();
  private denied = new Map<string, number>();
  private generation = 0;
  constructor(readonly actorId: string) {}
  begin() { return ++this.generation; }
  current(generation: number) { return generation === this.generation; }
  clear() { this.entries.clear(); }
  cancel() { ++this.generation; this.clear(); }
  dismiss(id: string, until = Date.now() + HOME_DISMISS_TTL_MS, selectedChildId: string | null = null) {
    const key = JSON.stringify([selectedChildId, id]);
    // Rehydrating an already-known dismissal must not wipe valid feed entries
    // when the home component remounts after navigating to another page.
    if ((this.denied.get(key) ?? 0) >= until) return;
    this.denied.set(key, until);
    this.clear();
  }
  filter(data: T, now = Date.now(), selectedChildId: string | null = null): T {
    for (const [key, until] of this.denied) if (until <= now) this.denied.delete(key);
    return { ...data, items: data.items.filter(item =>
      !this.denied.has(JSON.stringify([null, item.id]))
      && !this.denied.has(JSON.stringify([selectedChildId, item.id]))) };
  }
  get(context: HomeFamilyContext, city: string, selected: string | null, now = Date.now()): T | null {
    if (context.actorId !== this.actorId) { this.cancel(); return null; }
    for (const horizon of [7, 30] as const) {
      const key = familyHomeCacheKey(context, city, selected, horizon);
      const entry = this.entries.get(key);
      if (entry && entry.until > now) return this.filter(entry.data, now, selected);
      this.entries.delete(key);
    }
    return null;
  }
  set(context: HomeFamilyContext, city: string, selected: string | null, data: T, now = Date.now()) {
    if (context.actorId !== this.actorId) return;
    const upcoming = data.items.flatMap(item => {
      if (!("startsAt" in item) || !item.startsAt) return [];
      const timestamp = Date.parse(String(item.startsAt));
      return Number.isFinite(timestamp) ? [timestamp] : [];
    });
    for (const [key, entry] of this.entries) if (entry.until <= now) this.entries.delete(key);
    // Limit retained selections/cities even when a user keeps changing filters.
    if (this.entries.size >= 32) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(familyHomeCacheKey(context, city, selected, data.window.horizonDays), { data, until: Math.min(now + HOME_CACHE_TTL_MS, ...upcoming) });
  }
}

/** One bounded, tab-local cache survives home component remounts, but never
 * keeps another account's recommendations after an actor switch. No storage. */
let sharedHomeCache: FamilyHomeCache<{ items: { id: string }[]; window: { horizonDays: 7 | 30 } }> | null = null;
export function getSharedFamilyHomeCache<T extends { items: { id: string }[]; window: { horizonDays: 7 | 30 } }>(actorId: string): FamilyHomeCache<T> {
  // Never reuse private data between requests during server-side rendering.
  if (typeof window === "undefined") return new FamilyHomeCache<T>(actorId);
  if (!sharedHomeCache || sharedHomeCache.actorId !== actorId) {
    sharedHomeCache?.cancel();
    sharedHomeCache = new FamilyHomeCache(actorId);
  }
  return sharedHomeCache as FamilyHomeCache<T>;
}
export function clearSharedFamilyHomeCache() {
  sharedHomeCache?.cancel();
  sharedHomeCache = null;
}
