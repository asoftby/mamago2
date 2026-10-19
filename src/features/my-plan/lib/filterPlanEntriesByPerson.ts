/**
 * One audience rule for the My Plan modal and full page.
 *
 * "Для всех" shows every visible entry. "Я" means entries explicitly
 * assigned to this adult; it must not be inferred from the author of
 * somebody else's entry or from an absent child assignment.
 */
export type PlanPersonSelection =
  | { kind: "all" }
  | { kind: "adult"; id: string }
  | { kind: "child"; id: string };

export function filterPlanEntriesByPerson<T extends {
  childId?: string | null;
  assigneeUserId?: string | null;
}>(entries: readonly T[], selection: PlanPersonSelection): T[] {
  switch (selection.kind) {
    case "all":
      return [...entries];
    case "child":
      return entries.filter((entry) => entry.childId === selection.id);
    case "adult":
      return entries.filter((entry) => !entry.childId && entry.assigneeUserId === selection.id);
  }
}
