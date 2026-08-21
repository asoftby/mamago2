import {
  ongoingBelongsToRange,
  occurrenceBelongsToRange,
  type OngoingWindow,
} from "./dateRangeWhere";
import type { OngoingTemporalPolicy, TimeClass } from "./ongoingPolicy";
import {
  activityItemId,
  activitySessionItemId,
  offerItemId,
  offerSessionItemId,
  type StoryRailItem,
  type SlotItemBreakdown,
} from "./items";
import type { DateRange, ResolvedSlot } from "./types";

export type ActivityParentClass = "point" | "serial";

export type RawActivitySession = {
  id: string;
  startsAt: Date;
  activityId: string;
  title: string;
  placeId: string | null;
  coverMediaAssetId: string | null;
  /** Parent Activity class from full session span (not union-local). */
  parentClass: ActivityParentClass;
  isFree?: boolean;
};

export type RawActivityOccurrence = {
  id: string;
  nextOccurrenceAt: Date;
  title: string;
  placeId: string | null;
  coverMediaAssetId: string | null;
  /** True when this activity already contributed a session in the union window. */
  hasSessionInUnion: boolean;
  parentClass: ActivityParentClass;
  isFree?: boolean;
};

export type RawOfferSession = {
  id: string;
  startAt: Date;
  offerId: string;
  title: string;
  placeId: string | null;
  coverMediaAssetId: string | null;
  isFree?: boolean;
};

export type RawOngoingOffer = {
  id: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  title: string;
  placeId: string | null;
  coverMediaAssetId: string | null;
  /** Offers that already have OfferSession rows are not window. */
  hasSessions: boolean;
  isFree?: boolean;
};

export type StoryRailCandidatePool = {
  activitySessions: RawActivitySession[];
  /** Activities with nextOccurrenceAt in union and no session in that union. */
  activityOrphans: RawActivityOccurrence[];
  offerSessions: RawOfferSession[];
  ongoingOffers: RawOngoingOffer[];
};

function toActivitySessionItem(
  row: RawActivitySession,
  timeClass: Extract<TimeClass, "point">,
): StoryRailItem {
  return {
    id: activitySessionItemId(row.id),
    timeClass,
    entityKind: "activity",
    entityId: row.activityId,
    sessionId: row.id,
    placeId: row.placeId,
    coverMediaAssetId: row.coverMediaAssetId,
    title: row.title,
    at: row.startsAt,
  };
}

function toSerialActivityItem(row: RawActivitySession): StoryRailItem {
  return {
    id: activityItemId(row.activityId),
    timeClass: "serial",
    entityKind: "activity",
    entityId: row.activityId,
    sessionId: null,
    placeId: row.placeId,
    coverMediaAssetId: row.coverMediaAssetId,
    title: row.title,
    at: row.startsAt,
  };
}

function toActivityOrphanItem(row: RawActivityOccurrence): StoryRailItem {
  return {
    id: activityItemId(row.id),
    timeClass: "point",
    entityKind: "activity",
    entityId: row.id,
    sessionId: null,
    placeId: row.placeId,
    coverMediaAssetId: row.coverMediaAssetId,
    title: row.title,
    at: row.nextOccurrenceAt,
  };
}

function toOfferSessionItem(row: RawOfferSession): StoryRailItem {
  return {
    id: offerSessionItemId(row.id),
    timeClass: "point",
    entityKind: "offer",
    entityId: row.offerId,
    sessionId: row.id,
    placeId: row.placeId,
    coverMediaAssetId: row.coverMediaAssetId,
    title: row.title,
    at: row.startAt,
  };
}

function toWindowOfferItem(row: RawOngoingOffer): StoryRailItem {
  return {
    id: offerItemId(row.id),
    timeClass: "window",
    entityKind: "offer",
    entityId: row.id,
    sessionId: null,
    placeId: row.placeId,
    coverMediaAssetId: row.coverMediaAssetId,
    title: row.title,
    at: row.dateFrom ?? row.dateTo ?? new Date(0),
  };
}

/**
 * Temporal slots: point sessions + point orphans + window offers.
 * Serial Activity sessions are excluded (they feed `running` only).
 */
export function classifyItemsForRange(
  pool: StoryRailCandidatePool,
  range: DateRange,
  ongoingPolicy: OngoingTemporalPolicy,
): StoryRailItem[] {
  const items: StoryRailItem[] = [];

  for (const row of pool.activitySessions) {
    if (row.parentClass === "serial") continue;
    if (occurrenceBelongsToRange(row.startsAt, range)) {
      items.push(toActivitySessionItem(row, "point"));
    }
  }

  for (const row of pool.activityOrphans) {
    if (row.hasSessionInUnion) continue;
    if (row.parentClass === "serial") continue;
    if (occurrenceBelongsToRange(row.nextOccurrenceAt, range)) {
      items.push(toActivityOrphanItem(row));
    }
  }

  for (const row of pool.offerSessions) {
    if (occurrenceBelongsToRange(row.startAt, range)) {
      items.push(toOfferSessionItem(row));
    }
  }

  for (const row of pool.ongoingOffers) {
    if (row.hasSessions) continue;
    const window: OngoingWindow = { dateFrom: row.dateFrom, dateTo: row.dateTo };
    if (ongoingBelongsToRange(window, range, ongoingPolicy)) {
      items.push(toWindowOfferItem(row));
    }
  }

  return items;
}

/**
 * `running`: one item per serial Activity that has ≥1 session in the horizon.
 */
export function classifyRunningItems(
  pool: StoryRailCandidatePool,
  horizon: DateRange,
): StoryRailItem[] {
  const byActivity = new Map<string, StoryRailItem>();

  for (const row of pool.activitySessions) {
    if (row.parentClass !== "serial") continue;
    if (!occurrenceBelongsToRange(row.startsAt, horizon)) continue;
    if (byActivity.has(row.activityId)) continue;
    byActivity.set(row.activityId, toSerialActivityItem(row));
  }

  return [...byActivity.values()];
}

export function breakdownForSlot(
  pool: StoryRailCandidatePool,
  slot: Pick<ResolvedSlot, "id" | "range">,
  ongoingPolicy: OngoingTemporalPolicy,
): SlotItemBreakdown {
  const items =
    slot.id === "running"
      ? classifyRunningItems(pool, slot.range)
      : slot.id === "free"
        ? classifyFreeItems(pool, slot.range, ongoingPolicy)
        : classifyItemsForRange(pool, slot.range, ongoingPolicy);

  let point = 0;
  let serial = 0;
  let window = 0;
  for (const item of items) {
    if (item.timeClass === "point") point++;
    else if (item.timeClass === "serial") serial++;
    else window++;
  }
  return {
    total: items.length,
    point,
    serial,
    window,
    itemIds: items.map((i) => i.id),
    items,
  };
}

/** Canonical free semantics: structured priceFrom=0, carried by pool rows. */
export function classifyFreeItems(
  pool: StoryRailCandidatePool,
  range: DateRange,
  ongoingPolicy: OngoingTemporalPolicy,
): StoryRailItem[] {
  return classifyItemsForRange(
    {
      activitySessions: pool.activitySessions.filter((row) => row.isFree),
      activityOrphans: pool.activityOrphans.filter((row) => row.isFree),
      offerSessions: pool.offerSessions.filter((row) => row.isFree),
      ongoingOffers: pool.ongoingOffers.filter((row) => row.isFree),
    },
    range,
    ongoingPolicy,
  );
}

export function countsFromBreakdowns(
  breakdowns: Record<string, SlotItemBreakdown>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [slotId, b] of Object.entries(breakdowns)) {
    counts[slotId] = b.total;
  }
  return counts;
}
