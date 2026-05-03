/**
 * Occasion helpers — period-aware ranking/context signals.
 *
 * Occasions are soft contextual signals, not visibility rules.
 * An occasion with startsAt/endsAt is "temporal" and participates in
 * auto-suggest and ranking boost only within its active window.
 * Occasions without dates are plain reference entries and never auto-suggest.
 */

import { prismaBase as prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Occasion } from "@prisma/client";

// ─── Type helpers ────────────────────────────────────────────────────────────

export type OccasionForEditor = Pick<
  Occasion,
  "id" | "name" | "slug" | "type" | "sortOrder" | "boostScore" | "autoSuggest"
>;

function isMissingOccasionBoostScoreColumn(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2022") return false;
  const column = error.meta?.column;
  return typeof column === "string" && column.includes("Occasion.boostScore");
}

let boostScoreColumnSupportPromise: Promise<boolean> | null = null;

async function hasOccasionBoostScoreColumn(): Promise<boolean> {
  if (boostScoreColumnSupportPromise) return boostScoreColumnSupportPromise;

  boostScoreColumnSupportPromise = (async () => {
    try {
      const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Occasion'
            AND column_name = 'boostScore'
        ) AS "exists"
      `);
      return rows[0]?.exists === true;
    } catch {
      return true;
    }
  })();

  return boostScoreColumnSupportPromise;
}

// ─── Pure helpers (no DB) ─────────────────────────────────────────────────────

/**
 * Returns true if the occasion is currently active as a contextual signal:
 * - isActive must be true
 * - autoSuggest must be true
 * - startsAt and endsAt must both be set
 * - now must be within [startsAt, endsAt]
 */
export function isOccasionCurrentlyActive(
  occasion: Pick<Occasion, "isActive" | "autoSuggest" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  if (!occasion.isActive) return false;
  if (!occasion.autoSuggest) return false;
  if (!occasion.startsAt || !occasion.endsAt) return false;
  return now >= occasion.startsAt && now <= occasion.endsAt;
}

// ─── DB queries ───────────────────────────────────────────────────────────────

/**
 * Returns occasions that should be suggested to editors right now.
 * Ordered by: sortOrder asc, boostScore desc, name asc.
 */
export async function getActiveOccasionsForEditor(
  now: Date = new Date(),
): Promise<OccasionForEditor[]> {
  const hasBoostScore = await hasOccasionBoostScoreColumn();

  if (hasBoostScore) {
    return prisma.occasion.findMany({
      where: {
        isActive: true,
        autoSuggest: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        sortOrder: true,
        boostScore: true,
        autoSuggest: true,
      },
      orderBy: [{ sortOrder: "asc" }, { boostScore: "desc" }, { name: "asc" }],
    });
  }

  const fallback = await prisma.occasion.findMany({
    where: {
      isActive: true,
      autoSuggest: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      sortOrder: true,
      autoSuggest: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return fallback.map((item) => ({ ...item, boostScore: 0 }));
}

/**
 * Returns a Map of occasionId → boostScore for all currently active occasions.
 * Used by ranking/scoring layers to apply occasion boost as a soft signal.
 *
 * Occasion boost is a soft contextual ranking signal, not a visibility rule.
 */
export async function getOccasionBoostMap(
  now: Date = new Date(),
): Promise<Map<string, number>> {
  if (!(await hasOccasionBoostScoreColumn())) {
    return new Map();
  }

  const active = await prisma.occasion.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: { id: true, boostScore: true },
  });

  return new Map(active.map((o) => [o.id, o.boostScore]));
}

/**
 * Returns a Map of activityId → max boostScore across all currently active
 * occasions linked to that activity.
 *
 * Uses MAX (not SUM) to prevent uncontrolled score inflation when multiple
 * occasions are linked.
 *
 * Occasion boost is a soft contextual ranking signal, not a visibility rule.
 */
export async function getActivityOccasionBoosts(
  activityIds: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (activityIds.length === 0) return out;

  if (!(await hasOccasionBoostScoreColumn())) {
    return out;
  }

  const occasions = await prisma.occasion.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      activityLinks: {
        some: {
          activityId: { in: activityIds },
        },
      },
    },
    select: {
      boostScore: true,
      activityLinks: {
        where: {
          activityId: { in: activityIds },
        },
        select: {
          activityId: true,
        },
      },
    },
  });

  for (const occasion of occasions) {
    for (const link of occasion.activityLinks) {
      const prev = out.get(link.activityId) ?? 0;
      // MAX strategy: take the highest boost, not the sum
      out.set(link.activityId, Math.max(prev, occasion.boostScore));
    }
  }

  return out;
}
