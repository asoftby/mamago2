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

type PlanParticipantFields = {
  childId?: string | null;
  assigneeUserId?: string | null;
  /** Canonical order participants, loaded only after the server's Family Core ACL. */
  partyOrder?: { id?: string; programmeAdultIds?: readonly string[]; programmeChildIds?: readonly string[] } | null;
};
function matchesExplicitPerson(entry: PlanParticipantFields, selection: PlanPersonSelection): boolean {
  if (selection.kind === "all") return true;
  if (entry.partyOrder) return (selection.kind === "child"
    ? entry.partyOrder.programmeChildIds : entry.partyOrder.programmeAdultIds)?.includes(selection.id) ?? false;
  return selection.kind === "child" ? entry.childId === selection.id
    : !entry.childId && entry.assigneeUserId === selection.id;
}
export function filterPlanEntriesByPerson<T extends PlanParticipantFields>(entries: readonly T[], selection: PlanPersonSelection): T[] {
  return entries.filter(entry => matchesExplicitPerson(entry, selection));
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

export function filterVisiblePlanEntries<T extends PlanParticipantFields & {
  visibility?: "PRIVATE" | "FAMILY" | null;
}>(entries: readonly T[], selection: PlanAudienceSelection): T[] {
  return entries.filter(entry =>
    (selection.visibility === undefined || selection.visibility === "ALL" || entry.visibility === selection.visibility) &&
    (selection.include.length === 0 || selection.include.some(person => matchesExplicitPerson(entry, person))) &&
    !(selection.exclude ?? []).some(person => matchesExplicitPerson(entry, person))
  );
}
