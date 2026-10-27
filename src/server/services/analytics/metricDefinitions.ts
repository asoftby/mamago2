/**
 * Единые определения метрик продуктовой аналитики (ТЗ «Аналитика админки»,
 * блок B). Только константы и чистые функции — без запросов. На них
 * ссылаются сервисы `/admin/analytics`, коллекторы `/admin` и
 * `lib/admin/metricDictionary.ts`.
 *
 * | Понятие            | Определение                                                       |
 * | ------------------ | ----------------------------------------------------------------- |
 * | Просмотры страниц  | PAGE_VIEW (через `computeCanonicalAudience().pageViews`)          |
 * | Показы в ленте     | CARD_VIEW — отдельная метрика, не смешивается с просмотрами       |
 * | Открытия           | DETAIL_OPEN с клиента (после A1, боты отсечены)                   |
 * | Визиторы           | `computeCanonicalAudience().visitors`                             |
 * | Устройства         | DISTINCT sessionId (`mg_analytics_sid` — вечный id браузера).     |
 * |                    | Это НЕ сессии: настоящие 30-минутные сессии — BACKLOG-211.        |
 * | Внутренний трафик  | роли AUDIENCE_EXCLUDED_ROLES + tainted-сессии (canonicalAudience) |
 * | Границы суток      | Europe/Minsk (`zonedDateKey` / `startOfZonedDay`)                 |
 */
import type { UserEventType } from "@prisma/client";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

/** Часовой пояс всех суточных границ и бакетов аналитики. */
export const ANALYTICS_TIME_ZONE = DEFAULT_TZ;

/** Просмотр страницы — только PAGE_VIEW. */
export const PAGE_VIEW_EVENT: UserEventType = "PAGE_VIEW";
/** Показ карточки в ленте — CARD_VIEW (раньше смешивался с просмотрами). */
export const FEED_IMPRESSION_EVENT: UserEventType = "CARD_VIEW";
/** Открытие карточки сущности. */
export const DETAIL_OPEN_EVENT: UserEventType = "DETAIL_OPEN";
export const SAVE_EVENT: UserEventType = "SAVE";
export const PLAN_ADD_EVENT: UserEventType = "PLAN_ADD";
export const CTA_CLICK_EVENT: UserEventType = "CTA_CLICK";

/** Подписи понятий (UI и словарь метрик говорят одинаково). */
export const METRIC_LABELS = {
  pageViews: "Просмотры страниц",
  feedImpressions: "Показы в ленте",
  opens: "Открытия",
  saves: "Сохранения",
  planAdds: "В план",
  ctaClicks: "Переходы к партнёру",
  visitors: "Визиторы",
  devices: "Устройства",
} as const;
