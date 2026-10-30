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


/**
 * Presentation-only filtering of entries ALREADY authorized by the server.
 * Never use this function to decide which PRIVATE/FAMILY records a user may read.
 * The current legacy single-person filter remains intact until both UI surfaces
 * and the server read model are migrated together.
 */
export type PlanAudienceSelection = {
  include: readonly PlanPersonSelection[];
  exclude?: readonly PlanPersonSelection[];
  visibility?: "ALL" | "PRIVATE" | "FAMILY";
};

export function filterVisiblePlanEntries<T extends {
  childId?: string | null;
  assigneeUserId?: string | null;
  visibility?: "PRIVATE" | "FAMILY" | null;
}>(entries: readonly T[], selection: PlanAudienceSelection): T[] {
  const matches = (entry: T, person: PlanPersonSelection): boolean =>
    person.kind === "all" ||
    (person.kind === "child" ? entry.childId === person.id : !entry.childId && entry.assigneeUserId === person.id);
  return entries.filter(entry =>
    (selection.visibility === undefined || selection.visibility === "ALL" || entry.visibility === selection.visibility) &&
    (selection.include.length === 0 || selection.include.some(person => matches(entry, person))) &&
    !(selection.exclude ?? []).some(person => matches(entry, person))
  );
}
