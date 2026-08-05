import { rangeFullyCoveredBy } from "./ranges";
import type { ResolvedSlot, SlotId, StorySlot, ResolveContext } from "./types";

export type SlotCounts = Record<SlotId, number>;

type Candidate = {
  slot: StorySlot;
  range: NonNullable<ReturnType<StorySlot["range"]>>;
};

function isAbsorbable(slot: StorySlot): boolean {
  return slot.absorbable !== false;
}

/**
 * Absorption only between `temporal` slots: dedupes the time axis.
 * Contextual / editorial facets may overlap temporal ranges by design.
 */
function isAbsorbedBy(candidate: Candidate, other: Candidate): boolean {
  if (candidate.slot.kind !== "temporal" || other.slot.kind !== "temporal") {
    return false;
  }
  if (!isAbsorbable(candidate.slot)) return false;
  if (!rangeFullyCoveredBy(candidate.range, other.range)) return false;

  const equal =
    candidate.range.start.getTime() === other.range.start.getTime() &&
    candidate.range.end.getTime() === other.range.end.getTime();
  if (equal) return other.slot.priority < candidate.slot.priority;

  return true;
}

/**
 * Sort key:
 * 1) inter-kind — by slot `priority` (lower = further left)
 * 2) within `temporal` — by `range.start` ASC
 * 3) tiebreak — `priority` ASC
 */
function compareResolved(a: ResolvedSlot, b: ResolvedSlot): number {
  if (a.kind !== b.kind) {
    return a.priority - b.priority;
  }
  if (a.kind === "temporal") {
    const startDiff = a.range.start.getTime() - b.range.start.getTime();
    if (startDiff !== 0) return startDiff;
  }
  return a.priority - b.priority;
}

/**
 * Resolve applicable story slots for a context.
 *
 * Steps (strict order):
 * 1. Filter by `condition` and `range() !== null`
 * 2. Absorb temporal slots whose range is fully covered by another temporal
 *    candidate (`absorbable: false` never drops; contextual/editorial skip)
 * 3. Filter by `counts[id] >= minItems`
 * 4. Sort (inter-kind by priority; temporal by range.start; tiebreak priority)
 *
 * Render thresholds (`maxSlots` / `minSlotsToRender`) are NOT applied here —
 * use {@link applyRenderPolicy} in the rail UI.
 */
export function resolveSlots(
  slots: StorySlot[],
  ctx: ResolveContext,
  counts: SlotCounts,
): ResolvedSlot[] {
  const candidates: Candidate[] = [];

  for (const slot of slots) {
    if (slot.condition && !slot.condition(ctx)) continue;
    const range = slot.range(ctx);
    if (!range) continue;
    candidates.push({ slot, range });
  }

  const afterAbsorption = candidates.filter((candidate) => {
    const absorbed = candidates.some(
      (other) =>
        other.slot.id !== candidate.slot.id && isAbsorbedBy(candidate, other),
    );
    return !absorbed;
  });

  const withCounts = afterAbsorption.filter((candidate) => {
    const count = counts[candidate.slot.id] ?? 0;
    return count >= candidate.slot.minItems;
  });

  return withCounts
    .map(({ slot, range }) => ({
      id: slot.id,
      kind: slot.kind,
      label: slot.label(ctx),
      range,
      priority: slot.priority,
      minItems: slot.minItems,
    }))
    .sort(compareResolved);
}
