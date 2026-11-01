import type { Prisma } from "@prisma/client";
import { buildOccurrenceKey, type FeedbackReactionTargetType, type FeedbackVisitStatus } from "@/lib/feedback/model";
import { FeedbackDomainError } from "./feedbackErrors";

/**
 * Server-side resolution of a rated target and the visit it refers to
 * (ТЗ Feedback 5★, раздел 7.3). Nothing here is trusted from the client except
 * ids: ownership, timing, verification and the venue snapshot are decided here.
 */

type Db = Prisma.TransactionClient;

export type StarTargetType = Extract<FeedbackReactionTargetType, "PLACE" | "EVENT" | "OFFER">;

export type OccurrenceInput =
  | { kind: "visit"; date: string }
  | { kind: "session"; id: string }
  | { kind: "offer-session"; id: string }
  | { kind: "booking"; id: string }
  | { kind: "plan"; id: string };

export type ResolvedTarget = {
  targetType: StarTargetType;
  targetId: string;
  /** Category for the Bayesian prior (Place.category, Activity.type, Offer.productType / party category). */
  category: string | null;
  /** Party-service category for chip sets (OFFER PARTY_SERVICE only). */
  partyCategory: string | null;
  /** Whether "Пробное / Посещаем регулярно" applies. */
  supportsExperienceLevel: boolean;
  /** Current venue of the target, used only as the fallback venue snapshot. */
  currentVenuePlaceId: string | null;
};

export type ResolvedOccurrence = {
  occurrenceKey: string;
  visitStatus: FeedbackVisitStatus;
  visitedAt: Date | null;
  activitySessionId: string | null;
  offerSessionId: string | null;
  bookingRequestId: string | null;
  /** Immutable venue snapshot at rating time (ТЗ 5.7 linked projections). */
  venuePlaceIdAtVisit: string | null;
};

const VISIBLE_CONTENT = ["PUBLISHED", "PENDING_UPDATE"] as const;
/** Self-reported visits older than this cannot be rated. */
export const MAX_VISIT_AGE_DAYS = 365;

const ALLOWED_OCCURRENCES: Record<StarTargetType, readonly OccurrenceInput["kind"][]> = {
  PLACE: ["visit", "booking", "plan"],
  EVENT: ["session", "booking", "plan"],
  OFFER: ["offer-session", "booking", "plan"],
};

/** Today's date (YYYY-MM-DD) in Minsk, where mamaGo visits happen. */
export function minskDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function resolveStarTarget(db: Db, targetType: string, targetId: string): Promise<ResolvedTarget> {
  if (targetType === "PLACE") {
    const place = await db.place.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, archivedAt: true, category: true },
    });
    if (!place || place.archivedAt || !VISIBLE_CONTENT.includes(place.status as (typeof VISIBLE_CONTENT)[number])) {
      throw new FeedbackDomainError("TARGET_NOT_FOUND");
    }
    return {
      targetType, targetId, category: place.category ?? null, partyCategory: null,
      supportsExperienceLevel: false, currentVenuePlaceId: place.id,
    };
  }
  if (targetType === "EVENT") {
    const activity = await db.activity.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, type: true, placeId: true, venue: { select: { placeId: true } } },
    });
    if (!activity || !VISIBLE_CONTENT.includes(activity.status as (typeof VISIBLE_CONTENT)[number])) {
      throw new FeedbackDomainError("TARGET_NOT_FOUND");
    }
    if (activity.type === "ROUTE") throw new FeedbackDomainError("TARGET_NOT_RATEABLE");
    return {
      targetType, targetId, category: activity.type, partyCategory: null,
      supportsExperienceLevel: activity.type === "COURSE",
      currentVenuePlaceId: activity.venue?.placeId ?? activity.placeId ?? null,
    };
  }
  if (targetType === "OFFER") {
    const offer = await db.offer.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, archivedAt: true, productType: true, category: true, placeId: true },
    });
    if (!offer || offer.archivedAt || offer.status !== "PUBLISHED") throw new FeedbackDomainError("TARGET_NOT_FOUND");
    // A place-visit offer only changes the price of visiting the place: rate the place.
    if (offer.productType === "PLACE_VISIT") throw new FeedbackDomainError("OFFER_INHERITS_PLACE");
    const party = offer.productType === "PARTY_SERVICE" ? offer.category ?? null : null;
    return {
      targetType, targetId,
      category: party ? `PARTY_SERVICE:${party}` : offer.productType ?? null,
      partyCategory: party,
      supportsExperienceLevel: offer.productType === "REGULAR_ACTIVITY",
      currentVenuePlaceId: offer.placeId ?? null,
    };
  }
  // ARTICLE / NEWS / ROUTE keep emoji ratings; BUSINESS is aggregate-only.
  throw new FeedbackDomainError("TARGET_NOT_RATEABLE");
}

export async function resolveOccurrence(
  db: Db,
  input: { userId: string; target: ResolvedTarget; occurrence: OccurrenceInput; now: Date },
): Promise<ResolvedOccurrence> {
  const { userId, target, occurrence, now } = input;
  if (!ALLOWED_OCCURRENCES[target.targetType].includes(occurrence.kind)) {
    throw new FeedbackDomainError("OCCURRENCE_NOT_ALLOWED");
  }
  const base = {
    activitySessionId: null as string | null,
    offerSessionId: null as string | null,
    bookingRequestId: null as string | null,
  };

  switch (occurrence.kind) {
    case "visit": {
      let key: string;
      try {
        key = buildOccurrenceKey("visit", occurrence.date);
      } catch {
        throw new FeedbackDomainError("INVALID_OCCURRENCE");
      }
      const today = minskDate(now);
      const oldest = minskDate(new Date(now.getTime() - MAX_VISIT_AGE_DAYS * 86_400_000));
      if (occurrence.date > today) throw new FeedbackDomainError("OCCURRENCE_NOT_STARTED");
      if (occurrence.date < oldest) throw new FeedbackDomainError("INVALID_OCCURRENCE");
      return {
        ...base, occurrenceKey: key, visitStatus: "NONE",
        visitedAt: new Date(`${occurrence.date}T12:00:00Z`),
        venuePlaceIdAtVisit: target.currentVenuePlaceId,
      };
    }
    case "session": {
      const session = await db.activitySession.findUnique({
        where: { id: occurrence.id },
        select: { id: true, activityId: true, startsAt: true, withdrawnAt: true },
      });
      if (!session || session.activityId !== target.targetId || session.withdrawnAt) {
        throw new FeedbackDomainError("OCCURRENCE_NOT_FOUND");
      }
      if (session.startsAt.getTime() > now.getTime()) throw new FeedbackDomainError("OCCURRENCE_NOT_STARTED");
      return {
        ...base, activitySessionId: session.id, occurrenceKey: buildOccurrenceKey("session", session.id),
        visitStatus: "SELF_REPORTED", visitedAt: session.startsAt,
        venuePlaceIdAtVisit: target.currentVenuePlaceId,
      };
    }
    case "offer-session": {
      const session = await db.offerSession.findUnique({
        where: { id: occurrence.id },
        select: { id: true, offerId: true, startAt: true, isCancelled: true },
      });
      if (!session || session.offerId !== target.targetId || session.isCancelled) {
        throw new FeedbackDomainError("OCCURRENCE_NOT_FOUND");
      }
      if (session.startAt.getTime() > now.getTime()) throw new FeedbackDomainError("OCCURRENCE_NOT_STARTED");
      return {
        ...base, offerSessionId: session.id, occurrenceKey: buildOccurrenceKey("offer-session", session.id),
        visitStatus: "SELF_REPORTED", visitedAt: session.startAt,
        venuePlaceIdAtVisit: target.currentVenuePlaceId,
      };
    }
    case "booking": {
      const booking = await db.bookingRequest.findUnique({
        where: { id: occurrence.id },
        select: {
          id: true, userId: true, status: true, publicationType: true,
          activityId: true, offerId: true, placeId: true,
          selectedSessionId: true, offerSessionId: true, startsAt: true, completedAt: true, updatedAt: true,
        },
      });
      // Someone else's booking is reported as "not found", never as "forbidden".
      if (!booking || booking.userId !== userId) throw new FeedbackDomainError("OCCURRENCE_NOT_FOUND");
      const matches = target.targetType === "EVENT"
        ? booking.publicationType === "EVENT" && booking.activityId === target.targetId
        : target.targetType === "OFFER"
          ? booking.publicationType === "OFFER" && booking.offerId === target.targetId
          : booking.placeId === target.targetId;
      if (!matches) throw new FeedbackDomainError("OCCURRENCE_NOT_FOUND");
      if (booking.status !== "COMPLETED") throw new FeedbackDomainError("OCCURRENCE_NOT_STARTED");
      return {
        activitySessionId: booking.selectedSessionId ?? null,
        offerSessionId: booking.offerSessionId ?? null,
        bookingRequestId: booking.id,
        occurrenceKey: buildOccurrenceKey("booking", booking.id),
        visitStatus: "VERIFIED",
        visitedAt: booking.startsAt ?? booking.completedAt ?? booking.updatedAt,
        venuePlaceIdAtVisit: booking.placeId ?? target.currentVenuePlaceId,
      };
    }
    case "plan": {
      const experience = await db.experience.findUnique({
        where: { sourcePlanItemId: occurrence.id },
        select: { userId: true, entityType: true, entityId: true, attendance: true, plannedStartsAt: true, attendanceConfirmedAt: true },
      });
      if (
        !experience || experience.userId !== userId
        || experience.entityType !== target.targetType || experience.entityId !== target.targetId
      ) {
        throw new FeedbackDomainError("OCCURRENCE_NOT_FOUND");
      }
      if (experience.attendance !== "ATTENDED") throw new FeedbackDomainError("OCCURRENCE_NOT_STARTED");
      return {
        ...base, occurrenceKey: buildOccurrenceKey("plan", occurrence.id),
        visitStatus: "SELF_REPORTED",
        visitedAt: experience.plannedStartsAt ?? experience.attendanceConfirmedAt,
        // A plan item carries no historical venue evidence: never infer it from the current
        // Activity/Offer location (it may have moved since). A place is its own venue.
        venuePlaceIdAtVisit: target.targetType === "PLACE" ? target.targetId : null,
      };
    }
  }
}
