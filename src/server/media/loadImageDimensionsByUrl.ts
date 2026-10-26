import prisma from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

export type StoredImageDimensions = { width: number; height: number };

type DimensionsDb = { mediaAsset: Pick<PrismaClient["mediaAsset"], "findMany"> };

/**
 * Batch-resolve stored image dimensions for already-resolved cover URLs.
 *
 * Every media pipeline persists `MediaAsset.storageKey === publicUrl`
 * (uploads, wizard, business cabinet, from-url, 24afisha/family.by import), so
 * one lookup on the unique `storageKey` index covers events whose Activity
 * only keeps `coverImageUrl` (imports) as well as `coverImageId` ones.
 * Unknown URLs are simply absent from the map — the card then falls back to
 * the "unknown dimensions" ratio.
 */
export async function loadImageDimensionsByUrl(
  urls: ReadonlyArray<string | null | undefined>,
  db: DimensionsDb = prisma,
): Promise<Map<string, StoredImageDimensions>> {
  const unique = [...new Set(urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url)))];
  const out = new Map<string, StoredImageDimensions>();
  if (unique.length === 0) return out;

  const rows = await db.mediaAsset.findMany({
    where: {
      storageKey: { in: unique },
      deletedAt: null,
      width: { not: null },
      height: { not: null },
    },
    select: { storageKey: true, publicUrl: true, width: true, height: true },
  });

  for (const row of rows) {
    if (!row.width || !row.height || row.width <= 0 || row.height <= 0) continue;
    const dims = { width: row.width, height: row.height };
    out.set(row.storageKey, dims);
    if (row.publicUrl) out.set(row.publicUrl, dims);
  }
  return out;
}

/** Attach `imageWidth`/`imageHeight` to listing DTOs by their resolved image URL. */
export async function withImageDimensions<T>(
  items: T[],
  getUrl: (item: T) => string | null | undefined,
  db?: DimensionsDb,
): Promise<Array<T & { imageWidth: number | null; imageHeight: number | null }>> {
  const dims = await loadImageDimensionsByUrl(items.map(getUrl), db);
  return items.map((item) => {
    const url = getUrl(item)?.trim();
    const found = url ? dims.get(url) : undefined;
    return { ...item, imageWidth: found?.width ?? null, imageHeight: found?.height ?? null };
  });
}
