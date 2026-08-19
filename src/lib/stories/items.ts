import type { TimeClass } from "./ongoingPolicy";

/**
 * Stable item identity for counts and viewer content (must match).
 * - point session: session-level
 * - serial (running): activity-level
 * - window: offer-level
 * - activity orphan (point, no session in union): activity-level
 *
 * No cross-dedup between Activity and Offer (they share placeId by coincidence,
 * not identity). Known model debt: missing Offer↔Activity link also creates
 * CPA attribution ambiguity on Place pages — track separately from the rail.
 */
export type StoryItemId =
  | `activity-session:${string}`
  | `offer-session:${string}`
  | `offer:${string}`
  | `activity:${string}`;

export function activitySessionItemId(sessionId: string): StoryItemId {
  return `activity-session:${sessionId}`;
}

export function offerSessionItemId(sessionId: string): StoryItemId {
  return `offer-session:${sessionId}`;
}

export function offerItemId(offerId: string): StoryItemId {
  return `offer:${offerId}`;
}

export function activityItemId(activityId: string): StoryItemId {
  return `activity:${activityId}`;
}

export type StoryRailItem = {
  id: StoryItemId;
  timeClass: TimeClass;
  entityKind: "activity" | "offer";
  entityId: string;
  sessionId: string | null;
  placeId: string | null;
  /** Cover MediaAsset id when resolvable; used only for replay metrics. */
  coverMediaAssetId: string | null;
  title: string;
  /** Instant for point/serial session; window start for window (secondary sort). */
  at: Date;
};

export type SlotItemBreakdown = {
  total: number;
  point: number;
  serial: number;
  window: number;
  itemIds: StoryItemId[];
  items: StoryRailItem[];
};
