import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  findMediaAssetByReference,
  normalizeMediaDisplayUrl,
} from "@/lib/media/resolveMediaAssetReference";
import type { MediaAssetReferencePrisma } from "@/lib/media/resolveMediaAssetReference";

export type EventGalleryPrisma = MediaAssetReferencePrisma & {
  activityImage: Pick<
    PrismaClient["activityImage"],
    "create" | "deleteMany" | "findMany"
  >;
};

/**
 * True if ordered gallery URLs already match the given MediaAsset ids (same cover exclusion as replace).
 */
export async function activityGalleryMatchesIncomingMediaIds(
  input:
    | {
        prisma: EventGalleryPrisma;
        activityId: string;
        rawMediaIds: unknown[];
        coverMediaId?: string | null;
      }
    | string,
  legacyRawMediaIds?: unknown[],
  legacyCoverMediaId?: string | null,
): Promise<boolean> {
  const db = typeof input === "string" ? prisma : input.prisma;
  const activityId = typeof input === "string" ? input : input.activityId;
  const rawMediaIds = typeof input === "string" ? legacyRawMediaIds ?? [] : input.rawMediaIds;
  const coverMediaId = typeof input === "string" ? legacyCoverMediaId : input.coverMediaId;
  const incoming = Array.isArray(rawMediaIds)
    ? rawMediaIds.filter((id): id is string => typeof id === "string")
    : [];
  const unique = [...new Set(incoming)].filter((id) => id !== coverMediaId);

  const existingRows = await db.activityImage.findMany({
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
      const asset = await findMediaAssetByReference(ref, db);
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
  input:
    | {
        prisma: EventGalleryPrisma;
        activityId: string;
        rawMediaIds: string[];
        coverMediaId?: string | null;
      }
    | string,
  legacyRawMediaIds?: string[],
  legacyCoverMediaId?: string | null,
): Promise<void> {
  const db = typeof input === "string" ? prisma : input.prisma;
  const activityId = typeof input === "string" ? input : input.activityId;
  const rawMediaIds = typeof input === "string" ? legacyRawMediaIds ?? [] : input.rawMediaIds;
  const coverMediaId = typeof input === "string" ? legacyCoverMediaId ?? null : input.coverMediaId ?? null;
  const unique = [...new Set(rawMediaIds.filter(Boolean))].filter((id) => id !== coverMediaId);
  const galleryRows = await Promise.all(
    unique.map(async (ref) => {
      const asset = await findMediaAssetByReference(ref, db);
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

  await db.activityImage.deleteMany({ where: { activityId } });
  let sortOrder = 0;
  for (const row of galleryRows) {
    if (!row?.url) continue;
    await db.activityImage.create({
      data: {
        activityId,
        mediaAssetId: row.mediaAssetId,
        url: row.url,
        sortOrder: sortOrder++,
      },
    });
  }
}
