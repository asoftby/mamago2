import prisma from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus, MediaSourceType } from "@prisma/client";
import { MEDIA_PICKER_MAX_LIMIT, MEDIA_PICKER_PAGE_SIZE } from "./mediaPickerConstants";

export type MediaPickerAsset = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
  sourceType: MediaSourceType;
  isUsed: boolean;
};

export type MediaPickerPage = {
  items: MediaPickerAsset[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Cursor page of a single owner's media library, newest first.
 * Stable order (createdAt desc, id desc) — same take-limit+1 pattern as
 * getNotificationsPage, so appended pages never duplicate or skip rows.
 */
export async function queryMediaPickerPage(params: {
  uploadedById: string;
  cursor?: string | null;
  limit?: number;
}): Promise<MediaPickerPage> {
  const limit = Math.min(Math.max(params.limit ?? MEDIA_PICKER_PAGE_SIZE, 1), MEDIA_PICKER_MAX_LIMIT);

  const rows = await prisma.mediaAsset.findMany({
    where: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      publicUrl: { not: null },
      uploadedById: params.uploadedById,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      publicUrl: true,
      alt: true,
      title: true,
      sourceType: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  // One batch query for the whole page. MediaUsage is the canonical registry
  // populated by Article/Event/Place/Offer/Route save flows.
  const usedRows = items.length
    ? await prisma.mediaUsage.findMany({
        where: { mediaId: { in: items.map((item) => item.id) } },
        distinct: ["mediaId"],
        select: { mediaId: true },
      })
    : [];
  const usedIds = new Set(usedRows.map((row) => row.mediaId));

  return {
    items: items.map((item) => ({ ...item, isUsed: usedIds.has(item.id) })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}
