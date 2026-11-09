import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { publicDiscoveryOccasionWhere } from "@/lib/discovery/occasionUtils";

/**
 * Evergreen articles are always current. Dated public occasions are eligible
 * only inside the calendar's active window AND after editorial approval for
 * that exact startsAt date. This prevents last year's article automatically
 * resurfacing when an administrator advances the occasion to next year.
 */
export function seasonallyCurrentJournalWhere(
  activeOccasions: ReadonlyArray<{ id: string; startsAt: Date | null }>,
): Prisma.ArticleWhereInput {
  return {
    OR: [
      { occasionId: null },
      { occasion: { is: { type: "FAMILY" } } },
      { occasion: { is: { OR: [{ startsAt: null }, { endsAt: null }] } } },
      ...activeOccasions
        .filter((occasion): occasion is { id: string; startsAt: Date } => occasion.startsAt !== null)
        .map((occasion) => ({
          occasionId: occasion.id,
          seasonReviewedForStart: occasion.startsAt,
        })),
    ],
  };
}

/** One source of truth: the existing public discovery occasion date predicate. */
export async function getSeasonallyCurrentJournalWhere(
  now: Date = new Date(),
): Promise<Prisma.ArticleWhereInput> {
  const active = await prisma.occasion.findMany({
    where: publicDiscoveryOccasionWhere(now),
    select: { id: true, startsAt: true },
  });
  return seasonallyCurrentJournalWhere(active);
}
