export const FREE_STORY_HORIZON_DAYS = 7;

export type FreeStoryCandidate = {
  id: string;
  sourceType: "EVENT" | "OFFER";
  placementType: "AUTO" | "FORCE_INCLUDE" | "EXCLUDE";
  status: "ACTIVE" | "INACTIVE";
  isFree: boolean;
  startsAt: Date | null;
  storyDate: Date;
};

export function isFreeStoryCandidate(
  item: FreeStoryCandidate,
  range: { from: Date; until: Date; now: Date },
): boolean {
  return item.sourceType === "EVENT"
    && item.status === "ACTIVE"
    && item.placementType !== "EXCLUDE"
    && item.isFree
    && item.startsAt != null
    && item.startsAt >= range.now
    && item.startsAt < range.until
    && item.storyDate >= range.from
    && item.storyDate < range.until;
}
