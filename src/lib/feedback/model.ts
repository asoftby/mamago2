/**
 * Feedback primitives.
 * No database reads, writes or third-party content. Pure helpers shared by
 * reaction endpoints, read projections and migration tests.
 *
 * Two scales coexist (FeedbackReaction.scale):
 * - STARS5 (1–5): real experience — places, events, classes, services. All new
 *   experience ratings use it.
 * - SENTIMENT3 (−1/0/+1): legacy Feedback 1.0 reactions. Kept as-is, never
 *   converted to stars, never counted in star aggregates.
 */
/** Legacy SENTIMENT3 value. */
export type FeedbackValue = -1 | 0 | 1;
export type FeedbackStars = 1 | 2 | 3 | 4 | 5;
export type FeedbackScale = "SENTIMENT3" | "STARS5";
/** Mirrors the DB enum. BUSINESS exists only for aggregates (performer rollup). */
export type FeedbackTargetType = "EVENT" | "PLACE" | "OFFER" | "ARTICLE" | "NEWS" | "ROUTE" | "BUSINESS";
/** Targets a reaction may reference (SQL CHECK forbids BUSINESS). */
export type FeedbackReactionTargetType = Exclude<FeedbackTargetType, "BUSINESS">;
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

/**
 * Legacy SENTIMENT3 index on a 0–1 scale. Kept only for migration tests and
 * comparisons; star ranking uses `feedbackRankScore`.
 */
export function legacySentimentRankScore(input: {
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

// ---------------------------------------------------------------------------
// STARS5 (1–5) — ТЗ «Рейтинги mamaGo 2.0 — Feedback 5★», раздел 5
// ---------------------------------------------------------------------------

/** Neutral category prior (stars) when a category has too few ratings. */
export const DEFAULT_CATEGORY_PRIOR_STARS = 4.0;
/** Minimum ratings in a category / targetType before its own mean is the prior. */
export const MIN_PRIOR_SAMPLE = 50;
/** Chips show a share only from this many reactions that were offered the chip. */
export const MIN_TAG_ELIGIBLE = 5;

export function isFeedbackStars(value: unknown): value is FeedbackStars {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isReactionTargetType(value: FeedbackTargetType): value is FeedbackReactionTargetType {
  return value !== "BUSINESS";
}

/** Value validity per scale; mirrors FeedbackReaction_value_check. */
export function isValidFeedbackValue(scale: FeedbackScale, value: unknown): boolean {
  return scale === "STARS5" ? isFeedbackStars(value) : isFeedbackValue(value);
}

/**
 * Representative star for a legacy sentiment, used only to pick chips for the
 * legacy emoji UI: −1 → 1, 0 → 3, +1 → 5. Never used to convert stored data.
 */
export function sentimentToRepresentativeStars(value: FeedbackValue): FeedbackStars {
  return value === 1 ? 5 : value === 0 ? 3 : 1;
}

export type FeedbackOccurrenceKind = "plan" | "session" | "offer-session" | "booking" | "visit" | "legacy";
const OCCURRENCE_KINDS: readonly FeedbackOccurrenceKind[] = ["plan", "session", "offer-session", "booking", "visit", "legacy"];
const VISIT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical prefixed occurrence key, e.g. `session:<ActivitySession.id>`. */
export function buildOccurrenceKey(kind: FeedbackOccurrenceKind, id: string): string {
  const value = id.trim();
  if (!value) throw new Error("Occurrence id is required");
  if (value.includes(":")) throw new Error("Occurrence id must not contain ':'");
  if (kind === "visit") {
    const date = new Date(`${value}T00:00:00Z`);
    if (!VISIT_DATE.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error("Visit occurrence must be a valid YYYY-MM-DD date");
    }
  }
  return `${kind}:${value}`;
}

export function parseOccurrenceKey(key: string): { kind: FeedbackOccurrenceKind; id: string } | null {
  const at = key.indexOf(":");
  if (at <= 0) return null;
  const kind = key.slice(0, at) as FeedbackOccurrenceKind;
  const id = key.slice(at + 1);
  if (!OCCURRENCE_KINDS.includes(kind) || !id) return null;
  return { kind, id };
}

export type StarDistribution = {
  count: number;
  sum: number;
  /** c[0] = number of 1★ … c[4] = number of 5★ */
  c: [number, number, number, number, number];
  /** Unrounded mean, null when count = 0. */
  average: number | null;
};

export function starDistribution(values: readonly FeedbackStars[]): StarDistribution {
  const c: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const value of values) {
    if (!isFeedbackStars(value)) throw new Error("Star rating must be an integer between 1 and 5");
    c[value - 1] += 1;
    sum += value;
  }
  const count = values.length;
  return { count, sum, c, average: count > 0 ? sum / count : null };
}

/** "4,7": one decimal, Russian decimal comma. */
export function formatStarAverage(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1).replace(".", ",");
}

/** оценка / оценки / оценок */
export function ratingsWord(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "оценок";
  if (mod10 === 1) return "оценка";
  if (mod10 >= 2 && mod10 <= 4) return "оценки";
  return "оценок";
}

/** Card label: 0 → invite, 1–4 → count only, ≥5 → ★ average · count. */
export function starPresentation(input: { count: number; average: number | null }): string {
  if (input.count <= 0) return "Оцените первым";
  if (input.count < MIN_PUBLIC_FEEDBACK_COUNT || input.average === null) {
    return `Пока мало оценок · ${input.count}`;
  }
  return `★ ${formatStarAverage(input.average)} · ${input.count} ${ratingsWord(input.count)}`;
}

/**
 * Prior for the Bayesian index: category mean when it has ≥ MIN_PRIOR_SAMPLE
 * ratings, else the targetType mean under the same rule, else the constant.
 */
export function resolveCategoryPrior(input: {
  category?: { count: number; mean: number | null } | null;
  targetType?: { count: number; mean: number | null } | null;
  fallback?: number;
  minSample?: number;
}): number {
  const min = input.minSample ?? MIN_PRIOR_SAMPLE;
  for (const level of [input.category, input.targetType]) {
    if (level && level.count >= min && level.mean !== null && level.mean >= 1 && level.mean <= 5) return level.mean;
  }
  return input.fallback ?? DEFAULT_CATEGORY_PRIOR_STARS;
}

/**
 * Bayesian star index (1–5): (m·C + Σ wᵢvᵢ) / (m + Σ wᵢ).
 * A target with no ratings gets exactly the prior C, i.e. a neutral position.
 * Weights come from `feedbackWeight` (verified ×1.5, older than 12 months ×0.5).
 */
export function feedbackRankScore(input: {
  ratings: readonly { value: FeedbackStars; weight: number }[];
  categoryPrior: number;
  priorWeight?: number;
}): number {
  const m = input.priorWeight ?? BAYESIAN_PRIOR_WEIGHT;
  if (!Number.isFinite(input.categoryPrior) || input.categoryPrior < 1 || input.categoryPrior > 5) {
    throw new Error("categoryPrior must be between 1 and 5 stars");
  }
  if (!Number.isFinite(m) || m < 0) throw new Error("priorWeight must be nonnegative");
  let weightedValue = 0;
  let totalWeight = 0;
  for (const rating of input.ratings) {
    if (!isFeedbackStars(rating.value) || !Number.isFinite(rating.weight) || rating.weight <= 0) {
      throw new Error("Invalid star rating or weight");
    }
    weightedValue += rating.value * rating.weight;
    totalWeight += rating.weight;
  }
  if (totalWeight + m === 0) return input.categoryPrior;
  return (weightedValue + m * input.categoryPrior) / (totalWeight + m);
}

/**
 * Chip share = selected / eligible, where eligible counts reactions to which the
 * chip was offered (matching target, showFor and party category). Shown only
 * with ≥ MIN_TAG_ELIGIBLE eligible reactions and ≥ MIN_TAG_MENTIONS distinct authors.
 */
export function tagShare(input: { selected: number; eligible: number; distinctAuthors: number }): number | null {
  if (input.eligible < MIN_TAG_ELIGIBLE || input.distinctAuthors < MIN_TAG_MENTIONS || input.selected <= 0) return null;
  return Math.min(1, input.selected / input.eligible);
}

/**
 * STARS5 public eligibility (решение 01.11.2026): an authenticated user's star
 * rating is public and ranked without a verified phone; the phone is required
 * only for review text. Guests never rate. The legacy SENTIMENT3 rule
 * (`feedbackPublicEligible`) is unchanged.
 */
export function starRatingPublicEligible(input: { authenticated: boolean }): boolean {
  return input.authenticated;
}
