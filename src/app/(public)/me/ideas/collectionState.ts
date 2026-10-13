import type { IdeaItem } from "./types";

export type CollectionSummary = {
  id: string;
  title: string;
  count: number;
  covers?: string[];
};

export type CollectionMemberships = Record<string, string[]>;
export const ALL_IDEAS = "ALL";
export const WITHOUT_COLLECTION = "WITHOUT_COLLECTION";

/** The saved idea's row id is shared across all five idea tables in IdeasPage. */
export function visibleInCollection(
  idea: IdeaItem,
  selected: string,
  memberships: CollectionMemberships,
): boolean {
  if (selected === ALL_IDEAS) return true;
  const assigned = memberships[idea.id] ?? [];
  if (selected === WITHOUT_COLLECTION) return assigned.length === 0;
  return assigned.includes(selected);
}

/** Same IDs accepted by the existing collections API for every idea type. */
export function collectionTarget(idea: IdeaItem): Record<string, string> {
  const id = idea.activity.id;
  switch (idea.ideaType) {
    case "ACTIVITY": return { activityId: id };
    case "OFFER": return { offerId: id };
    case "ROUTE": return { routeId: id };
    case "ARTICLE": return { articleId: id };
  }
}

/** Optimistic counts: preserve all other collections and never underflow. */
export function updateCollectionCounts(
  collections: CollectionSummary[],
  previous: string[],
  next: string[],
): CollectionSummary[] {
  const before = new Set(previous);
  const after = new Set(next);
  return collections.map((collection) => ({
    ...collection,
    count: Math.max(0, collection.count + Number(after.has(collection.id)) - Number(before.has(collection.id))),
  }));
}
