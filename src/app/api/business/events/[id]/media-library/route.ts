import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, MediaAssetKind, MediaAssetStatus, MediaEntityType } from "@prisma/client";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import { getEntityMediaUsages } from "@/server/services/media/media-usage.service";

export type EventMediaLibraryItem = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
  sourceType: string;
  usageField: string | null;
  fromEntity: boolean;
  showImportBadge: boolean;
};

/**
 * GET /api/business/events/[id]/media-library
 * Медиа, связанные с событием: usages, обложка, галерея (по совпадению publicUrl).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: activityId } = await params;

  if (!(await canManageActivityById(user, activityId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, type: ActivityType.EVENT },
    select: {
      coverImageId: true,
      images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const linkedImport = await prisma.importedRecord.findFirst({
    where: { publishedActivityId: activityId },
    select: { id: true },
  });

  const usages = await getEntityMediaUsages(MediaEntityType.EVENT, activityId);

  const itemsMap = new Map<string, EventMediaLibraryItem>();

  const upsert = (
    media: {
      id: string;
      publicUrl: string | null;
      alt: string | null;
      title: string | null;
      sourceType: string;
    },
    usageField: string | null,
    fromEntity: boolean,
  ) => {
    if (!media.publicUrl) return;
    const showImportBadge =
      Boolean(linkedImport) &&
      fromEntity &&
      (media.sourceType === "MIGRATED" || media.sourceType === "SYSTEM_GENERATED");
    const prev = itemsMap.get(media.id);
    if (prev) {
      if (!prev.usageField && usageField) prev.usageField = usageField;
      prev.showImportBadge = prev.showImportBadge || showImportBadge;
      return;
    }
    itemsMap.set(media.id, {
      id: media.id,
      publicUrl: media.publicUrl,
      alt: media.alt,
      title: media.title,
      sourceType: media.sourceType,
      usageField,
      fromEntity,
      showImportBadge,
    });
  };

  for (const u of usages) {
    upsert(u.media, u.field, true);
  }

  if (activity.coverImageId) {
    const m = await prisma.mediaAsset.findFirst({
      where: {
        id: activity.coverImageId,
        kind: MediaAssetKind.IMAGE,
        status: MediaAssetStatus.ACTIVE,
      },
      select: { id: true, publicUrl: true, alt: true, title: true, sourceType: true },
    });
    if (m) upsert(m, "cover", true);
  }

  const urls = [...new Set(activity.images.map((i) => i.url).filter(Boolean))];
  if (urls.length > 0) {
    const fromGallery = await prisma.mediaAsset.findMany({
      where: {
        publicUrl: { in: urls },
        kind: MediaAssetKind.IMAGE,
        status: MediaAssetStatus.ACTIVE,
      },
      select: { id: true, publicUrl: true, alt: true, title: true, sourceType: true },
    });
    for (const m of fromGallery) {
      upsert(m, "gallery", true);
    }
  }

  const items = [...itemsMap.values()].filter((i) => i.publicUrl);

  return NextResponse.json({
    items,
    linkedImport: Boolean(linkedImport),
  });
}
