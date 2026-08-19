/**
 * Simple deterministic overlap check for Scenario timed items.
 *
 * `src/features/me/lib/dayScheduler.ts` was re-audited before writing this:
 * its `findPlacement()` solves a different problem (where to insert ONE new
 * item into an existing day) and isn't a fit for "list every conflicting
 * pair in a fixed set of already-planned items" — so this is a small new
 * pure function instead of a reuse/adaptation of that one. It does keep the
 * same DEFAULT_DURATION_MIN=60 convention that module already established
 * for "unknown duration" items, since PlanItem has no duration field and we
 * are not inventing per-item durations.
 */
const DEFAULT_DURATION_MIN = 60;

type ConflictSource = { id: string; startsAt: Date | null };

/**
 * Returns the ids of items whose assumed [startsAt, startsAt+60min) window
 * overlaps an adjacent (by time) item's window. Untimed items are ignored —
 * there is nothing to compare. Only adjacent pairs (once sorted by time) are
 * checked, which is sufficient for "obvious overlap" and avoids inventing a
 * general scheduling/optimization pass.
 */
export function detectScenarioConflictIds(items: ConflictSource[]): Set<string> {
  const timed = items
    .filter((item): item is ConflictSource & { startsAt: Date } => item.startsAt != null)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const conflictIds = new Set<string>();
  for (let i = 0; i < timed.length - 1; i++) {
    const current = timed[i]!;
    const next = timed[i + 1]!;
    const currentEnd = current.startsAt.getTime() + DEFAULT_DURATION_MIN * 60_000;
    if (next.startsAt.getTime() < currentEnd) {
      conflictIds.add(current.id);
      conflictIds.add(next.id);
    }
  }
  return conflictIds;
}
