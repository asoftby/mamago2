import type { ScenarioScheduling } from "./scenarioScheduling";

export type ScenarioConflictType = "TIME_OVERLAP";

export type ScenarioConflict = {
  key: string;
  type: ScenarioConflictType;
  itemIds: [string, string];
};

export type ScenarioConflictSource = {
  id: string;
  contentId: string | null;
  scheduling: ScenarioScheduling;
};

function orderedIds(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function participantIdentity(item: ScenarioConflictSource): string {
  return `${item.id}@${item.contentId ?? "none"}`;
}

/** Correct-by-construction pair scan; Scenario days are small, so O(n²) is intentional. */
export function detectScenarioConflicts(items: ScenarioConflictSource[]): ScenarioConflict[] {
  const conflicts: ScenarioConflict[] = [];

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const a = items[left]!;
      const b = items[right]!;
      if (a.scheduling.kind !== "SLOT" || b.scheduling.kind !== "SLOT") continue;
      if (
        !a.scheduling.startsAt ||
        !a.scheduling.endsAt ||
        !b.scheduling.startsAt ||
        !b.scheduling.endsAt
      ) continue;

      const overlaps =
        a.scheduling.startsAt.getTime() < b.scheduling.endsAt.getTime() &&
        b.scheduling.startsAt.getTime() < a.scheduling.endsAt.getTime();
      if (!overlaps) continue;

      const itemIds = orderedIds(a.id, b.id);
      const participants = orderedIds(participantIdentity(a), participantIdentity(b));
      conflicts.push({
        type: "TIME_OVERLAP",
        key: `TIME_OVERLAP:${participants[0]}:${participants[1]}`,
        itemIds,
      });
    }
  }

  return conflicts.sort((a, b) => a.key.localeCompare(b.key));
}
