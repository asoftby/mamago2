import type {
  AnalyticsEntityType,
  AnalyticsVertical,
  UserEventType,
} from "@prisma/client";

/**
 * Lightweight context shared by first-party product telemetry.
 *
 * Keep this payload compact (the HTTP contract caps it at 4 KB). Raw behavior
 * remains in UserEvent; recommendation attribution is expressed by IDs rather
 * than by duplicating recommendation state into every event.
 */
export type AnalyticsMetaPayload = {
  source?: "listing" | "detail" | "recommendation" | "plan";
  section?: "home" | "afisha" | "offers" | "routes" | "journal" | "places" | "my_plan";
  position?: number;
  /** Краткое описание фильтров (строка), не полный объект фильтра */
  filterSummary?: string;
  targetAction?: "buy" | "book" | "contact" | "open_site" | "plan" | string;

  /** Recommendation attribution. These IDs point to the shared trace layer. */
  recommendationRunId?: string;
  recommendationExposureId?: string;
  recommendationSurface?: "home" | "discovery" | "my_plan" | "telegram";

  /** Small, normalized user/context dimensions useful for later ranking. */
  selectedPersonaIds?: string[];
  ageRanges?: string[];
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
  genreIds?: string[];
  signalIds?: string[];
  districtId?: string;
  metroId?: string;
  free?: boolean;
  priceMax?: number;
  query?: string;

  [key: string]: unknown;
};

export type TrackUserEventInput = {
  userId?: string | null;
  /** Id строки Session (сервер) или клиентский anonymous id */
  sessionId?: string | null;
  eventType: UserEventType;
  entityType?: AnalyticsEntityType | null;
  entityId?: string | null;
  vertical?: AnalyticsVertical | null;
  cityId?: string | null;
  /** Резолвится в cityId на сервере, если cityId не передан */
  citySlug?: string | null;
  meta?: AnalyticsMetaPayload | null;
};

export type TrackUserEventResult = { ok: true } | { ok: false; error: string };
