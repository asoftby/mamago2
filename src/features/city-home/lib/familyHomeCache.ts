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
    this.denied.set(JSON.stringify([selectedChildId, id]), until);
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
    this.entries.set(familyHomeCacheKey(context, city, selected, data.window.horizonDays), { data, until: Math.min(now + HOME_CACHE_TTL_MS, ...data.items.map(item => "startsAt" in item ? Date.parse(String(item.startsAt)) : Infinity)) });
  }
}
