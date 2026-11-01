/**
 * Pure star-aggregate computation (ТЗ Feedback 5★, раздел 5).
 * No database access: the aggregate service loads rows and persists the result.
 */
import {
  feedbackRankScore,
  feedbackWeight,
  isFeedbackStars,
  type FeedbackStars,
  type FeedbackTargetType,
  type FeedbackVisitStatus,
} from "./model";

export type StarReactionRow = {
  id: string;
  actorKey: string;
  /** The rated object; dedupe is per (actor, target). */
  targetId: string;
  value: number;
  tagIds: readonly string[];
  visitStatus: FeedbackVisitStatus;
  /** Last time the author set this rating. */
  ratedAt: Date;
};

export type AggregateTagDef = {
  id: string;
  key: string;
  showFor: readonly number[];
  targetTypes: readonly string[];
  partyCategories: readonly string[];
};

export type TagStat = { selected: number; eligible: number };

export type StarAggregate = {
  ratingCount: number;
  ratingSum: number;
  ratingAverage: number | null;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  verifiedCount: number;
  rankScore: number;
  tagStats: Record<string, TagStat>;
};

/**
 * One rating per author per target: the most recently rated one wins (ties by
 * id for determinism). A user who rated several visits counts once (ТЗ 5.1).
 */
export function latestPerActor<T extends StarReactionRow>(rows: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.actorKey}\u0000${row.targetId}`;
    const current = latest.get(key);
    if (
      !current
      || row.ratedAt.getTime() > current.ratedAt.getTime()
      || (row.ratedAt.getTime() === current.ratedAt.getTime() && row.id > current.id)
    ) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

/** Whether a chip was offered for this rating (target, star value, party category). */
export function tagOfferedFor(
  tag: AggregateTagDef,
  input: { targetType: FeedbackTargetType; value: number; partyCategory?: string | null },
): boolean {
  if (!tag.targetTypes.includes(input.targetType) || !tag.showFor.includes(input.value)) return false;
  return tag.partyCategories.length === 0
    || (input.partyCategory != null && tag.partyCategories.includes(input.partyCategory));
}

export function computeStarAggregate(input: {
  rows: readonly StarReactionRow[];
  /** Target type the chips are evaluated against (the rated objects' type). */
  targetType: FeedbackTargetType;
  partyCategory?: string | null;
  categoryPrior: number;
  tags: readonly AggregateTagDef[];
  now: Date;
}): StarAggregate {
  const rows = latestPerActor(input.rows).filter((row) => isFeedbackStars(row.value));
  const c = [0, 0, 0, 0, 0];
  let sum = 0;
  let verifiedCount = 0;
  const weighted: { value: FeedbackStars; weight: number }[] = [];
  for (const row of rows) {
    const value = row.value as FeedbackStars;
    c[value - 1] += 1;
    sum += value;
    if (row.visitStatus === "VERIFIED") verifiedCount += 1;
    weighted.push({
      value,
      weight: feedbackWeight({ visitStatus: row.visitStatus, ratedAt: row.ratedAt, now: input.now }),
    });
  }

  const tagStats: Record<string, TagStat> = {};
  for (const tag of input.tags) {
    let eligible = 0;
    let selected = 0;
    for (const row of rows) {
      if (!tagOfferedFor(tag, { targetType: input.targetType, value: row.value, partyCategory: input.partyCategory })) continue;
      eligible += 1;
      if (row.tagIds.includes(tag.id)) selected += 1;
    }
    if (eligible > 0) tagStats[tag.key] = { selected, eligible };
  }

  const count = rows.length;
  return {
    ratingCount: count,
    ratingSum: sum,
    ratingAverage: count > 0 ? sum / count : null,
    c1: c[0], c2: c[1], c3: c[2], c4: c[3], c5: c[4],
    verifiedCount,
    rankScore: feedbackRankScore({ ratings: weighted, categoryPrior: input.categoryPrior }),
    tagStats,
  };
}
