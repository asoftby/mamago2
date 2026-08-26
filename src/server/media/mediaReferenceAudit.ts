import { access } from "fs/promises";
import type { MediaEntityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { extractArticleMediaUsage, parseArticleContentJson } from "@/lib/publications/articleMvp";
import { extractMediaRelativePathFromUrl, resolveStoredMediaPath } from "@/server/media/media-storage";
import { collectPlaceMediaReferenceInputs } from "@/lib/media/placeMediaReferences";

export type AuditedReference = {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  entityTitle: string;
  entitySlug: string | null;
  field: string;
  order: number;
};

export type UnresolvedReference = {
  entityType: MediaEntityType;
  entityId: string;
  entityTitle: string;
  field: string;
  reference: string;
  reason: string;
};

type AssetRow = Awaited<ReturnType<typeof loadAssets>>[number];

async function loadAssets() {
  return prisma.mediaAsset.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
}

function normalizedKeys(value: string | null | undefined): string[] {
  const ref = value?.trim();
  if (!ref) return [];
  const keys = new Set([ref]);
  const rel = extractMediaRelativePathFromUrl(ref);
  if (rel) {
    keys.add(rel);
    keys.add(`/uploads/${rel}`);
    keys.add(`/api/media/file/${rel}`);
  }
  const clean = ref.split(/[?#]/)[0] ?? ref;
  const base = clean.split("/").pop();
  if (base) keys.add(base);
  return [...keys];
}

export function buildMediaAssetReferenceResolver(assets: Array<Pick<AssetRow, "id" | "publicUrl" | "storageKey" | "filename">>) {
  const byKey = new Map<string, Set<string>>();
  for (const asset of assets) {
    for (const value of [asset.id, asset.publicUrl, asset.storageKey, asset.filename]) {
      for (const key of normalizedKeys(value)) {
        const ids = byKey.get(key) ?? new Set<string>();
        ids.add(asset.id);
        byKey.set(key, ids);
      }
    }
  }
  return (value: string | null | undefined): { mediaId: string | null; reason?: string } => {
    const matches = new Set<string>();
    for (const key of normalizedKeys(value)) {
      for (const id of byKey.get(key) ?? []) matches.add(id);
    }
    if (matches.size === 1) return { mediaId: [...matches][0] };
    if (matches.size > 1) return { mediaId: null, reason: "ambiguous-reference" };
    return { mediaId: null, reason: "media-asset-not-found" };
  };
}

export async function auditAllMediaReferences() {
  const assets = await loadAssets();
  const resolve = buildMediaAssetReferenceResolver(assets);
  const references: AuditedReference[] = [];
  const unresolved: UnresolvedReference[] = [];
  const brandingIds = new Set<string>();
  const seen = new Set<string>();

  const add = (input: Omit<AuditedReference, "mediaId"> & { ref: string | null | undefined }) => {
    if (!input.ref?.trim()) return;
    const result = resolve(input.ref);
    if (!result.mediaId) {
      unresolved.push({
        entityType: input.entityType,
        entityId: input.entityId,
        entityTitle: input.entityTitle,
        field: input.field,
        reference: input.ref,
        reason: result.reason ?? "unresolved",
      });
      return;
    }
    const key = `${result.mediaId}:${input.entityType}:${input.entityId}:${input.field}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ ...input, mediaId: result.mediaId });
  };

  const [articles, activities, places, offers, routes, users, branding] = await Promise.all([
    prisma.article.findMany({ select: { id: true, title: true, slug: true, coverImageId: true, seoImageId: true, contentJson: true } }),
    prisma.activity.findMany({ select: { id: true, title: true, slug: true, coverImageId: true, coverImageUrl: true, images: { orderBy: { sortOrder: "asc" }, select: { mediaAssetId: true, url: true } } } }),
    prisma.place.findMany({ select: { id: true, title: true, slug: true, logoImageId: true, images: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, kind: true, url: true } } } }),
    prisma.offer.findMany({ select: { id: true, title: true, slug: true, coverImage: true, galleryImages: true } }),
    prisma.route.findMany({ select: { id: true, title: true, slug: true, coverImageUrl: true, seoOgImage: true, stops: { orderBy: { order: "asc" }, select: { photoUrl: true, images: { orderBy: { sortOrder: "asc" }, select: { mediaAssetId: true, url: true } } } } } }),
    prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, email: true, avatarUrl: true } }),
    prisma.brandingConfig.findMany({ select: { id: true, logoAssetId: true, faviconAssetId: true } }),
  ]);

  for (const article of articles) {
    const content = parseArticleContentJson(article.contentJson);
    const ordered = extractArticleMediaUsage({ coverImageId: article.coverImageId, seoImageId: article.seoImageId, blocks: content.blocks });
    ordered.forEach((entry, order) => entry.usage.forEach((kind) => add({
      ref: entry.mediaId, entityType: "ARTICLE", entityId: article.id, entityTitle: article.title,
      entitySlug: article.slug, field: kind === "image-block" ? "inline" : kind === "gallery-block" ? "gallery" : kind,
      order,
    })));
  }
  for (const activity of activities) {
    add({ ref: activity.coverImageId ?? activity.coverImageUrl, entityType: "EVENT", entityId: activity.id, entityTitle: activity.title, entitySlug: activity.slug, field: "cover", order: 0 });
    activity.images.forEach((image, order) => add({ ref: image.mediaAssetId ?? image.url, entityType: "EVENT", entityId: activity.id, entityTitle: activity.title, entitySlug: activity.slug, field: "gallery", order: order + 1 }));
  }
  for (const place of places) {
    collectPlaceMediaReferenceInputs(place).forEach((ref) => add({ ref: ref.reference, entityType: "PLACE", entityId: place.id, entityTitle: place.title, entitySlug: place.slug, field: ref.field, order: ref.order }));
  }
  for (const offer of offers) {
    add({ ref: offer.coverImage, entityType: "OFFER", entityId: offer.id, entityTitle: offer.title, entitySlug: offer.slug, field: "cover", order: 0 });
    const gallery = Array.isArray(offer.galleryImages) ? offer.galleryImages : [];
    gallery.forEach((value, order) => {
      const ref = typeof value === "string" ? value : value && typeof value === "object" && "url" in value ? String(value.url) : null;
      add({ ref, entityType: "OFFER", entityId: offer.id, entityTitle: offer.title, entitySlug: offer.slug, field: "gallery", order: order + 1 });
    });
  }
  for (const route of routes) {
    add({ ref: route.coverImageUrl, entityType: "ROUTE", entityId: route.id, entityTitle: route.title, entitySlug: route.slug, field: "cover", order: 0 });
    add({ ref: route.seoOgImage, entityType: "ROUTE", entityId: route.id, entityTitle: route.title, entitySlug: route.slug, field: "seo", order: 1 });
    let order = 2;
    for (const stop of route.stops) {
      add({ ref: stop.photoUrl, entityType: "ROUTE", entityId: route.id, entityTitle: route.title, entitySlug: route.slug, field: "stop", order: order++ });
      for (const image of stop.images) add({ ref: image.mediaAssetId ?? image.url, entityType: "ROUTE", entityId: route.id, entityTitle: route.title, entitySlug: route.slug, field: "gallery", order: order++ });
    }
  }
  users.forEach((user) => add({ ref: user.avatarUrl, entityType: "USER", entityId: user.id, entityTitle: user.email, entitySlug: null, field: "avatar", order: 0 }));
  branding.forEach((row) => [row.logoAssetId, row.faviconAssetId].forEach((id) => { if (id) brandingIds.add(id); }));

  const refsByMedia = new Map<string, AuditedReference[]>();
  for (const ref of references) refsByMedia.set(ref.mediaId, [...(refsByMedia.get(ref.mediaId) ?? []), ref]);
  const storageState = new Map<string, "managed" | "external" | "missing">();
  for (const asset of assets) {
    const path = resolveStoredMediaPath(asset.publicUrl ?? asset.storageKey);
    if (!path) storageState.set(asset.id, "external");
    else {
      try { await access(path); storageState.set(asset.id, "managed"); }
      catch { storageState.set(asset.id, "missing"); }
    }
  }

  return { assets, references, refsByMedia, brandingIds, unresolved, storageState };
}

export async function buildMediaUsageRepairDryRun() {
  const audit = await auditAllMediaReferences();
  const existing = await prisma.mediaUsage.findMany({ orderBy: { createdAt: "asc" } });
  const desiredKeys = new Set(audit.references.map((ref) => `${ref.mediaId}:${ref.entityType}:${ref.entityId}:${ref.field}`));
  const existingKeys = new Set<string>();
  const duplicates: string[] = [];
  for (const usage of existing) {
    const key = `${usage.mediaId}:${usage.entityType}:${usage.entityId}:${usage.field}`;
    if (existingKeys.has(key)) duplicates.push(usage.id);
    existingKeys.add(key);
  }
  const create = audit.references.filter((ref) => !existingKeys.has(`${ref.mediaId}:${ref.entityType}:${ref.entityId}:${ref.field}`));
  const stale = existing.filter((usage) => !desiredKeys.has(`${usage.mediaId}:${usage.entityType}:${usage.entityId}:${usage.field}`));
  return { audit, create, stale, duplicates, existingCount: existing.length };
}
