import prisma from "@/lib/prisma";
import {
  buildPlaceReputationOverview,
  type GooglePlaceReputation,
  type PlaceReputationOverview,
  type PlaceReputationReaction,
} from "@/lib/feedback/placeReputation";
import type { FeedbackValue } from "@/lib/feedback/model";

type RawReaction = {
  id: string;
  actorKey: string;
  value: number;
  tagIds: string[];
  migrationKey: string | null;
};

/**
 * Read-only reputation projection, gated by FEEDBACK_PLACE_REPUTATION_ENABLED.
 *
 * A linked event is counted ONLY when:
 * - a published-eligible EVENT reaction references its original PlanItem ID,
 * - the reaction has an immutable venuePlaceIdAtVisit snapshot for this place,
 * - a non-private, uncancelled FAMILY PlanItem points at the same Activity,
 * - an ATTENDED Experience confirms the SAME user and PlanItem.
 *
 * Linked offers require a COMPLETED, user-owned BookingRequest referencing the
 * actual place of service. Offer.placeId alone cannot prove where it occurred.
 */
export async function loadPlaceReputationOverview(input: {
  placeId: string;
  google?: GooglePlaceReputation | null;
}): Promise<PlaceReputationOverview> {
  const [direct, events, offers, legacy, tags] = await Promise.all([
    prisma.feedbackReaction.findMany({
      where: { targetType: "PLACE", targetId: input.placeId, isPublicEligible: true },
      select: { id: true, actorKey: true, value: true, tagIds: true, migrationKey: true },
    }),
    prisma.$queryRaw<RawReaction[]>`
      SELECT r."id", r."actorKey", r."value", r."tagIds", r."migrationKey"
      FROM "FeedbackReaction" r
      JOIN "PlanItem" p ON p."id" = r."occurrenceKey"
      JOIN "Experience" e ON e."sourcePlanItemId" = p."id"
      WHERE r."targetType" = 'EVENT'::"FeedbackTargetType"
        AND r."isPublicEligible" = TRUE
        AND r."userId" IS NOT NULL
        AND p."activityId" = r."targetId"
        AND r."venuePlaceIdAtVisit" = ${input.placeId}
        AND p."visibility" = 'FAMILY'::"PlanVisibility"
        AND p."status" = 'CONFIRMED'::"PlanDecisionStatus"
        AND p."cancelledAt" IS NULL
        AND e."attendance" = 'ATTENDED'::"ExperienceAttendance"
        AND e."userId" = r."userId"
    `,
    prisma.$queryRaw<RawReaction[]>`
      SELECT r."id", r."actorKey", r."value", r."tagIds", r."migrationKey"
      FROM "FeedbackReaction" r
      JOIN "BookingRequest" b ON b."id" = r."occurrenceKey"
      WHERE r."targetType" = 'OFFER'::"FeedbackTargetType"
        AND r."isPublicEligible" = TRUE
        AND r."userId" IS NOT NULL
        AND b."publicationType" = 'OFFER'::"PublicationType"
        AND b."offerId" = r."targetId"
        AND b."placeId" = ${input.placeId}
        AND r."venuePlaceIdAtVisit" = ${input.placeId}
        AND b."status" = 'COMPLETED'::"BookingStatus"
        AND b."userId" = r."userId"
    `,
    prisma.placeReview.findMany({
      where: { placeId: input.placeId, source: "MAMAGO", status: "PUBLISHED" },
      select: { id: true },
    }),
    prisma.feedbackTag.findMany({
      where: { isActive: true, scope: "VENUE" },
      select: { id: true, label: true, scope: true },
    }),
  ]);

  function reaction(row: RawReaction): PlaceReputationReaction | null {
    if (row.value !== -1 && row.value !== 0 && row.value !== 1) return null;
    return {
      id: row.id,
      actorKey: row.actorKey,
      value: row.value as FeedbackValue,
      tagIds: row.tagIds,
      migrationKey: row.migrationKey,
    };
  }
  const toReactions = (rows: readonly RawReaction[]) =>
    rows.map(reaction).filter((row): row is PlaceReputationReaction => row !== null);

  return buildPlaceReputationOverview({
    direct: toReactions(direct),
    eventVisits: toReactions(events),
    offerUses: toReactions(offers),
    legacyPlaceReviewIds: legacy.map((item) => item.id),
    tags,
    google: input.google,
  });
}
