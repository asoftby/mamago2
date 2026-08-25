import type { UserBehaviorProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SegmentKey } from "@/lib/analytics/segmentCatalog";

/** Пороги сегментации — простые эвристики, без ML. */
export const SEGMENT_THRESHOLDS = {
  newUserDays: 7,
  activeDays: 7,
  dormantDays: 30,
  minViewsForBrowser: 12,
  browserMaxSaves: 2,
  browserMaxSaveRatio: 0.045,
  saverMinSaves: 5,
  saverMinSaveRatio: 0.075,
  saverMinViews: 8,
  plannerMinPlanAdds: 3,
  buyerMinCtaClicks: 3,
  planningPatternMinAdds: 2,
  shareHigh: 0.55,
  shareLow: 0.32,
  returningMinGapMs: 60 * 60 * 1000,
} as const;

export type SegmentResolverContext = {
  childrenCount: number;
  /** slug дочерних сигналов из блока «Предпочтения» */
  preferenceSignalSlugs: string[];
  /** slug выбранного формата досуга */
  leisureFormatSlug: string | null;
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function asCountMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) continue;
    out[k] = n;
  }
  return out;
}

function topKey(map: Record<string, number>, ignore = "_none"): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of Object.entries(map)) {
    if (k === ignore) continue;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

/**
 * Вычисляет сегменты пользователя по агрегатам профиля и контексту аккаунта.
 *
 * `PRICE_SENSITIVE` deliberately has no resolver rule in Contract v1: the old
 * rule inferred it from preferredCategories === OFFER, but OFFER is an entity
 * type, not a taxonomy/price signal. The catalog key remains for historical
 * compatibility until a real deal/price-intent signal is designed.
 */
export function resolveSegments(
  profile: Pick<
    UserBehaviorProfile,
    | "totalViews"
    | "totalOpens"
    | "totalSaves"
    | "totalPlanAdds"
    | "totalCtaClicks"
    | "firstSeenAt"
    | "lastSeenAt"
    | "weekendShare"
    | "sameDayPlanningShare"
    | "advancePlanningShare"
    | "preferredVerticals"
    | "preferredCategories"
  >,
  ctx: SegmentResolverContext,
): SegmentKey[] {
  const keys = new Set<SegmentKey>();
  const now = new Date();
  const T = SEGMENT_THRESHOLDS;

  const views = profile.totalViews;
  const saves = profile.totalSaves;
  const planAdds = profile.totalPlanAdds;
  const cta = profile.totalCtaClicks;
  const saveRatio = views > 0 ? saves / views : 0;
  const ctaRatio = views > 0 ? cta / views : 0;

  const first = profile.firstSeenAt;
  const last = profile.lastSeenAt;

  if (first && daysBetween(first, now) < T.newUserDays) {
    keys.add("NEW_USER");
  }

  if (
    first &&
    last &&
    last.getTime() - first.getTime() > T.returningMinGapMs
  ) {
    keys.add("RETURNING_USER");
  }

  if (last) {
    const idleDays = daysBetween(last, now);
    if (idleDays <= T.activeDays) {
      keys.add("ACTIVE_USER");
    }
    if (idleDays > T.dormantDays) {
      keys.add("DORMANT_USER");
    }
  }

  if (
    views >= T.minViewsForBrowser &&
    saves <= T.browserMaxSaves &&
    saveRatio <= T.browserMaxSaveRatio
  ) {
    keys.add("BROWSER");
  }

  if (
    saves >= T.saverMinSaves ||
    (views >= T.saverMinViews && saveRatio >= T.saverMinSaveRatio)
  ) {
    keys.add("SAVER");
  }

  if (planAdds >= T.plannerMinPlanAdds) {
    keys.add("PLANNER");
  }

  if (cta >= T.buyerMinCtaClicks || (views >= 15 && ctaRatio >= 0.09)) {
    keys.add("BUYER_INTENT");
  }

  if (
    planAdds >= T.planningPatternMinAdds &&
    profile.sameDayPlanningShare >= T.shareHigh
  ) {
    keys.add("LAST_MINUTE");
  }

  if (
    planAdds >= T.planningPatternMinAdds &&
    profile.advancePlanningShare >= T.shareHigh
  ) {
    keys.add("ADVANCE_PLANNER");
  }

  if (
    planAdds >= T.planningPatternMinAdds &&
    profile.weekendShare >= T.shareHigh
  ) {
    keys.add("WEEKEND_ORIENTED");
  }

  if (
    planAdds >= T.planningPatternMinAdds &&
    profile.weekendShare <= T.shareLow
  ) {
    keys.add("WEEKDAY_ORIENTED");
  }

  if (ctx.childrenCount === 1) keys.add("ONE_CHILD");
  if (ctx.childrenCount >= 2) keys.add("MULTI_CHILD");

  for (const slug of ctx.preferenceSignalSlugs) {
    if (slug === "preferences-active") keys.add("PREFERS_ACTIVE");
    if (slug === "preferences-creative") keys.add("PREFERS_CREATIVE");
  }

  const vert = asCountMap(profile.preferredVerticals);
  if (topKey(vert) === "EDUCATION") {
    keys.add("PREFERS_EDUCATIONAL");
  }

  if (ctx.leisureFormatSlug === "leisure-format-home") {
    keys.add("PREFERS_INDOOR");
  }
  if (ctx.leisureFormatSlug === "leisure-format-outdoor") {
    keys.add("PREFERS_OUTDOOR");
  }

  return Array.from(keys).sort();
}

export async function fetchUserSegmentContext(
  userId: string,
): Promise<SegmentResolverContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferenceSignalIds: true,
      leisureFormatSignalId: true,
      _count: { select: { children: true } },
    },
  });
  if (!user) {
    return {
      childrenCount: 0,
      preferenceSignalSlugs: [],
      leisureFormatSlug: null,
    };
  }

  const ids = [
    ...user.preferenceSignalIds,
    user.leisureFormatSignalId,
  ].filter(Boolean) as string[];
  const defs =
    ids.length > 0
      ? await prisma.signalDefinition.findMany({
          where: { id: { in: ids } },
          select: { id: true, slug: true },
        })
      : [];
  const idToSlug = Object.fromEntries(defs.map((d) => [d.id, d.slug]));

  return {
    childrenCount: user._count.children,
    preferenceSignalSlugs: user.preferenceSignalIds
      .map((id) => idToSlug[id])
      .filter(Boolean),
    leisureFormatSlug: user.leisureFormatSignalId
      ? idToSlug[user.leisureFormatSignalId] ?? null
      : null,
  };
}

export async function recomputeSegmentsForUser(userId: string): Promise<void> {
  const profile = await prisma.userBehaviorProfile.findUnique({
    where: { userId },
  });
  if (!profile) return;
  const ctx = await fetchUserSegmentContext(userId);
  const keys = resolveSegments(profile, ctx);
  await prisma.userBehaviorProfile.update({
    where: { userId },
    data: { segmentKeys: keys },
  });
}

export async function recomputeAllBehaviorSegments(): Promise<number> {
  const rows = await prisma.userBehaviorProfile.findMany({
    select: { userId: true },
  });
  for (const { userId } of rows) {
    await recomputeSegmentsForUser(userId);
  }
  return rows.length;
}

export const SegmentResolverService = {
  resolveSegments,
  fetchUserSegmentContext,
  recomputeSegmentsForUser,
  recomputeAllBehaviorSegments,
  SEGMENT_THRESHOLDS,
};
