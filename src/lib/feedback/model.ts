/**
 * Feedback v1 primitives.
 * No database reads, writes or third-party content. Pure helpers shared by
 * eventual reaction endpoints, read projections and migration tests.
 */
export type FeedbackValue = -1 | 0 | 1;
export type FeedbackTargetType = "EVENT" | "PLACE" | "OFFER" | "ARTICLE" | "NEWS" | "ROUTE";
export type FeedbackVisitStatus = "NONE" | "SELF_REPORTED" | "VERIFIED";

export const MIN_PUBLIC_FEEDBACK_COUNT = 5;
export const MIN_TAG_MENTIONS = 3;
export const MAX_FEEDBACK_TAGS = 3;
export const MAX_FEEDBACK_REVIEW_LENGTH = 2000;
export const BAYESIAN_PRIOR_WEIGHT = 10;

export function isFeedbackValue(value: unknown): value is FeedbackValue {
  return value === -1 || value === 0 || value === 1;
}

/** Canonical key for uniqueness, never nullable (Postgres NULLs are distinct). */
export function feedbackOccurrenceKey(occurrenceId?: string | null): string {
  return occurrenceId?.trim() ?? "";
}

export function feedbackActorKey(input: {
  userId?: string | null;
  anonymousOpaqueId?: string | null;
}): string {
  if (input.userId?.trim()) return `user:${input.userId.trim()}`;
  // Never use a raw IP address or a shared "anonymous" identity.
  if (input.anonymousOpaqueId?.trim()) return `guest:${input.anonymousOpaqueId.trim()}`;
  throw new Error("A stable per-user or opaque guest identity is required");
}

export function experienceSentimentToValue(sentiment: "LIKE" | "NEUTRAL" | "DISLIKE"): FeedbackValue {
  return sentiment === "LIKE" ? 1 : sentiment === "DISLIKE" ? -1 : 0;
}

export function emojiRatingToValue(rating: "like" | "neutral" | "dislike"): FeedbackValue {
  return rating === "like" ? 1 : rating === "dislike" ? -1 : 0;
}

export function legacyStarsToFeedbackValue(stars: number): FeedbackValue {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("Legacy rating must be an integer between 1 and 5");
  }
  return stars < 3 ? -1 : stars === 3 ? 0 : 1;
}

export type FeedbackCounts = {
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  positiveShare: number | null;
};

export function feedbackCounts(values: readonly FeedbackValue[]): FeedbackCounts {
  const positive = values.filter((v) => v === 1).length;
  const neutral = values.filter((v) => v === 0).length;
  const negative = values.filter((v) => v === -1).length;
  const count = values.length;
  return {
    count, positive, neutral, negative,
    positiveShare: count >= MIN_PUBLIC_FEEDBACK_COUNT ? positive / count : null,
  };
}

export function feedbackPresentation(counts: FeedbackCounts): string {
  if (counts.count === 0) return "Оцените первым";
  if (counts.count < MIN_PUBLIC_FEEDBACK_COUNT) {
    return `Пока мало оценок · ${counts.count}`;
  }
  return `😍 ${Math.round((counts.positiveShare ?? 0) * 100)}% понравилось · ${counts.count} ${counts.count === 1 ? "оценка" : "оценок"}`;
}

export function feedbackWeight(input: {
  visitStatus: FeedbackVisitStatus;
  ratedAt: Date;
  now: Date;
}): number {
  const twelveMonthsAgo = new Date(input.now);
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);
  const ageWeight = input.ratedAt < twelveMonthsAgo ? 0.5 : 1;
  return ageWeight * (input.visitStatus === "VERIFIED" ? 1.5 : 1);
}

export function feedbackRankScore(input: {
  ratings: readonly { value: FeedbackValue; weight: number }[];
  categoryPrior: number;
  priorWeight?: number;
}): number {
  const m = input.priorWeight ?? BAYESIAN_PRIOR_WEIGHT;
  if (!(input.categoryPrior >= 0 && input.categoryPrior <= 1) || !Number.isFinite(input.categoryPrior)) {
    throw new Error("categoryPrior must be between 0 and 1");
  }
  if (!Number.isFinite(m) || m < 0) throw new Error("priorWeight must be nonnegative");
  let weightedValue = 0;
  let totalWeight = 0;
  for (const rating of input.ratings) {
    if (!isFeedbackValue(rating.value) || !Number.isFinite(rating.weight) || rating.weight <= 0) {
      throw new Error("Invalid feedback rating or weight");
    }
    weightedValue += ((rating.value + 1) / 2) * rating.weight;
    totalWeight += rating.weight;
  }
  if (totalWeight + m === 0) return input.categoryPrior;
  return (weightedValue + m * input.categoryPrior) / (totalWeight + m);
}

/** Eligibility defaults to private. Must not be inferred from login or rating alone. */
export function feedbackPublicEligible(input: {
  isPhoneVerified: boolean;
  publicReactionPolicyApproved: boolean;
  optedIntoPublic: boolean;
}): boolean {
  return input.optedIntoPublic && input.publicReactionPolicyApproved && input.isPhoneVerified;
}
