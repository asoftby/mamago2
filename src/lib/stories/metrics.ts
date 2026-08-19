import type { StoryRailItem } from "./items";

/** Parent entity key for cross-slot identity (not session-level item id). */
export function parentEntityKey(item: Pick<StoryRailItem, "entityKind" | "entityId">): string {
  return `${item.entityKind}:${item.entityId}`;
}

/**
 * Lower-bound estimate of visual duplicates inside a slot:
 * pairs sharing the same placeId AND the same cover MediaAsset id.
 * Report-only — never used for production dedup.
 *
 * Cover must be resolved on the item via the parent entity (session rows
 * do not carry media themselves).
 */
export function visualDuplicatePairRate(items: StoryRailItem[]): {
  pairCount: number;
  comparablePairs: number;
  rate: number | null;
  /** Diagnostics: how many items had both signals. */
  withBothSignals: number;
  withPlaceOnly: number;
  withCoverOnly: number;
  total: number;
} {
  const withPlace = items.filter((i) => Boolean(i.placeId));
  const withCover = items.filter((i) => Boolean(i.coverMediaAssetId));
  const withSignal = items.filter((i) => i.placeId && i.coverMediaAssetId);
  let pairCount = 0;
  let comparablePairs = 0;
  for (let i = 0; i < withSignal.length; i++) {
    for (let j = i + 1; j < withSignal.length; j++) {
      comparablePairs++;
      const a = withSignal[i]!;
      const b = withSignal[j]!;
      if (a.placeId === b.placeId && a.coverMediaAssetId === b.coverMediaAssetId) {
        pairCount++;
      }
    }
  }
  return {
    pairCount,
    comparablePairs,
    rate: comparablePairs === 0 ? null : pairCount / comparablePairs,
    withBothSignals: withSignal.length,
    withPlaceOnly: withPlace.length - withSignal.length,
    withCoverOnly: withCover.length - withSignal.length,
    total: items.length,
  };
}

/** Jaccard similarity of two id sets. */
export function jaccardOverlap(a: readonly string[], b: readonly string[]): number | null {
  if (a.length === 0 && b.length === 0) return null;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const id of setA) {
    if (setB.has(id)) inter++;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? null : inter / union;
}

export function jaccardByItemIds(
  a: readonly StoryRailItem[],
  b: readonly StoryRailItem[],
): number | null {
  return jaccardOverlap(
    a.map((i) => i.id),
    b.map((i) => i.id),
  );
}

export function jaccardByParentEntity(
  a: readonly StoryRailItem[],
  b: readonly StoryRailItem[],
): number | null {
  return jaccardOverlap(
    a.map(parentEntityKey),
    b.map(parentEntityKey),
  );
}

/**
 * How many distinct temporal slots contain the same parent entity on one day.
 * Distribution: count of entities appearing in exactly 1 / 2 / 3+ slots.
 */
export function entityRepeatDistribution(
  slotItems: Array<{ slotId: string; items: StoryRailItem[] }>,
): { in1: number; in2: number; in3plus: number; totalEntities: number } {
  const slotsByEntity = new Map<string, Set<string>>();
  for (const { slotId, items } of slotItems) {
    for (const item of items) {
      const key = parentEntityKey(item);
      let set = slotsByEntity.get(key);
      if (!set) {
        set = new Set();
        slotsByEntity.set(key, set);
      }
      set.add(slotId);
    }
  }
  let in1 = 0;
  let in2 = 0;
  let in3plus = 0;
  for (const set of slotsByEntity.values()) {
    if (set.size === 1) in1++;
    else if (set.size === 2) in2++;
    else in3plus++;
  }
  return { in1, in2, in3plus, totalEntities: slotsByEntity.size };
}
