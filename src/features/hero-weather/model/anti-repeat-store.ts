import type { AntiRepeatEntry, AntiRepeatState } from "./anti-repeat-types";

/** localStorage key — single namespace for hero copy history */
export const HERO_COPY_HISTORY_STORAGE_KEY = "mamago.hero.copyHistory";

const CURRENT_VERSION = 1 as const;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Cap total stored entries after TTL prune */
const MAX_ENTRIES = 80;

function emptyState(): AntiRepeatState {
  return { version: CURRENT_VERSION, entries: [] };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseStored(raw: string): AntiRepeatState | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as { version?: unknown; entries?: unknown };
    if (o.version !== CURRENT_VERSION) return null;
    if (!Array.isArray(o.entries)) return null;
    const entries: AntiRepeatEntry[] = [];
    for (const e of o.entries) {
      if (!e || typeof e !== "object") continue;
      const row = e as Partial<AntiRepeatEntry>;
      if (
        typeof row.timestamp !== "number" ||
        typeof row.scenario !== "string" ||
        typeof row.microcopyId !== "string" ||
        typeof row.titleId !== "string"
      ) {
        continue;
      }
      entries.push({
        timestamp: row.timestamp,
        scenario: row.scenario as AntiRepeatEntry["scenario"],
        microcopyId: row.microcopyId,
        titleId: row.titleId,
      });
    }
    return { version: CURRENT_VERSION, entries };
  } catch {
    return null;
  }
}

/**
 * Loads persisted state. SSR / missing storage / bad JSON / wrong version → empty state.
 */
export function loadAntiRepeatState(): AntiRepeatState {
  if (!isBrowser()) return emptyState();
  try {
    const raw = window.localStorage.getItem(HERO_COPY_HISTORY_STORAGE_KEY);
    if (raw == null || raw === "") return emptyState();
    const parsed = parseStored(raw);
    if (!parsed) return emptyState();
    return pruneAntiRepeatState(parsed, Date.now());
  } catch {
    return emptyState();
  }
}

/**
 * Persists state. Fails silently if storage unavailable or quota exceeded.
 */
export function saveAntiRepeatState(state: AntiRepeatState): void {
  if (!isBrowser()) return;
  try {
    const pruned = pruneAntiRepeatState(state, Date.now());
    window.localStorage.setItem(HERO_COPY_HISTORY_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // quota / private mode / disabled
  }
}

/**
 * Append one entry. Entries are kept **oldest first, newest last** (chronological).
 */
export function appendAntiRepeatEntry(state: AntiRepeatState, entry: AntiRepeatEntry): AntiRepeatState {
  const next: AntiRepeatState = {
    version: CURRENT_VERSION,
    entries: [...state.entries, entry],
  };
  return pruneAntiRepeatState(next, Date.now());
}

/**
 * Drop entries older than TTL, then cap length by dropping oldest (front of array).
 */
export function pruneAntiRepeatState(state: AntiRepeatState, now: number = Date.now()): AntiRepeatState {
  const cutoff = now - TTL_MS;
  let entries = state.entries.filter((e) => e.timestamp >= cutoff);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  return { version: CURRENT_VERSION, entries };
}

export { MAX_ENTRIES, TTL_MS };
