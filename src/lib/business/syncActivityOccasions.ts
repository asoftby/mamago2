/**
 * Sync ActivityOccasion links for a given activity.
 * Replaces the current set of occasion links with the provided occasionIds.
 * Safe to call with an empty array (removes all links).
 *
 * Uses prismaBase (not the extended client) so that activityOccasion
 * is available on the transaction client type.
 */
import { prismaBase } from "@/lib/prisma";

export async function syncActivityOccasions(
  activityId: string,
  occasionIds: string[],
): Promise<void> {
  await prismaBase.$transaction(async (tx) => {
    // Remove all existing links
    await tx.activityOccasion.deleteMany({ where: { activityId } });

    if (occasionIds.length === 0) return;

    // Verify occasions exist and are active (ignore invalid ids silently)
    const valid = await tx.occasion.findMany({
      where: { id: { in: occasionIds }, isActive: true },
      select: { id: true },
    });

    if (valid.length === 0) return;

    await tx.activityOccasion.createMany({
      data: valid.map((o) => ({ activityId, occasionId: o.id })),
      skipDuplicates: true,
    });
  });
}
