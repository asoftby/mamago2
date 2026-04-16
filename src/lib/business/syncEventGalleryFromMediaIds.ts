import prisma from "@/lib/prisma";

/**
 * Заменяет ActivityImage строками по MediaAsset.id (publicUrl в ActivityImage.url).
 * coverMediaId исключается из галереи (обложка хранится отдельно в Activity.coverImageId).
 */
export async function replaceActivityGalleryFromMediaIds(
  activityId: string,
  rawMediaIds: string[],
  coverMediaId: string | null,
): Promise<void> {
  const unique = [...new Set(rawMediaIds.filter(Boolean))].filter((id) => id !== coverMediaId);
  const assets =
    unique.length > 0
      ? await prisma.mediaAsset.findMany({
          where: { id: { in: unique }, status: "ACTIVE" },
          select: { id: true, publicUrl: true },
        })
      : [];
  const byId = new Map(assets.map((a) => [a.id, a]));

  await prisma.$transaction(async (tx) => {
    await tx.activityImage.deleteMany({ where: { activityId } });
    let sortOrder = 0;
    for (const mediaId of unique) {
      const a = byId.get(mediaId);
      const url = a?.publicUrl?.trim();
      if (!url) continue;
      await tx.activityImage.create({
        data: {
          activityId,
          url,
          sortOrder: sortOrder++,
        },
      });
    }
  });
}
