import prisma from "@/lib/prisma";
import {
  findMediaAssetByReference,
  normalizeMediaDisplayUrl,
} from "@/lib/media/resolveMediaAssetReference";

/**
 * True if ordered gallery URLs already match the given MediaAsset ids (same cover exclusion as replace).
 */
export async function activityGalleryMatchesIncomingMediaIds(
  activityId: string,
  rawMediaIds: unknown[],
  coverMediaId: string | null | undefined,
): Promise<boolean> {
  const incoming = Array.isArray(rawMediaIds)
    ? rawMediaIds.filter((id): id is string => typeof id === "string")
    : [];
  const unique = [...new Set(incoming)].filter((id) => id !== coverMediaId);

  const existingRows = await prisma.activityImage.findMany({
    where: { activityId },
    orderBy: { sortOrder: "asc" },
    select: { url: true, mediaAssetId: true },
  });
  const existingPairs = existingRows.map((row) => ({
    url: row.url.trim(),
    mediaAssetId: row.mediaAssetId,
  }));

  if (unique.length === 0) {
    return existingPairs.length === 0;
  }

  const expectedRows = await Promise.all(
    unique.map(async (ref) => {
      const asset = await findMediaAssetByReference(ref);
      if (asset?.publicUrl?.trim()) {
        return {
          url: asset.publicUrl.trim(),
          mediaAssetId: asset.id,
        };
      }

      const url = normalizeMediaDisplayUrl(ref);
      if (!url) return null;

      return {
        url,
        mediaAssetId: null,
      };
    }),
  );

  const normalizedExpected = expectedRows.filter(
    (row): row is { url: string; mediaAssetId: string | null } => Boolean(row?.url),
  );

  if (normalizedExpected.length !== existingPairs.length) {
    return false;
  }
  for (let i = 0; i < normalizedExpected.length; i++) {
    if (normalizedExpected[i].url !== existingPairs[i]?.url) return false;
    if (normalizedExpected[i].mediaAssetId !== (existingPairs[i]?.mediaAssetId ?? null)) return false;
  }
  return true;
}

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
  const galleryRows = await Promise.all(
    unique.map(async (ref) => {
      const asset = await findMediaAssetByReference(ref);
      if (asset?.publicUrl?.trim()) {
        return {
          mediaAssetId: asset.id,
          url: asset.publicUrl.trim(),
        };
      }

      const url = normalizeMediaDisplayUrl(ref);
      if (!url) return null;

      return {
        mediaAssetId: null,
        url,
      };
    }),
  );

  await prisma.$transaction(async (tx) => {
    await tx.activityImage.deleteMany({ where: { activityId } });
    let sortOrder = 0;
    for (const row of galleryRows) {
      if (!row?.url) continue;
      await tx.activityImage.create({
        data: {
          activityId,
          mediaAssetId: row.mediaAssetId,
          url: row.url,
          sortOrder: sortOrder++,
        },
      });
    }
  });
}
