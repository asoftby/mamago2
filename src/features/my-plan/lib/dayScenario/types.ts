/**
 * Day-scenario engine model. Designed for the full spec (pinned anchors, replace,
 * a multi-day range later, three travel modes) even where the first UI uses less.
 * Everything here is plain data so the pool can be cached and the builder stays pure.
 */

export type TravelMode = "walk" | "car" | "transit";

export type GeoPoint = {
  lat: number;
  lng: number;
  geoCell6: string;
  geoCell5: string;
  /** True when the position is only approximated (metro station), never exact. */
  approximate: boolean;
};

/** What the client needs to render a pick without another query. */
export type ScenarioCard = {
  id: string;
  slug: string | null;
  title: string;
  coverImageUrl: string | null;
  ageLabel: string | null;
  categoryName: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  currency: string | null;
  address: string | null;
};

export type PoolEvent = {
  activityId: string;
  card: ScenarioCard;
  /** Confirmed session starts on the target day, ascending (epoch ms). */
  sessionStartsMs: number[];
  durationMin: number;
  ageTags: string[];
  adultOnly: boolean;
  /** Raw ranking inputs; the score itself is audience-specific and computed per build. */
  engagementScore: number;
  scheduleJson: unknown;
  categoryId: string | null;
  discoverySignalIds: string[];
  format: string | null;
  geo: GeoPoint | null;
};

export type BusyInterval = { startMs: number; endMs: number };

export type PinnedItem = { activityId: string; startsAtMs: number };

export type ScenarioAudience = {
  /** Canonical age-range values, e.g. "3-5". */
  ageRanges: string[];
  profileInterestSlugs: string[];
  /** A child of 0-3 is present: tighter walking budget. */
  hasToddler: boolean;
};

export type BuildInput = {
  /** Local day window in epoch ms (default 09:00-20:00 Europe/Minsk). */
  windowStartMs: number;
  windowEndMs: number;
  mode: TravelMode;
  audience: ScenarioAudience;
  busy: BusyInterval[];
  excludeActivityIds: string[];
  pinned: PinnedItem[];
  /** Target number of items including pinned ones. */
  targetCount: number;
  /** 0 = best quality; k > 0 = deterministic alternative (the "Другой вариант" seed). */
  variant: number;
};

export type TravelLeg = {
  mode: TravelMode;
  minutes: number;
  distanceM: number;
};

export type ScenarioItem = {
  activityId: string;
  card: ScenarioCard;
  startsAtMs: number;
  endsAtMs: number;
  pinned: boolean;
  /** Travel from the previous item; null for the first item or unknown coordinates. */
  travelFromPrev: TravelLeg | null;
  /** The position is only approximate (metro station): UI shows "примерное место". */
  approximatePlace: boolean;
  /** Set when this transfer is longer than the car comfort limit ("Далеко — заменить?"). */
  far: boolean;
  score: number;
};

export type BuildStatus = "ok" | "few_nearby" | "empty";

export type BuildResult = {
  status: BuildStatus;
  items: ScenarioItem[];
  mode: TravelMode;
  /** For walk mode with too few candidates: suggest switching to car. */
  suggestMode: TravelMode | null;
  candidateCount: number;
};
