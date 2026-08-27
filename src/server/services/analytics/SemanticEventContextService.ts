import type {
  AnalyticsEntityType,
  Prisma,
  UserEventType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STRONG_SEMANTIC_EVENTS = new Set<UserEventType>([
  "DETAIL_OPEN",
  "SAVE",
  "UNSAVE",
  "PLAN_ADD",
  "PLAN_REMOVE",
  "CTA_CLICK",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_COMPLETED",
  "BOOKING_CANCELLED",
  "FEEDBACK_LEFT",
]);

function asRecord(meta: Prisma.InputJsonValue | undefined): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function hasStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim());
}

/**
 * Adds stable taxonomy/content dimensions to sparse, high-value UserEvents.
 *
 * Raw UserEvent is the source of truth for future learning. We therefore enrich
 * SAVE / PLAN_ADD / booking / feedback events before writing them instead of
 * making every future recommender re-query mutable Activity taxonomy. Passive
 * CARD_VIEW/PAGE_VIEW never incur this lookup; surfaces can include dimensions
 * they already have in their card payload.
 */
export async function enrichSemanticEventMeta(input: {
  entityType?: AnalyticsEntityType | null;
  entityId?: string | null;
  eventType: UserEventType;
  meta?: Prisma.InputJsonValue;
}): Promise<Prisma.InputJsonValue | undefined> {
  const current = asRecord(input.meta);
  if (
    input.entityType !== "EVENT" ||
    !input.entityId ||
    !STRONG_SEMANTIC_EVENTS.has(input.eventType)
  ) {
    return input.meta;
  }

  const alreadyComplete =
    hasStringArray(current.categoryIds) &&
    hasStringArray(current.genreSlugs) &&
    hasStringArray(current.signalIds) &&
    typeof current.format === "string";
  if (alreadyComplete) return input.meta;

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: input.entityId },
      select: {
        eventCategoryId: true,
        genreSlugs: true,
        discoverySignalIds: true,
        format: true,
        ageTags: true,
        priceFrom: true,
      },
    });
    if (!activity) return input.meta;

    return {
      ...current,
      ...(!hasStringArray(current.categoryIds) && activity.eventCategoryId
        ? { categoryIds: [activity.eventCategoryId] }
        : {}),
      ...(!hasStringArray(current.genreSlugs) && activity.genreSlugs.length > 0
        ? { genreSlugs: activity.genreSlugs }
        : {}),
      ...(!hasStringArray(current.signalIds) && activity.discoverySignalIds.length > 0
        ? { signalIds: activity.discoverySignalIds }
        : {}),
      ...(typeof current.format !== "string" ? { format: String(activity.format) } : {}),
      ...(!hasStringArray(current.ageRanges) && activity.ageTags.length > 0
        ? { ageRanges: activity.ageTags }
        : {}),
      ...(typeof current.priceFrom !== "number" && activity.priceFrom != null
        ? { priceFrom: activity.priceFrom }
        : {}),
    } as Prisma.InputJsonValue;
  } catch (error) {
    console.error("[product-telemetry] semantic enrichment failed", error);
    return input.meta;
  }
}

export const SemanticEventContextService = {
  enrichSemanticEventMeta,
};
