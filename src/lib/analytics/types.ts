import type {
  AnalyticsEntityType,
  AnalyticsVertical,
  UserEventType,
} from "@prisma/client";

/**
 * Допустимые ключи meta для лёгкого контекста (без тяжёлых payload).
 */
export type AnalyticsMetaPayload = {
  source?: "listing" | "detail" | "recommendation" | "plan";
  section?: "home" | "afisha" | "offers" | "routes" | "journal";
  position?: number;
  /** Краткое описание фильтров (строка), не полный объект фильтра */
  filterSummary?: string;
  targetAction?: "buy" | "book" | "contact" | "open_site" | "plan" | string;
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
