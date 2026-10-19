import type { IdeaItem } from "./types";

/** Past events remain accessible but follow all active ideas in every collection. */
export function sortIdeasPastLast<T extends IdeaItem>(ideas: T[]): T[] {
  return [...ideas].sort((a, b) => {
    const aPast = a.ideaType === "ACTIVITY" && a.activity.temporalState === "PAST";
    const bPast = b.ideaType === "ACTIVITY" && b.activity.temporalState === "PAST";
    if (aPast !== bPast) return aPast ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
