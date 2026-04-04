/**
 * Child Context Switcher — simplified single-select model.
 *
 * Selection:
 *   null  = "Для всех" (default when multiple children)
 *   id    = specific child selected
 *
 * Rules:
 *   - 1 child  → only that child's chip, always selected
 *   - 2+ children → "Для всех" chip + one chip per child, single-select
 *   - Default: null ("Для всех") when multiple children
 */

export type ChildSelection = string | null; // null = all

export function initialSelection(childCount: number): ChildSelection {
  return null; // always start with "all" / single child handled in UI
}

export function getActiveChildIds(
  selection: ChildSelection,
  allIds: string[],
): string[] {
  if (selection === null) return allIds;
  return allIds.includes(selection) ? [selection] : allIds;
}

export function mergeInterests(
  selection: ChildSelection,
  children: Array<{ id: string; systemInterests?: { interestSlug: string }[] }>,
): string[] {
  const active = selection === null
    ? children
    : children.filter((c) => c.id === selection);

  const merged = new Set<string>();
  for (const child of active) {
    for (const i of child.systemInterests ?? []) merged.add(i.interestSlug);
  }
  return [...merged];
}

export function buildScenarioHeading(
  selection: ChildSelection,
  children: Array<{ id: string; name: string }>,
): string {
  if (selection === null) {
    if (children.length === 1) return `Сценарий для ${children[0]!.name}`;
    return "Сценарий для всех детей";
  }
  const child = children.find((c) => c.id === selection);
  return child ? `Сценарий для ${child.name}` : "Сценарий дня";
}
