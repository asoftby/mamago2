import type {
  AntiRepeatEntry,
  AntiRepeatState,
  HeroCopySelectionIds,
  PickCandidate,
  WeatherScenario,
} from "./anti-repeat-types";
import type { CopyVariant } from "./hero-copy-pools";

// --- Weighted random (pure) ---

function weightOf(c: PickCandidate): number {
  const w = c.weight;
  if (w == null || Number.isNaN(w)) return 1;
  return w > 0 ? w : 0;
}

/**
 * Uniform fallback when all weights are <= 0.
 */
export function pickWeightedRandom(candidates: PickCandidate[]): PickCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const weights = candidates.map(weightOf);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx] ?? null;
  }

  let r = Math.random() * sum;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Weighted pick while avoiding the last `avoidLastN` ids in `recentIds`
 * (recentIds ordered oldest → newest; we block the tail slice).
 */
export function pickWeightedNonRepeating(
  candidates: PickCandidate[],
  recentIds: string[],
  options?: {
    avoidLastN?: number;
    fallbackToAny?: boolean;
  },
): PickCandidate | null {
  if (candidates.length === 0) return null;

  const avoidN = options?.avoidLastN ?? recentIds.length;
  const tail = recentIds.slice(Math.max(0, recentIds.length - avoidN));
  const blocked = new Set(tail);

  let pool = candidates.filter((c) => !blocked.has(c.id));
  const fallback = options?.fallbackToAny !== false;

  if (pool.length === 0 && fallback) {
    pool = candidates;
  }

  return pickWeightedRandom(pool);
}

export function countRecentMatches(
  entries: AntiRepeatEntry[],
  field: "microcopyId" | "titleId" | "subtitleId",
  id: string,
  lastN?: number,
): number {
  const slice = lastN != null ? entries.slice(-lastN) : entries;
  let n = 0;
  for (const e of slice) {
    if (e[field] === id) n++;
  }
  return n;
}

/**
 * Entries for this scenario, **newest first** (best for “what happened recently here”).
 */
export function getRecentEntriesForScenario(
  entries: AntiRepeatEntry[],
  scenario: WeatherScenario,
  lastN: number = 24,
): AntiRepeatEntry[] {
  const filtered = entries.filter((e) => e.scenario === scenario);
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  return filtered.slice(0, lastN);
}

function diffAgainstPrevious(
  ids: HeroCopySelectionIds,
  prev: AntiRepeatEntry,
): number {
  let d = 0;
  if (ids.microcopyId !== prev.microcopyId) d++;
  if (ids.titleId !== prev.titleId) d++;
  if (ids.subtitleId !== prev.subtitleId) d++;
  return d;
}

/** Prefer any id other than `forbiddenId`; if impossible, return null. */
function pickDifferentFrom(
  candidates: PickCandidate[],
  forbiddenId: string,
): PickCandidate | null {
  const pool = candidates.filter((c) => c.id !== forbiddenId);
  return pickWeightedRandom(pool);
}

/**
 * Picks micro/title/subtitle ids with anti-repeat heuristics.
 * Global `state.entries` is **oldest first, newest last** (append-only).
 */
export function selectHeroCopyIdsWithAntiRepeat(input: {
  scenario: WeatherScenario;
  candidateIds: {
    microcopy: PickCandidate[];
    titles: PickCandidate[];
    subtitles: PickCandidate[];
  };
  state: AntiRepeatState;
}): HeroCopySelectionIds | null {
  const { scenario, candidateIds, state } = input;
  const { microcopy, titles, subtitles } = candidateIds;

  if (microcopy.length === 0 || titles.length === 0 || subtitles.length === 0) {
    return null;
  }

  const entries = state.entries;
  const microHist = entries.map((e) => e.microcopyId);
  const titleHist = entries.map((e) => e.titleId);
  const subHist = entries.map((e) => e.subtitleId);

  const microPick = pickWeightedNonRepeating(microcopy, microHist, {
    avoidLastN: 3,
    fallbackToAny: true,
  });
  const titlePick = pickWeightedNonRepeating(titles, titleHist, {
    avoidLastN: 5,
    fallbackToAny: true,
  });
  const subPick = pickWeightedNonRepeating(subtitles, subHist, {
    avoidLastN: 5,
    fallbackToAny: true,
  });

  if (!microPick || !titlePick || !subPick) return null;

  let ids: HeroCopySelectionIds = {
    microcopyId: microPick.id,
    titleId: titlePick.id,
    subtitleId: subPick.id,
  };

  const recentSame = getRecentEntriesForScenario(entries, scenario, 1);
  const lastSame = recentSame[0];

  if (lastSame) {
    let guard = 0;
    while (diffAgainstPrevious(ids, lastSame) < 2 && guard < 10) {
      guard++;
      if (ids.microcopyId === lastSame.microcopyId) {
        const alt = pickDifferentFrom(microcopy, lastSame.microcopyId);
        if (alt) ids = { ...ids, microcopyId: alt.id };
        else break;
        continue;
      }
      if (ids.titleId === lastSame.titleId) {
        const alt = pickDifferentFrom(titles, lastSame.titleId);
        if (alt) ids = { ...ids, titleId: alt.id };
        else break;
        continue;
      }
      if (ids.subtitleId === lastSame.subtitleId) {
        const alt = pickDifferentFrom(subtitles, lastSame.subtitleId);
        if (alt) ids = { ...ids, subtitleId: alt.id };
        else break;
        continue;
      }
      break;
    }
  }

  return ids;
}

function copyVariantToCandidate(v: CopyVariant): PickCandidate {
  return { id: v.id, weight: v.weight };
}

/**
 * Maps copy pool variants to id picks (same rules as `selectHeroCopyIdsWithAntiRepeat`).
 */
export function selectCopyVariantsWithAntiRepeat(input: {
  scenario: WeatherScenario;
  packs: {
    microcopy: CopyVariant[];
    titles: CopyVariant[];
    subtitles: CopyVariant[];
  };
  state: AntiRepeatState;
}): HeroCopySelectionIds | null {
  return selectHeroCopyIdsWithAntiRepeat({
    scenario: input.scenario,
    candidateIds: {
      microcopy: input.packs.microcopy.map(copyVariantToCandidate),
      titles: input.packs.titles.map(copyVariantToCandidate),
      subtitles: input.packs.subtitles.map(copyVariantToCandidate),
    },
    state: input.state,
  });
}
