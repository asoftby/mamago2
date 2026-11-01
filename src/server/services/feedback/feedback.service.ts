import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  feedbackActorKey,
  isFeedbackStars,
  MAX_FEEDBACK_REVIEW_LENGTH,
  MAX_FEEDBACK_TAGS,
  starPresentation,
  starRatingPublicEligible,
  tagShare,
  type FeedbackStars,
} from "@/lib/feedback/model";
import { tagOfferedFor } from "@/lib/feedback/starAggregate";
import { FeedbackDomainError } from "./feedbackErrors";
import { resolveOccurrence, resolveStarTarget, type OccurrenceInput, type StarTargetType } from "./feedbackOccurrence";
import { recomputeForReaction } from "./feedbackAggregate.service";

/**
 * Single write path for 1–5 star ratings of real experience (ТЗ Feedback 5★, раздел 7).
 * Every change writes a FeedbackRevision and recomputes the affected aggregates
 * in the same transaction.
 */

export const STAR_RATINGS_PER_DAY = 30;
export const REVIEW_TEXTS_PER_DAY = 5;
const DAY_MS = 86_400_000;
const TX_OPTIONS = { timeout: 15_000, maxWait: 5_000 } as const;

export type FeedbackUser = {
  id: string;
  phoneE164: string | null;
  phoneVerifiedAt: Date | null;
};

export type SubmitStarRatingInput = {
  user: FeedbackUser;
  targetType: string;
  targetId: string;
  value: number;
  tagIds?: readonly string[];
  occurrence: OccurrenceInput;
  experienceLevel?: "TRIAL" | "REGULAR" | null;
  source?: "CARD" | "PLAN" | "PUSH";
  now?: Date;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function enforceRateLimit(key: string, limit: number): Promise<void> {
  const result = await checkRateLimit(key, limit, DAY_MS);
  if (!result.allowed) throw new FeedbackDomainError("RATE_LIMITED");
}

export async function submitStarRating(input: SubmitStarRatingInput): Promise<{ reactionId: string; created: boolean }> {
  if (!isFeedbackStars(input.value)) throw new FeedbackDomainError("INVALID_VALUE");
  const tagIds = [...new Set(input.tagIds ?? [])];
  if (tagIds.length > MAX_FEEDBACK_TAGS) throw new FeedbackDomainError("INVALID_TAG");
  await enforceRateLimit(`feedback_star:${input.user.id}`, STAR_RATINGS_PER_DAY);

  const attempt = () => prisma.$transaction((tx) => writeStarRating(tx, { ...input, tagIds, value: input.value as FeedbackStars }), TX_OPTIONS);
  try {
    return await attempt();
  } catch (error) {
    // Two concurrent first ratings of the same visit: the loser retries as an update.
    if (isUniqueViolation(error)) return attempt();
    throw error;
  }
}

async function writeStarRating(
  tx: Prisma.TransactionClient,
  input: SubmitStarRatingInput & { tagIds: string[]; value: FeedbackStars },
): Promise<{ reactionId: string; created: boolean }> {
  const now = input.now ?? new Date();
  const target = await resolveStarTarget(tx, input.targetType, input.targetId);
  const occurrence = await resolveOccurrence(tx, { userId: input.user.id, target, occurrence: input.occurrence, now });

  if (input.experienceLevel && !target.supportsExperienceLevel) {
    throw new FeedbackDomainError("EXPERIENCE_LEVEL_NOT_APPLICABLE");
  }

  if (input.tagIds.length > 0) {
    const tags = await tx.feedbackTag.findMany({
      where: { id: { in: input.tagIds }, isActive: true },
      select: { id: true, key: true, showFor: true, targetTypes: true, partyCategories: true },
    });
    const offered = tags.filter((tag) => tagOfferedFor(
      { ...tag, targetTypes: tag.targetTypes as string[], partyCategories: tag.partyCategories as string[] },
      { targetType: target.targetType, value: input.value, partyCategory: target.partyCategory },
    ));
    if (offered.length !== input.tagIds.length) throw new FeedbackDomainError("INVALID_TAG");
  }

  const actorKey = feedbackActorKey({ userId: input.user.id });
  const uniqueKey = {
    actorKey,
    targetType: target.targetType,
    targetId: target.targetId,
    occurrenceKey: occurrence.occurrenceKey,
    scale: "STARS5" as const,
  };
  const existing = await tx.feedbackReaction.findUnique({
    where: { actorKey_targetType_targetId_occurrenceKey_scale: uniqueKey },
    select: { id: true, venuePlaceIdAtVisit: true },
  });

  const mutable = {
    value: input.value,
    tagIds: input.tagIds,
    visitStatus: occurrence.visitStatus,
    visitedAt: occurrence.visitedAt,
    activitySessionId: occurrence.activitySessionId,
    offerSessionId: occurrence.offerSessionId,
    bookingRequestId: occurrence.bookingRequestId,
    experienceLevel: input.experienceLevel ?? null,
    withdrawnAt: null,
    // Решение 01.11: an authenticated user's stars are public without a verified phone.
    isPublicEligible: starRatingPublicEligible({ authenticated: true }),
  };

  const reaction = existing
    ? await tx.feedbackReaction.update({
      where: { id: existing.id },
      // The venue snapshot is immutable once set.
      data: { ...mutable, venuePlaceIdAtVisit: existing.venuePlaceIdAtVisit ?? occurrence.venuePlaceIdAtVisit },
      select: { id: true, venuePlaceIdAtVisit: true },
    })
    : await tx.feedbackReaction.create({
      data: {
        ...uniqueKey,
        ...mutable,
        userId: input.user.id,
        source: input.source ?? "CARD",
        venuePlaceIdAtVisit: occurrence.venuePlaceIdAtVisit,
      },
      select: { id: true, venuePlaceIdAtVisit: true },
    });

  await tx.feedbackRevision.create({
    data: {
      reactionId: reaction.id, value: input.value, scale: "STARS5", tagIds: input.tagIds,
      reason: "USER_EDIT", actorKey,
    },
  });

  await recomputeForReaction(tx, {
    targetType: target.targetType,
    targetId: target.targetId,
    venuePlaceIds: [existing?.venuePlaceIdAtVisit ?? null, reaction.venuePlaceIdAtVisit],
  }, now);

  return { reactionId: reaction.id, created: !existing };
}

async function ownReaction(tx: Prisma.TransactionClient, userId: string, reactionId: string) {
  const reaction = await tx.feedbackReaction.findUnique({
    where: { id: reactionId },
    select: {
      id: true, actorKey: true, scale: true, withdrawnAt: true, value: true, tagIds: true,
      targetType: true, targetId: true, venuePlaceIdAtVisit: true,
    },
  });
  // Someone else's reaction is reported as missing, never as forbidden.
  if (!reaction || reaction.actorKey !== feedbackActorKey({ userId }) || reaction.scale !== "STARS5") {
    throw new FeedbackDomainError("REACTION_NOT_FOUND");
  }
  return reaction;
}

/** Text review: verified phone required; goes to moderation; the last published text stays visible. */
export async function submitReviewText(input: { user: FeedbackUser; reactionId: string; text: string }): Promise<{ status: "PENDING" }> {
  if (!input.user.phoneE164 || !input.user.phoneVerifiedAt) throw new FeedbackDomainError("PHONE_NOT_VERIFIED");
  const text = input.text.trim();
  if (!text || text.length > MAX_FEEDBACK_REVIEW_LENGTH) throw new FeedbackDomainError("INVALID_REVIEW_TEXT");
  await enforceRateLimit(`feedback_text:${input.user.id}`, REVIEW_TEXTS_PER_DAY);

  return prisma.$transaction(async (tx) => {
    const reaction = await ownReaction(tx, input.user.id, input.reactionId);
    if (reaction.withdrawnAt) throw new FeedbackDomainError("REACTION_NOT_FOUND");
    const existing = await tx.feedbackReview.findUnique({
      where: { reactionId: reaction.id },
      select: { text: true, status: true, publishedText: true, publishedAt: true, moderatedAt: true, updatedAt: true },
    });
    if (existing && existing.text === text && existing.status === "PENDING") return { status: "PENDING" as const };

    const keepPublished = existing?.status === "PUBLISHED"
      ? { publishedText: existing.text, publishedAt: existing.moderatedAt ?? existing.updatedAt }
      : { publishedText: existing?.publishedText ?? null, publishedAt: existing?.publishedAt ?? null };

    await tx.feedbackReview.upsert({
      where: { reactionId: reaction.id },
      create: { reactionId: reaction.id, text, status: "PENDING", phoneVerifiedAt: input.user.phoneVerifiedAt },
      update: {
        text, status: "PENDING", phoneVerifiedAt: input.user.phoneVerifiedAt,
        moderatedById: null, moderatedAt: null, ...keepPublished,
      },
    });
    await tx.feedbackRevision.create({
      data: {
        reactionId: reaction.id, value: reaction.value, scale: "STARS5", tagIds: reaction.tagIds,
        reviewText: text, reviewStatus: "PENDING", reason: "USER_EDIT", actorKey: reaction.actorKey,
      },
    });
    return { status: "PENDING" as const };
  }, TX_OPTIONS);
}

/** Author withdraws the rating: it leaves every aggregate; history is kept. Idempotent. */
export async function withdrawStarRating(input: { userId: string; reactionId: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    const reaction = await ownReaction(tx, input.userId, input.reactionId);
    if (reaction.withdrawnAt) return;
    await tx.feedbackReaction.update({ where: { id: reaction.id }, data: { withdrawnAt: now } });
    await tx.feedbackRevision.create({
      data: {
        reactionId: reaction.id, value: reaction.value, scale: "STARS5", tagIds: reaction.tagIds,
        reason: "USER_EDIT", actorKey: reaction.actorKey,
      },
    });
    await recomputeForReaction(tx, {
      targetType: reaction.targetType as StarTargetType,
      targetId: reaction.targetId,
      venuePlaceIds: [reaction.venuePlaceIdAtVisit],
    }, now);
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type AggregateRow = Prisma.FeedbackReputationAggregateGetPayload<object>;

export type RatingSummary = {
  count: number;
  average: number | null;
  presentation: string;
  distribution: [number, number, number, number, number];
  verifiedCount: number;
};

function summarize(row: AggregateRow | null | undefined): RatingSummary {
  const count = row?.ratingCount ?? 0;
  const average = row?.ratingAverage ?? null;
  return {
    count,
    average,
    presentation: starPresentation({ count, average }),
    distribution: row ? [row.c1, row.c2, row.c3, row.c4, row.c5] : [0, 0, 0, 0, 0],
    verifiedCount: row?.verifiedCount ?? 0,
  };
}

export type FeedbackSummary = {
  targetType: string;
  targetId: string;
  /** PLACE_VISIT offers show the place's rating, labelled as such. */
  inheritedFrom: { targetType: "PLACE"; targetId: string } | null;
  rating: RatingSummary;
  chips: Array<{ key: string; label: string; share: number; eligible: number }>;
  /** PLACE only: how events and services held here are rated. */
  linked: { events: RatingSummary; offers: RatingSummary } | null;
};

const MAX_SUMMARY_CHIPS = 5;

export async function getFeedbackSummary(input: { targetType: string; targetId: string }): Promise<FeedbackSummary> {
  let targetType = input.targetType;
  let targetId = input.targetId;
  let inheritedFrom: FeedbackSummary["inheritedFrom"] = null;
  if (targetType === "OFFER") {
    const offer = await prisma.offer.findUnique({ where: { id: targetId }, select: { productType: true, placeId: true } });
    if (!offer) throw new FeedbackDomainError("TARGET_NOT_FOUND");
    if (offer.productType === "PLACE_VISIT" && offer.placeId) {
      inheritedFrom = { targetType: "PLACE", targetId: offer.placeId };
      targetType = "PLACE";
      targetId = offer.placeId;
    }
  }
  if (!["PLACE", "EVENT", "OFFER", "BUSINESS"].includes(targetType)) throw new FeedbackDomainError("TARGET_NOT_RATEABLE");

  const rows = await prisma.feedbackReputationAggregate.findMany({
    where: { targetType: targetType as "PLACE", targetId },
  });
  const byProjection = new Map(rows.map((row) => [row.projection, row]));
  const main = byProjection.get(targetType === "BUSINESS" ? "BUSINESS_ROLLUP" : "DIRECT");

  const stats = (main?.tagStats ?? {}) as Record<string, { selected: number; eligible: number; authors?: number }>;
  const shares = Object.entries(stats)
    .map(([key, stat]) => ({ key, eligible: stat.eligible, share: tagShare({ selected: stat.selected, eligible: stat.eligible, distinctAuthors: stat.authors ?? stat.selected }) }))
    .filter((chip): chip is { key: string; eligible: number; share: number } => chip.share !== null)
    .sort((a, b) => b.share - a.share || b.eligible - a.eligible)
    .slice(0, MAX_SUMMARY_CHIPS);
  const labels = shares.length === 0 ? [] : await prisma.feedbackTag.findMany({
    where: { key: { in: shares.map((chip) => chip.key) } },
    select: { key: true, label: true },
  });
  const labelOf = new Map(labels.map((tag) => [tag.key, tag.label]));

  return {
    targetType: input.targetType,
    targetId: input.targetId,
    inheritedFrom,
    rating: summarize(main),
    chips: shares.filter((chip) => labelOf.has(chip.key)).map((chip) => ({ ...chip, label: labelOf.get(chip.key)! })),
    linked: targetType === "PLACE"
      ? { events: summarize(byProjection.get("LINKED_EVENT")), offers: summarize(byProjection.get("LINKED_OFFER")) }
      : null,
  };
}

export type PublishedReview = {
  id: string;
  stars: number;
  text: string;
  verifiedVisit: boolean;
  experienceLevel: "TRIAL" | "REGULAR" | null;
  businessReply: string | null;
  publishedAt: string;
};

const REVIEWS_PAGE = 20;

/** Published texts only; an edited review shows its last approved version until re-moderated. */
export async function listPublishedReviews(input: { targetType: string; targetId: string; cursor?: string | null }): Promise<{ reviews: PublishedReview[]; nextCursor: string | null }> {
  let { targetType, targetId } = input;
  if (targetType === "OFFER") {
    const offer = await prisma.offer.findUnique({ where: { id: targetId }, select: { productType: true, placeId: true } });
    if (offer?.productType === "PLACE_VISIT" && offer.placeId) {
      targetType = "PLACE";
      targetId = offer.placeId;
    }
  }
  if (!["PLACE", "EVENT", "OFFER"].includes(targetType)) throw new FeedbackDomainError("TARGET_NOT_RATEABLE");

  const rows = await prisma.feedbackReview.findMany({
    where: {
      reaction: { targetType: targetType as "PLACE", targetId, scale: "STARS5", withdrawnAt: null, isPublicEligible: true },
      OR: [{ status: "PUBLISHED" }, { publishedText: { not: null } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: REVIEWS_PAGE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true, text: true, status: true, publishedText: true, publishedAt: true, moderatedAt: true, createdAt: true,
      businessReply: true, businessReplyStatus: true,
      reaction: { select: { value: true, visitStatus: true, experienceLevel: true } },
    },
  });
  const page = rows.slice(0, REVIEWS_PAGE);
  return {
    reviews: page.map((row) => {
      const live = row.status === "PUBLISHED";
      return {
        id: row.id,
        stars: row.reaction.value,
        text: live ? row.text : row.publishedText!,
        verifiedVisit: row.reaction.visitStatus === "VERIFIED",
        experienceLevel: row.reaction.experienceLevel,
        businessReply: row.businessReplyStatus === "PUBLISHED" ? row.businessReply : null,
        publishedAt: ((live ? row.moderatedAt : row.publishedAt) ?? row.createdAt).toISOString(),
      };
    }),
    nextCursor: rows.length > REVIEWS_PAGE ? page[page.length - 1].id : null,
  };
}

/** Active chips for a target type and star value (and party category for party services). */
export async function listAvailableTags(input: { targetType: string; value: number; partyCategory?: string | null }) {
  if (!isFeedbackStars(input.value)) throw new FeedbackDomainError("INVALID_VALUE");
  if (!["PLACE", "EVENT", "OFFER"].includes(input.targetType)) return [];
  const tags = await prisma.feedbackTag.findMany({
    where: { isActive: true },
    orderBy: { key: "asc" },
    select: { id: true, key: true, label: true, scope: true, showFor: true, targetTypes: true, partyCategories: true },
  });
  return tags
    .filter((tag) => tagOfferedFor(
      { ...tag, targetTypes: tag.targetTypes as string[], partyCategories: tag.partyCategories as string[] },
      { targetType: input.targetType as "PLACE", value: input.value, partyCategory: input.partyCategory ?? null },
    ))
    .map((tag) => ({ id: tag.id, key: tag.key, label: tag.label, scope: tag.scope }));
}
