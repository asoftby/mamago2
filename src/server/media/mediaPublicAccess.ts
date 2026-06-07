import "server-only";

import { existsSync } from "fs";
import { posix } from "path";
import type { MediaAsset } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/safeUser";
import {
  BusinessVerificationStatus,
  ContentStatus,
  MediaAssetStatus,
  MediaEntityType,
  OfferStatus,
  RouteStatus,
  RouteVisibility,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { ensureMediaAssetForStoredFileUrl } from "@/lib/media/ensureMediaAssetForStoredFileUrl";
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import type { MediaAccessDenyPayload } from "@/server/media/mediaAccessDenyLog";
import {
  buildMediaFilePublicUrl,
  extractMediaRelativePathFromUrl,
  resolveLegacyPublicUploadPath,
  resolveMediaStorageAbsolutePath,
} from "@/server/media/media-storage";

const LIVE_CONTENT: ContentStatus[] = [
  ContentStatus.PUBLISHED,
  ContentStatus.PENDING_UPDATE,
];

function normalizeRelativeStoragePath(raw: string): string {
  return posix
    .normalize(raw.replace(/\\/g, "/"))
    .replace(/^\/+/, "");
}

function storageKeysMatchRequest(
  storageKey: string | null | undefined,
  publicUrl: string | null | undefined,
  requestRel: string,
): boolean {
  const expected = buildMediaFilePublicUrl(requestRel);
  if (storageKey === expected || publicUrl === expected) {
    return true;
  }
  const fromStorage = extractMediaRelativePathFromUrl(storageKey ?? "");
  const fromPublic = extractMediaRelativePathFromUrl(publicUrl ?? "");
  if (fromStorage === requestRel || fromPublic === requestRel) {
    return true;
  }
  if (
    storageKey?.endsWith(`/${requestRel}`) ||
    publicUrl?.endsWith(`/${requestRel}`)
  ) {
    return true;
  }
  return false;
}

/**
 * Файл уже лежит в storage и фигурирует в PlaceImage, но в БД нет MediaAsset
 * (старый Instagram / пропуск registerUploadedMedia). Безопасно: только при точном
 * совпадении пути из URL PlaceImage с запрошенным relative path и файле на диске.
 */
export async function ensureMediaAssetForExistingPlaceImageFile(
  pathSegments: string[],
): Promise<MediaAsset | null> {
  const requestRel = normalizeRelativeStoragePath(pathSegments.join("/"));
  if (!requestRel || requestRel === "." || requestRel.startsWith("../")) {
    return null;
  }
  const abs = resolveMediaStorageAbsolutePath(requestRel);
  if (!abs || !existsSync(abs)) {
    return null;
  }

  const existing = await findMediaAssetByStorageRelativePath(pathSegments);
  if (existing) {
    return existing;
  }

  const publicUrl = buildMediaFilePublicUrl(requestRel);
  const candidates = await prisma.placeImage.findMany({
    where: {
      place: { archivedAt: null },
      OR: [{ url: publicUrl }, { url: { endsWith: requestRel } }],
    },
    include: {
      place: { select: { id: true, status: true, createdByUserId: true, logoImageId: true } },
    },
    take: 25,
  });

  const hit = candidates.find((row) => {
    const u = row.url.trim();
    const fp = extractMediaRelativePathFromUrl(u);
    return u === publicUrl || fp === requestRel;
  });

  if (!hit) {
    return null;
  }

  const owner = await prisma.user.findUnique({
    where: { id: hit.place.createdByUserId },
    select: { role: true },
  });

  const media = await ensureMediaAssetForStoredFileUrl({
    publicUrl: hit.url.trim(),
    uploadedById: hit.place.createdByUserId,
    userRole: owner?.role ?? "BUSINESS_OWNER",
    originalName: hit.kind === "LOGO" ? "place-logo.webp" : "place-gallery.webp",
  });

  if (!media) {
    return null;
  }

  const usage = await prisma.mediaUsage.findFirst({
    where: {
      mediaId: media.id,
      entityType: MediaEntityType.PLACE,
      entityId: hit.placeId,
    },
  });
  if (!usage) {
    await attachMediaToEntity({
      mediaId: media.id,
      entityType: MediaEntityType.PLACE,
      entityId: hit.placeId,
      field: hit.kind === "LOGO" ? "logo" : "gallery",
    });
  }

  if (hit.kind === "LOGO" && hit.place.logoImageId !== hit.id) {
    await prisma.place.update({
      where: { id: hit.placeId },
      data: { logoImageId: hit.id },
    });
  }

  return media;
}

/**
 * Диагностика для dev-only deny-логов GET /api/media/file/* (без секретов).
 */
export async function buildMediaFileAccessDenyPayload(input: {
  pathSegments: string[];
  storageAbsolutePath: string | null;
  fileExists: boolean;
  media: MediaAsset | null;
  user: AuthActor | null;
  denyReason: string;
}): Promise<MediaAccessDenyPayload> {
  const {
    pathSegments,
    storageAbsolutePath,
    fileExists,
    media,
    user,
    denyReason,
  } = input;

  const requestedPath = pathSegments.join("/");
  const requestedFilename = pathSegments[pathSegments.length - 1] ?? "";

  const requestRel = normalizeRelativeStoragePath(pathSegments.join("/"));
  const publicUrlForRequest = buildMediaFilePublicUrl(requestRel);

  let placeFound = false;
  let placeId: string | null = null;
  let placeStatus: string | null = null;
  let legacyUrlMatched = false;
  let mediaUsageMatched = false;
  let logoImageIdMatched = false;
  let coverImageIdMatched = false;

  if (media && storageAbsolutePath) {
    legacyUrlMatched = [media.publicUrl, media.storageKey].some((u) => {
      const leg = resolveLegacyPublicUploadPath(u);
      return leg === storageAbsolutePath;
    });
  }

  let businessAccess: boolean | null = null;
  if (user && media) {
    businessAccess = await canUserAccessPlaceLinkedMedia(user, media);
  }

  function applyPlaceImageSelect(pi: {
    id: string;
    kind: string;
    place: { id: string; status: ContentStatus; logoImageId: string | null };
  }): void {
    placeFound = true;
    placeId = pi.place.id;
    placeStatus = pi.place.status;
    if (pi.kind === "LOGO") {
      logoImageIdMatched = pi.place.logoImageId === pi.id;
    }
  }

  if (media) {
    const usageCount = await prisma.mediaUsage.count({
      where: { mediaId: media.id },
    });
    mediaUsageMatched = usageCount > 0;

    const urls = Array.from(
      new Set(
        [media.publicUrl, media.storageKey].filter(
          (u): u is string => typeof u === "string" && u.trim().length > 0,
        ),
      ),
    );

    const placeImageByUrl = await prisma.placeImage.findFirst({
      where: { url: { in: urls } },
      select: {
        id: true,
        kind: true,
        place: { select: { id: true, status: true, logoImageId: true } },
      },
    });
    if (placeImageByUrl) {
      applyPlaceImageSelect(placeImageByUrl);
    }

    if (!placeFound && urls.length > 0) {
      for (const u of urls) {
        const fp = extractMediaRelativePathFromUrl(u);
        if (!fp || fp.length < 8) continue;
        const rows = await prisma.placeImage.findMany({
          where: { url: { endsWith: fp } },
          select: {
            id: true,
            kind: true,
            url: true,
            place: { select: { id: true, status: true, logoImageId: true } },
          },
          take: 10,
        });
        const hit = rows.find(
          (r) => extractMediaRelativePathFromUrl(r.url) === fp,
        );
        if (hit) {
          applyPlaceImageSelect(hit);
          break;
        }
      }
    }

    if (!placeFound) {
      const placeUsage = await prisma.mediaUsage.findFirst({
        where: { mediaId: media.id, entityType: MediaEntityType.PLACE },
        select: { entityId: true },
      });
      if (placeUsage) {
        const p = await prisma.place.findUnique({
          where: { id: placeUsage.entityId },
          select: { id: true, status: true, logoImageId: true },
        });
        if (p) {
          placeFound = true;
          placeId = p.id;
          placeStatus = p.status;
          const logoImg = await prisma.placeImage.findFirst({
            where: { placeId: p.id, kind: "LOGO" },
            select: { id: true },
          });
          if (logoImg) {
            logoImageIdMatched = p.logoImageId === logoImg.id;
          }
        }
      }
    }

    const articleHit = await prisma.article.findFirst({
      where: {
        OR: [{ coverImageId: media.id }, { seoImageId: media.id }],
        status: { in: LIVE_CONTENT },
      },
      select: { id: true },
    });
    const activityHit = await prisma.activity.findFirst({
      where: {
        coverImageId: media.id,
        status: { in: LIVE_CONTENT },
      },
      select: { id: true },
    });
    coverImageIdMatched = !!(articleHit || activityHit);
  } else if (
    requestRel &&
    requestRel !== "." &&
    !requestRel.startsWith("../")
  ) {
    const candidates = await prisma.placeImage.findMany({
      where: {
        place: { archivedAt: null },
        OR: [{ url: publicUrlForRequest }, { url: { endsWith: requestRel } }],
      },
      select: {
        id: true,
        kind: true,
        url: true,
        place: { select: { id: true, status: true, logoImageId: true } },
      },
      take: 25,
    });
    const hit = candidates.find((row) => {
      const u = row.url.trim();
      const fp = extractMediaRelativePathFromUrl(u);
      return u === publicUrlForRequest || fp === requestRel;
    });
    if (hit) {
      applyPlaceImageSelect(hit);
    }
  }

  return {
    requestedPath,
    requestedFilename,
    fileExists,
    storageAbsolutePath,
    mediaFound: media !== null,
    mediaId: media?.id ?? null,
    mediaStatus: media?.status ?? null,
    mediaDeleted: !!media?.deletedAt,
    mediaHasWizardSession: !!media?.wizardSessionId,
    placeFound,
    placeId,
    placeStatus,
    legacyUrlMatched,
    mediaUsageMatched,
    logoImageIdMatched,
    coverImageIdMatched,
    businessAccess,
    denyReason,
  };
}

export async function findMediaAssetByStorageRelativePath(
  pathSegments: string[],
): Promise<MediaAsset | null> {
  const requestRel = normalizeRelativeStoragePath(pathSegments.join("/"));
  if (!requestRel || requestRel === "." || requestRel.startsWith("../")) {
    return null;
  }

  const expectedFull = buildMediaFilePublicUrl(requestRel);

  const exact = await prisma.mediaAsset.findFirst({
    where: {
      OR: [{ storageKey: expectedFull }, { publicUrl: expectedFull }],
    },
  });
  if (exact) {
    return exact;
  }

  const candidates = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        { storageKey: { endsWith: requestRel } },
        { publicUrl: { endsWith: requestRel } },
      ],
    },
    take: 40,
  });

  return (
    candidates.find((m) =>
      storageKeysMatchRequest(m.storageKey, m.publicUrl, requestRel),
    ) ?? null
  );
}

async function userSharesBusinessCabinetWithUploader(
  viewerId: string,
  uploaderId: string | null,
): Promise<boolean> {
  if (!uploaderId || viewerId === uploaderId) {
    return true;
  }

  const viewerBiz = new Set<string>();
  const viewerMemberships = await prisma.businessMember.findMany({
    where: { userId: viewerId, isActive: true },
    select: { businessId: true },
  });
  viewerMemberships.forEach((m) => viewerBiz.add(m.businessId));
  const viewerOwned = await prisma.business.findMany({
    where: { ownerUserId: viewerId },
    select: { id: true },
  });
  viewerOwned.forEach((b) => viewerBiz.add(b.id));

  const uploaderBiz = new Set<string>();
  const uploaderMemberships = await prisma.businessMember.findMany({
    where: { userId: uploaderId, isActive: true },
    select: { businessId: true },
  });
  uploaderMemberships.forEach((m) => uploaderBiz.add(m.businessId));
  const uploaderOwned = await prisma.business.findMany({
    where: { ownerUserId: uploaderId },
    select: { id: true },
  });
  uploaderOwned.forEach((b) => uploaderBiz.add(b.id));

  for (const id of viewerBiz) {
    if (uploaderBiz.has(id)) {
      return true;
    }
  }
  return false;
}

async function hasPublishedPublicLinkage(media: MediaAsset): Promise<boolean> {
  const mediaId = media.id;

  const articleLinked = await prisma.article.findFirst({
    where: {
      OR: [{ coverImageId: mediaId }, { seoImageId: mediaId }],
      status: { in: LIVE_CONTENT },
    },
    select: { id: true },
  });
  if (articleLinked) {
    return true;
  }

  // В части окружений / данных logoImageId может указывать на MediaAsset.id
  const placeLogoByMediaAssetId = await prisma.place.findFirst({
    where: {
      logoImageId: mediaId,
      status: { in: LIVE_CONTENT },
    },
    select: { id: true },
  });
  if (placeLogoByMediaAssetId) {
    return true;
  }

  const urls = [media.publicUrl, media.storageKey].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const uniqueUrls = Array.from(new Set(urls));
  const pathFingerprints = new Set<string>();
  for (const u of uniqueUrls) {
    const fp = extractMediaRelativePathFromUrl(u);
    if (fp) {
      pathFingerprints.add(fp);
    }
  }

  let linkedPlaceImage: {
    id: string;
    kind: string;
    url?: string;
    place: { logoImageId: string | null };
  } | null = null;

  if (uniqueUrls.length > 0) {
    linkedPlaceImage = await prisma.placeImage.findFirst({
      where: {
        url: { in: uniqueUrls },
        place: { status: { in: LIVE_CONTENT } },
      },
      select: { id: true, kind: true, place: { select: { logoImageId: true } } },
    });
  }

  if (!linkedPlaceImage && pathFingerprints.size > 0) {
    for (const fp of pathFingerprints) {
      if (fp.length < 10) continue;
      const candidate = await prisma.placeImage.findFirst({
        where: {
          place: { status: { in: LIVE_CONTENT } },
          url: { endsWith: fp },
        },
        select: { id: true, kind: true, url: true, place: { select: { logoImageId: true } } },
      });
      if (
        candidate &&
        extractMediaRelativePathFromUrl(candidate.url) === fp
      ) {
        linkedPlaceImage = candidate;
        break;
      }
    }
  }

  if (linkedPlaceImage) {
    // LOGO: публичное фото места; logoImageId в Place ссылается на PlaceImage, не на MediaAsset —
    // строгое совпадение logoImageId ломало выдачу при рассинхроне (temp id, миграции).
    if (linkedPlaceImage.kind === "LOGO") {
      return true;
    }
    if (linkedPlaceImage.kind === "GALLERY") {
      return true;
    }
  }

  const activityCover = await prisma.activity.findFirst({
    where: {
      coverImageId: mediaId,
      status: { in: LIVE_CONTENT },
    },
    select: { id: true },
  });
  if (activityCover) {
    return true;
  }

  const usages = await prisma.mediaUsage.findMany({
    where: { mediaId },
    select: { entityType: true, entityId: true },
  });
  if (usages.length === 0) {
    return false;
  }

  const byType = new Map<MediaEntityType, string[]>();
  for (const u of usages) {
    const list = byType.get(u.entityType) ?? [];
    list.push(u.entityId);
    byType.set(u.entityType, list);
  }

  const placeIds = byType.get(MediaEntityType.PLACE) ?? [];
  if (placeIds.length > 0) {
    const n = await prisma.place.count({
      where: {
        id: { in: placeIds },
        status: { in: LIVE_CONTENT },
      },
    });
    if (n > 0) {
      return true;
    }
  }

  const eventIds = byType.get(MediaEntityType.EVENT) ?? [];
  if (eventIds.length > 0) {
    const n = await prisma.activity.count({
      where: {
        id: { in: eventIds },
        status: { in: LIVE_CONTENT },
      },
    });
    if (n > 0) {
      return true;
    }
  }

  const offerIds = byType.get(MediaEntityType.OFFER) ?? [];
  if (offerIds.length > 0) {
    const n = await prisma.offer.count({
      where: {
        id: { in: offerIds },
        status: OfferStatus.PUBLISHED,
      },
    });
    if (n > 0) {
      return true;
    }
  }

  const routeIds = byType.get(MediaEntityType.ROUTE) ?? [];
  if (routeIds.length > 0) {
    const n = await prisma.route.count({
      where: {
        id: { in: routeIds },
        status: RouteStatus.PUBLISHED,
        visibility: RouteVisibility.PUBLIC,
      },
    });
    if (n > 0) {
      return true;
    }
  }

  const articleIds = byType.get(MediaEntityType.ARTICLE) ?? [];
  if (articleIds.length > 0) {
    const n = await prisma.article.count({
      where: {
        id: { in: articleIds },
        status: { in: LIVE_CONTENT },
      },
    });
    if (n > 0) {
      return true;
    }
  }

  const businessIds = byType.get(MediaEntityType.BUSINESS) ?? [];
  if (businessIds.length > 0) {
    const n = await prisma.business.count({
      where: {
        id: { in: businessIds },
        operationalStatus: "ACTIVE",
        isVerified: true,
        verificationStatus: BusinessVerificationStatus.APPROVED,
      },
    });
    if (n > 0) {
      return true;
    }
  }

  return false;
}

function isMediaAssetSanityBlocked(media: MediaAsset): boolean {
  if (media.deletedAt) {
    return true;
  }
  if (
    media.status === MediaAssetStatus.TEMP ||
    media.status === MediaAssetStatus.DELETED ||
    media.status === MediaAssetStatus.BLOCKED
  ) {
    return true;
  }
  return false;
}

/**
 * Медиа привязано к Place, которым пользователь может управлять (черновик / модерация).
 * Проверка точных URL и fingerprint пути, без «любого endsWith» в обход связи.
 */
export async function canUserAccessPlaceLinkedMedia(
  user: AuthActor,
  media: MediaAsset,
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }

  const usagePlaceIds = await prisma.mediaUsage.findMany({
    where: { mediaId: media.id, entityType: MediaEntityType.PLACE },
    select: { entityId: true },
    take: 40,
  });
  for (const row of usagePlaceIds) {
    const place = await prisma.place.findUnique({
      where: { id: row.entityId },
      select: { createdByUserId: true, ownerBusinessId: true },
    });
    if (place && (await canManagePlaceAsync(user, place))) {
      return true;
    }
  }

  const uniqueUrls = Array.from(
    new Set(
      [media.publicUrl, media.storageKey].filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0,
      ),
    ),
  );

  if (uniqueUrls.length > 0) {
    const placesByExactUrl = await prisma.place.findMany({
      where: {
        images: { some: { url: { in: uniqueUrls } } },
      },
      select: { createdByUserId: true, ownerBusinessId: true },
      take: 40,
    });
    for (const place of placesByExactUrl) {
      if (await canManagePlaceAsync(user, place)) {
        return true;
      }
    }
  }

  const fingerprints = new Set<string>();
  for (const u of uniqueUrls) {
    const fp = extractMediaRelativePathFromUrl(u);
    if (fp && fp.length >= 8) {
      fingerprints.add(fp);
    }
  }

  for (const fp of fingerprints) {
    const rows = await prisma.placeImage.findMany({
      where: { url: { endsWith: fp } },
      select: {
        url: true,
        place: { select: { createdByUserId: true, ownerBusinessId: true } },
      },
      take: 20,
    });
    for (const row of rows) {
      if (extractMediaRelativePathFromUrl(row.url) !== fp) {
        continue;
      }
      if (await canManagePlaceAsync(user, row.place)) {
        return true;
      }
    }
  }

  return false;
}

async function canAuthenticatedUserViewMedia(
  media: MediaAsset,
  user: AuthActor,
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }
  if (media.uploadedById && media.uploadedById === user.id) {
    return true;
  }
  if (
    media.uploadedById &&
    (await userSharesBusinessCabinetWithUploader(user.id, media.uploadedById))
  ) {
    return true;
  }
  return false;
}

/**
 * Whether anonymous clients may load this file (published linkage + safe asset state).
 */
export async function canLoadMediaAnonymously(media: MediaAsset): Promise<boolean> {
  if (isMediaAssetSanityBlocked(media)) {
    return false;
  }
  if (media.status !== MediaAssetStatus.ACTIVE) {
    return false;
  }
  if (!(await hasPublishedPublicLinkage(media))) {
    return false;
  }
  return true;
}

/**
 * Resolve if the response may include file bytes. Use 404 when false to avoid existence leaks.
 */
export async function canServeMediaResponse(
  media: MediaAsset,
  user: AuthActor | null,
): Promise<boolean> {
  if (await canLoadMediaAnonymously(media)) {
    return true;
  }
  if (!user) {
    return false;
  }
  if (await canUserAccessPlaceLinkedMedia(user, media)) {
    if (media.deletedAt) {
      return false;
    }
    if (
      media.status === MediaAssetStatus.DELETED ||
      media.status === MediaAssetStatus.BLOCKED
    ) {
      return user.role === "ADMIN" || user.role === "MODERATOR";
    }
    return true;
  }
  if (isMediaAssetSanityBlocked(media)) {
    if (user.role === "ADMIN" || user.role === "MODERATOR") {
      return true;
    }
    // Черновик (TEMP): владелец загрузки и коллеги по бизнес-кабинету могут превью в UI
    if (media.status === MediaAssetStatus.TEMP) {
      return canAuthenticatedUserViewMedia(media, user);
    }
    return false;
  }
  if (
    media.status === MediaAssetStatus.ARCHIVED ||
    media.status === MediaAssetStatus.ORPHANED
  ) {
    return canAuthenticatedUserViewMedia(media, user);
  }
  if (media.status !== MediaAssetStatus.ACTIVE) {
    return canAuthenticatedUserViewMedia(media, user);
  }
  return canAuthenticatedUserViewMedia(media, user);
}
