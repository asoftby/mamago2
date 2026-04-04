/**
 * Гарантии slug для опубликованных публичных сущностей (public URL = только slug).
 */
import { ContentStatus, OfferStatus, RouteStatus, RouteVisibility } from "@prisma/client";
import prisma from "@/lib/prisma";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { assignArticleSlugIfMissing } from "@/lib/slug/articleSlugService";
import { assignOfferSlugIfMissing } from "@/lib/slug/offerSlugService";
import { assignPlaceSlugIfMissing } from "@/lib/slug/placeSlugService";
import {
  syncActivityCanonical,
  syncArticleCanonical,
  syncOfferCanonical,
  syncPlaceCanonical,
} from "@/lib/seo/syncEntityCanonical";

export class PublishedEntityMissingSlugError extends Error {
  constructor(entity: string, id: string) {
    super(`[${entity} ${id}] опубликован без slug — нарушение политики public URL`);
    this.name = "PublishedEntityMissingSlugError";
  }
}

/** После смены статуса на PUBLISHED: slug + canonical (если не manual). */
export async function ensurePublishedActivityHasSlug(activityId: string): Promise<void> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true, title: true, slug: true, type: true },
  });
  if (!a || a.status !== ContentStatus.PUBLISHED) return;
  await assignActivitySlugIfMissing(activityId, a.title.trim() || "event");
  await syncActivityCanonical(activityId);
  const again = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { slug: true },
  });
  if (!again?.slug?.trim()) {
    throw new PublishedEntityMissingSlugError("Activity", activityId);
  }
}

export async function ensurePublishedPlaceHasSlug(placeId: string): Promise<void> {
  const p = await prisma.place.findUnique({
    where: { id: placeId },
    select: { status: true, title: true, slug: true },
  });
  if (!p || p.status !== ContentStatus.PUBLISHED) return;
  await assignPlaceSlugIfMissing(placeId, p.title.trim() || "place");
  await syncPlaceCanonical(placeId);
  const again = await prisma.place.findUnique({ where: { id: placeId }, select: { slug: true } });
  if (!again?.slug?.trim()) {
    throw new PublishedEntityMissingSlugError("Place", placeId);
  }
}

export async function ensurePublishedOfferHasSlug(offerId: string): Promise<void> {
  const o = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { status: true, title: true, slug: true },
  });
  if (!o || o.status !== OfferStatus.PUBLISHED) return;
  await assignOfferSlugIfMissing(offerId, o.title.trim() || "offer");
  await syncOfferCanonical(offerId);
  const again = await prisma.offer.findUnique({ where: { id: offerId }, select: { slug: true } });
  if (!again?.slug?.trim()) {
    throw new PublishedEntityMissingSlugError("Offer", offerId);
  }
}

export async function ensurePublishedArticleHasSlug(articleId: string): Promise<void> {
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    select: { status: true, title: true, slug: true },
  });
  if (!a || a.status !== ContentStatus.PUBLISHED) return;
  await assignArticleSlugIfMissing(articleId, a.title.trim() || "article");
  await syncArticleCanonical(articleId);
  const again = await prisma.article.findUnique({ where: { id: articleId }, select: { slug: true } });
  if (!again?.slug?.trim()) {
    throw new PublishedEntityMissingSlugError("Article", articleId);
  }
}

/** Route: slug обязателен в схеме; при публичном маршруте проверяем наличие. */
export async function ensurePublishedPublicRouteHasSlug(routeId: string): Promise<void> {
  const r = await prisma.route.findUnique({
    where: { id: routeId },
    select: { slug: true, status: true, visibility: true },
  });
  if (!r) return;
  const pub = r.status === RouteStatus.PUBLISHED && r.visibility === RouteVisibility.PUBLIC;
  if (!pub) return;
  if (!r.slug?.trim()) {
    throw new PublishedEntityMissingSlugError("Route", routeId);
  }
}
