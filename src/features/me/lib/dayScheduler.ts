/**
 * Smart Day Scheduler
 *
 * Finds free time slots in an existing day plan and determines
 * whether a new activity can be inserted without conflicts.
 */

export interface ScheduledItem {
  id: string;
  title: string;
  startsAt: Date;
  /** Duration in minutes (default 60 if unknown) */
  durationMin: number;
}

export interface ScheduleSlot {
  startsAt: Date;
  endsAt: Date;
}

export type PlacementResult =
  | { kind: "free";     startsAt: Date }
  | { kind: "conflict"; startsAt: Date; conflictingId: string; conflictingTitle: string }
  | { kind: "no_space" };

const BUFFER_MIN = 30;
const DEFAULT_DURATION_MIN = 60;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 21;

function addMinutes(date: Date, min: number): Date {
  return new Date(date.getTime() + min * 60_000);
}

function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Find the best placement for a new activity on a given day.
 *
 * @param existing  Already scheduled items for the day (sorted by startsAt)
 * @param preferred Preferred start time (from scenario step)
 * @param durationMin Duration of the new activity in minutes
 */
export function findPlacement(
  existing: ScheduledItem[],
  preferred: Date,
  durationMin = DEFAULT_DURATION_MIN,
): PlacementResult {
  const dayStart = new Date(preferred);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(preferred);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const sorted = [...existing].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // Build occupied windows: [start, end + buffer]
  const occupied: Array<{ start: Date; end: Date; id: string; title: string }> = sorted.map((item) => ({
    start: item.startsAt,
    end: addMinutes(item.startsAt, item.durationMin + BUFFER_MIN),
    id: item.id,
    title: item.title,
  }));

  // Try preferred time first
  const preferredEnd = addMinutes(preferred, durationMin);
  const conflict = occupied.find(
    (o) => preferred < o.end && preferredEnd > o.start,
  );

  if (!conflict) {
    // Preferred slot is free
    if (preferredEnd <= dayEnd) {
      return { kind: "free", startsAt: preferred };
    }
  } else {
    // Conflict found — check if we can shift the conflicting item
    const shiftedStart = addMinutes(preferredEnd, BUFFER_MIN);
    const shiftedEnd = addMinutes(shiftedStart, conflict.end.getTime() - conflict.start.getTime());
    if (shiftedEnd <= dayEnd) {
      return {
        kind: "conflict",
        startsAt: preferred,
        conflictingId: conflict.id,
        conflictingTitle: conflict.title,
      };
    }
  }

  // Scan for first free gap after preferred time
  let cursor = preferred < dayStart ? dayStart : preferred;
  for (const occ of occupied) {
    if (cursor >= occ.start && cursor < occ.end) {
      cursor = occ.end; // skip past this occupied block
    }
    const candidateEnd = addMinutes(cursor, durationMin);
    if (candidateEnd <= dayEnd) {
      const stillConflicts = occupied.some((o) => cursor < o.end && candidateEnd > o.start);
      if (!stillConflicts) {
        return { kind: "free", startsAt: cursor };
      }
    }
  }

  // Try from day start
  cursor = dayStart;
  const candidateEnd = addMinutes(cursor, durationMin);
  if (candidateEnd <= dayEnd) {
    const stillConflicts = occupied.some((o) => cursor < o.end && candidateEnd > o.start);
    if (!stillConflicts) return { kind: "free", startsAt: cursor };
  }

  return { kind: "no_space" };
}
