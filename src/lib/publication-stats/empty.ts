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

export function buildEmptyPublicationStats(
  entityId: string,
  path: string,
  viewer: User,
  period: PublicationStatsPeriod,
): PublicationStatsPayload & { empty: true } {
  const now = new Date().toISOString();

  return {
    empty: true,
    header: {
      entityTypeLabel: "публикация",
      publicationId: entityId,
      path,
      viewerRoleLabel: roleLabelRu(viewer.role),
      viewerRole: roleToViewerLabel(viewer.role),
      period,
      periodLabelRu: PUBLICATION_STATS_PERIOD_LABEL_RU[period],
      statsUpdatedAt: now,
    },
    overview: {
      viewsTotal: null,
      viewsUnique: null,
      saves: null,
      planAdds: null,
      planUniqueUsers: null,
      buyClicks: null,
      conversionToPlan: null,
      conversionToBuy: null,
    },
    traffic: {
      sessions: null,
      returningUsers: null,
      trafficSource: null,
      device: null,
      city: null,
      authState: null,
      referrer: null,
      utm: null,
    },
    engagement: {
      avgTimeOnPageSec: null,
      medianTimeOnPageSec: null,
      scroll25Pct: null,
      scroll50Pct: null,
      scroll75Pct: null,
      scroll100Pct: null,
      shortVisits: null,
    },
    actions: {
      clickPlan: null,
      clickSave: null,
      clickBuy: null,
      clickShare: null,
      clickMap: null,
      clickRoute: null,
      clickSite: null,
      clickSimilarEvent: null,
      clickOtherCta: null,
    },
    planning: {
      datesAvailable: null,
      dateSelectionsTotal: null,
      dateSelectionsUnique: null,
      planToday: null,
      planTomorrow: null,
      planOtherDate: null,
      planRemovals: null,
      bySession: null,
    },
    media: {
      reelViews: null,
      reelWatch50: null,
      reelWatch100: null,
      trailerViews: null,
      trailerWatch50: null,
      trailerWatch100: null,
      playRate: null,
    },
    conversions: {
      saveRate: null,
      planRate: null,
      buyRate: null,
      viewToPlan: null,
      viewToBuy: null,
      playToPlan: null,
      similarCtr: null,
    },
    debug: {
      publicationId: entityId,
      slugOrPath: path,
      entityType: "Publication",
      aggregationVersion: null,
      rawEventsCount: null,
      lastAggregationAt: null,
      aggregationWindow: periodToAggregationWindowLabel(period),
      dataHealth: "empty",
    },
    allowedSections: getVisibleSectionsForRole(viewer.role),
  };
}
