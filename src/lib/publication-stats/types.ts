/**
 * Типы статистики публикации (publication.stats) — production-oriented,
 * совместимы с mock и будущим API.
 */

import type { PublicationStatsPeriod } from "./period";

export type { PublicationStatsPeriod } from "./period";

/** Идентификаторы секций аккордеона */
export type PublicationStatsSectionId =
  | "overview"
  | "traffic"
  | "engagement"
  | "actions"
  | "planning"
  | "media"
  | "conversions"
  | "technical";

/** Роль просмотра (строка для UI), не путать с Prisma Role целиком */
export type PublicationStatsViewerLabel =
  | "admin"
  | "moderator"
  | "business_owner"
  | "user";

export interface PublicationStatsHeaderMeta {
  /** Тип сущности для UI */
  entityTypeLabel: string;
  publicationId: string;
  path: string;
  /** Человекочитаемая роль просмотра */
  viewerRoleLabel: string;
  /** Роль из сессии (англ. ключ) */
  viewerRole: PublicationStatsViewerLabel;
  /** Активный период агрегации */
  period: PublicationStatsPeriod;
  /** Период для отображения (рус.) */
  periodLabelRu: string;
  /** ISO 8601 — последнее обновление агрегата / снимка */
  statsUpdatedAt: string;
}

export interface PublicationStatsOverview {
  viewsTotal: number | null;
  viewsUnique: number | null;
  saves: number | null;
  planAdds: number | null;
  planUniqueUsers: number | null;
  buyClicks: number | null;
  conversionToPlan: number | null;
  conversionToBuy: number | null;
}

export interface PublicationStatsTraffic {
  sessions: number | null;
  returningUsers: number | null;
  trafficSource: string | null;
  device: string | null;
  city: string | null;
  authState: string | null;
  referrer: string | null;
  utm: string | null;
}

export interface PublicationStatsEngagement {
  avgTimeOnPageSec: number | null;
  medianTimeOnPageSec: number | null;
  scroll25Pct: number | null;
  scroll50Pct: number | null;
  scroll75Pct: number | null;
  scroll100Pct: number | null;
  shortVisits: number | null;
}

export interface PublicationStatsActions {
  clickPlan: number | null;
  clickSave: number | null;
  clickBuy: number | null;
  clickShare: number | null;
  clickMap: number | null;
  clickRoute: number | null;
  clickSite: number | null;
  clickSimilarEvent: number | null;
  clickOtherCta: number | null;
}

export interface PublicationStatsPlanning {
  datesAvailable: number | null;
  dateSelectionsTotal: number | null;
  dateSelectionsUnique: number | null;
  planToday: number | null;
  planTomorrow: number | null;
  planOtherDate: number | null;
  planRemovals: number | null;
  /** Распределение по сеансам: id сеанса → количество */
  bySession?: Record<string, number> | null;
}

export interface PublicationStatsMedia {
  reelViews: number | null;
  reelWatch50: number | null;
  reelWatch100: number | null;
  trailerViews: number | null;
  trailerWatch50: number | null;
  trailerWatch100: number | null;
  playRate: number | null;
}

export interface PublicationStatsConversions {
  saveRate: number | null;
  planRate: number | null;
  buyRate: number | null;
  viewToPlan: number | null;
  viewToBuy: number | null;
  playToPlan: number | null;
  similarCtr: number | null;
}

export interface PublicationStatsDebugMeta {
  publicationId: string;
  slugOrPath: string;
  entityType: string;
  aggregationVersion: string | null;
  rawEventsCount: number | null;
  lastAggregationAt: string | null;
  aggregationWindow: string | null;
  dataHealth: string | null;
}

export interface PublicationStatsPayload {
  header: PublicationStatsHeaderMeta;
  overview: PublicationStatsOverview;
  traffic: PublicationStatsTraffic;
  engagement: PublicationStatsEngagement;
  actions: PublicationStatsActions;
  planning: PublicationStatsPlanning;
  media: PublicationStatsMedia;
  conversions: PublicationStatsConversions;
  debug: PublicationStatsDebugMeta;
  /** Какие секции показывать текущей роли */
  allowedSections: PublicationStatsSectionId[];
  /** Частичная загрузка секций (для будущего API) */
  partial?: Partial<
    Record<
      | "overview"
      | "traffic"
      | "engagement"
      | "actions"
      | "planning"
      | "media"
      | "conversions"
      | "debug",
      boolean
    >
  >;
}
