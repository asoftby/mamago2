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

function normalizeImportedImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return null;
}

function extractImportedEventMedia(normalizedData: unknown): {
  coverUrl: string | null;
  galleryUrls: string[];
} {
  if (!normalizedData || typeof normalizedData !== "object" || Array.isArray(normalizedData)) {
    return { coverUrl: null, galleryUrls: [] };
  }

  const raw = normalizedData as Record<string, unknown>;
  const mainImageUrl = normalizeImportedImageUrl(raw.mainImageUrl);
  const galleryUrls = Array.isArray(raw.imageUrls)
    ? raw.imageUrls
        .map((item) => normalizeImportedImageUrl(item))
        .filter((item): item is string => Boolean(item))
    : [];

  const fallbackCoverUrl = mainImageUrl ?? galleryUrls[0] ?? null;

  const dedupedGallery = galleryUrls.filter(
    (url, index, arr) => arr.indexOf(url) === index && url !== fallbackCoverUrl,
  );

  return {
    coverUrl: fallbackCoverUrl,
    galleryUrls: dedupedGallery,
  };
}

function extractImportedEventMediaFromRawPayload(rawPayload: unknown): {
  coverUrl: string | null;
  galleryUrls: string[];
} {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { coverUrl: null, galleryUrls: [] };
  }

  const raw = rawPayload as Record<string, unknown>;
  const coverCandidates = [
    raw.mainImageUrl,
    raw.mainImage,
    raw.ogImage,
    raw.coverImage,
    raw.poster,
    raw.posterUrl,
  ];

  const coverUrl =
    coverCandidates.map((value) => normalizeImportedImageUrl(value)).find((value): value is string => Boolean(value)) ??
    null;

  const galleryCandidates = [raw.images, raw.imageUrls, raw.photos, raw.gallery].find((value) => Array.isArray(value));
  const galleryUrls = Array.isArray(galleryCandidates)
    ? galleryCandidates
        .map((value) => normalizeImportedImageUrl(value))
        .filter((value): value is string => Boolean(value))
    : [];

  const fallbackCoverUrl = coverUrl ?? galleryUrls[0] ?? null;
  const dedupedGallery = galleryUrls.filter(
    (url, index, arr) => arr.indexOf(url) === index && url !== fallbackCoverUrl,
  );

  return {
    coverUrl: fallbackCoverUrl,
    galleryUrls: dedupedGallery,
  };
}

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
      coverImageUrl: true,
      images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const linkedImport = await prisma.importedRecord.findFirst({
    where: { publishedActivityId: activityId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, normalizedData: true, rawPayload: true },
  });
  const importedMediaFromRecord = extractImportedEventMedia(linkedImport?.normalizedData);
  const importedMediaFromRaw = extractImportedEventMediaFromRawPayload(linkedImport?.rawPayload);
  const importedMedia = {
    coverUrl:
      importedMediaFromRecord.coverUrl ??
      importedMediaFromRaw.coverUrl ??
      normalizeImportedImageUrl(activity.coverImageUrl),
    galleryUrls:
      importedMediaFromRecord.galleryUrls.length > 0
        ? importedMediaFromRecord.galleryUrls
        : importedMediaFromRaw.galleryUrls.length > 0
          ? importedMediaFromRaw.galleryUrls
          : [...new Set(activity.images.map((item) => normalizeImportedImageUrl(item.url)).filter(Boolean))],
  };

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
    importedMedia,
  });
}
