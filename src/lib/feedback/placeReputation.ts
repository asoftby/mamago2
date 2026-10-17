import type { FeedbackValue } from "@/lib/feedback/model";

export type PlaceReputationReaction = {
  id: string;
  actorKey: string;
  value: FeedbackValue;
  tagIds: readonly string[];
  /** If imported, identifies an existing legacy PlaceReview. */
  migrationKey?: string | null;
};

export type PlaceReputationTag = {
  id: string;
  label: string;
  scope: "PROGRAM" | "VENUE" | "ORGANIZER" | "GENERAL";
};

export type GooglePlaceReputation = {
  rating: number;
  count: number;
  mapsUrl?: string;
};

/**
 * Source-separated, conservative aggregation. Linked rows must already have
 * verified venue evidence from the server loader; never feed raw event reviews.
 * This does not estimate a combined quality score across Google and mamaGo.
 */
export type PlaceReputationOverview = {
  google: GooglePlaceReputation | null;
  direct: { newCount: number; historicalCount: number; count: number; positiveShare: number | null };
  events: { count: number; positiveShare: number | null };
  offers: { count: number; positiveShare: number | null };
  mamaGoSignals: number;
  allSourceSignals: number;
  topVenueTags: Array<{ label: string; mentions: number }>;
};

function uniqueReactions(rows: readonly PlaceReputationReaction[], seen: Set<string>): PlaceReputationReaction[] {
  const unique: PlaceReputationReaction[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

function positiveShare(rows: readonly PlaceReputationReaction[]): number | null {
  if (rows.length < 5) return null;
  return rows.filter((row) => row.value === 1).length / rows.length;
}

export function buildPlaceReputationOverview(input: {
  direct: readonly PlaceReputationReaction[];
  eventVisits: readonly PlaceReputationReaction[];
  offerUses: readonly PlaceReputationReaction[];
  /** Currently displayed legacy MAMAGO PlaceReview IDs. Google is excluded. */
  legacyPlaceReviewIds: readonly string[];
  tags: readonly PlaceReputationTag[];
  google?: GooglePlaceReputation | null;
}): PlaceReputationOverview {
  // One canonical reaction cannot be counted in more than one bucket.
  const seen = new Set<string>();
  const direct = uniqueReactions(input.direct, seen);
  const events = uniqueReactions(input.eventVisits, seen);
  const offers = uniqueReactions(input.offerUses, seen);

  const migratedLegacyIds = new Set(
    direct
      .map((row) => row.migrationKey?.match(/^placeReview:([^:]+)$/i)?.[1])
      .filter((id): id is string => !!id),
  );
  const legacyIds = new Set(input.legacyPlaceReviewIds);
  let historicalCount = 0;
  for (const legacyId of legacyIds) {
    if (!migratedLegacyIds.has(legacyId)) historicalCount++;
  }

  // Source-specific venue signals, not the overall sentiment of a performance.
  const tagById = new Map(input.tags.filter((tag) => tag.scope === "VENUE").map((tag) => [tag.id, tag.label]));
  const tagActors = new Map<string, Set<string>>();
  for (const reaction of [...direct, ...events, ...offers]) {
    for (const tagId of new Set(reaction.tagIds)) {
      if (!tagById.has(tagId)) continue;
      if (!tagActors.has(tagId)) tagActors.set(tagId, new Set());
      tagActors.get(tagId)!.add(reaction.actorKey);
    }
  }
  const topVenueTags = [...tagActors.entries()]
    .map(([id, actors]) => ({ label: tagById.get(id)!, mentions: actors.size }))
    .filter((item) => item.mentions >= 3)
    .sort((a,b) => b.mentions - a.mentions || a.label.localeCompare(b.label, "ru"))
    .slice(0, 3);

  const validGoogle = input.google && Number.isFinite(input.google.rating)
    && input.google.rating >= 1 && input.google.rating <= 5
    && Number.isInteger(input.google.count) && input.google.count > 0
      ? input.google : null;
  const directCount = direct.length + historicalCount;
  const mamaGoSignals = directCount + events.length + offers.length;
  return {
    google: validGoogle,
    direct: { newCount: direct.length, historicalCount, count: directCount, positiveShare: positiveShare(direct) },
    events: { count: events.length, positiveShare: positiveShare(events) },
    offers: { count: offers.length, positiveShare: positiveShare(offers) },
    mamaGoSignals,
    allSourceSignals: mamaGoSignals + (validGoogle?.count ?? 0),
    topVenueTags,
  };
}
