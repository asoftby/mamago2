import type { User } from "@prisma/client";
import type { PublicationStatsPayload, PublicationStatsViewerLabel } from "./types";
import {
  type PublicationStatsPeriod,
  PUBLICATION_STATS_PERIOD_LABEL_RU,
  periodToAggregationWindowLabel,
} from "./period";
import { getVisibleSectionsForRole } from "./visibility";

function roleToViewerLabel(role: User["role"]): PublicationStatsViewerLabel {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "MODERATOR":
      return "moderator";
    case "BUSINESS_OWNER":
      return "business_owner";
    default:
      return "user";
  }
}

function roleLabelRu(role: User["role"]): string {
  switch (role) {
    case "ADMIN":
      return "Администратор";
    case "MODERATOR":
      return "Модератор";
    case "BUSINESS_OWNER":
      return "Владелец бизнеса";
    default:
      return "Пользователь";
  }
}

/** Лёгкая вариация чисел по периоду (mock), чтобы переключатель ощущался живым. */
function periodScale(period: PublicationStatsPeriod): number {
  const m: Record<PublicationStatsPeriod, number> = {
    today: 0.04,
    yesterday: 0.045,
    week: 1,
    month: 3.4,
    threeMonths: 9,
    sixMonths: 16,
    year: 42,
  };
  return m[period];
}

/**
 * Заглушка агрегатов — структура совместима с реальным API.
 */
export function buildMockPublicationStats(
  entityId: string,
  path: string,
  viewer: User,
  period: PublicationStatsPeriod
): PublicationStatsPayload {
  const now = new Date().toISOString();
  const viewerRole = roleToViewerLabel(viewer.role);
  const s = periodScale(period);
  const round = (n: number) => Math.max(0, Math.round(n * s));

  return {
    header: {
      entityTypeLabel: "событие",
      publicationId: entityId,
      path,
      viewerRoleLabel: roleLabelRu(viewer.role),
      viewerRole,
      period,
      periodLabelRu: PUBLICATION_STATS_PERIOD_LABEL_RU[period],
      statsUpdatedAt: now,
    },
    overview: {
      viewsTotal: round(12480),
      viewsUnique: round(9321),
      saves: round(412),
      planAdds: round(287),
      planUniqueUsers: round(198),
      buyClicks: round(156),
      conversionToPlan: 0.021,
      conversionToBuy: 0.012,
    },
    traffic: {
      sessions: round(10234),
      returningUsers: round(1201),
      trafficSource: "organic / direct / referral (агрегат)",
      device: "mobile 62% · desktop 31% · tablet 7%",
      city: "Минск 78% · др. 22%",
      authState: "гость 71% · пользователь 29%",
      referrer: "internal / external (сводка)",
      utm: "—",
    },
    engagement: {
      avgTimeOnPageSec: 94,
      medianTimeOnPageSec: 62,
      scroll25Pct: 0.88,
      scroll50Pct: 0.61,
      scroll75Pct: 0.34,
      scroll100Pct: 0.19,
      shortVisits: 0.12,
    },
    actions: {
      clickPlan: round(412),
      clickSave: round(389),
      clickBuy: round(156),
      clickShare: round(45),
      clickMap: round(98),
      clickRoute: round(76),
      clickSite: round(23),
      clickSimilarEvent: round(312),
      clickOtherCta: round(12),
    },
    planning: {
      datesAvailable: 12,
      dateSelectionsTotal: round(441),
      dateSelectionsUnique: round(203),
      planToday: round(34),
      planTomorrow: round(51),
      planOtherDate: round(202),
      planRemovals: round(18),
      bySession: {
        "session-a": round(120),
        "session-b": round(98),
        "session-c": round(69),
      },
    },
    media: {
      reelViews: round(2100),
      reelWatch50: round(890),
      reelWatch100: round(210),
      trailerViews: round(4500),
      trailerWatch50: round(2100),
      trailerWatch100: round(980),
      playRate: 0.34,
    },
    conversions: {
      saveRate: 0.033,
      planRate: 0.021,
      buyRate: 0.012,
      viewToPlan: 0.031,
      viewToBuy: 0.017,
      playToPlan: 0.08,
      similarCtr: 0.045,
    },
    debug: {
      publicationId: entityId,
      slugOrPath: path,
      entityType: "Activity",
      aggregationVersion: "v0-mock",
      rawEventsCount: round(458920),
      lastAggregationAt: now,
      aggregationWindow: periodToAggregationWindowLabel(period),
      dataHealth: "ok (mock)",
    },
    partial: undefined,
    allowedSections: getVisibleSectionsForRole(viewer.role),
  };
}
