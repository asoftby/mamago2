import { SeoCanonicalSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";

function absoluteBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by").replace(/\/$/, "");
}

/**
 * Синхронизирует seoCanonicalUrl с публичным URL (slug или id), если не MANUAL.
 */
export async function syncActivityCanonical(activityId: string): Promise<void> {
  const row = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      seoCanonicalSource: true,
      slug: true,
    },
  });
  if (!row || row.seoCanonicalSource === SeoCanonicalSource.MANUAL) return;

  const path =
    (await resolveCanonicalEventPublicPathById(row.id)) ??
    `/minsk/events/${row.slug?.trim() || row.id}`;
  const absolute = `${absoluteBase()}${path}`;
  const hasSlug = !!row.slug?.trim();

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      seoCanonicalUrl: absolute,
      seoCanonicalSource: hasSlug ? SeoCanonicalSource.AUTO : SeoCanonicalSource.FALLBACK,
    },
    select: { id: true },
  });
}

export async function syncPlaceCanonical(placeId: string): Promise<void> {
  const row = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, slug: true, seoCanonicalSource: true },
  });
  if (!row || row.seoCanonicalSource === SeoCanonicalSource.MANUAL) return;

  const seg = row.slug?.trim() || row.id;
  const path = `/places/${seg}`;
  const absolute = `${absoluteBase()}${path}`;
  const hasSlug = !!row.slug?.trim();

  await prisma.place.update({
    where: { id: placeId },
    data: {
      seoCanonicalUrl: absolute,
      seoCanonicalSource: hasSlug ? SeoCanonicalSource.AUTO : SeoCanonicalSource.FALLBACK,
    },
    select: { id: true },
  });
}

export async function syncOfferCanonical(offerId: string): Promise<void> {
  const row = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, slug: true, seoCanonicalSource: true },
  });
  if (!row || row.seoCanonicalSource === SeoCanonicalSource.MANUAL) return;

  const seg = row.slug?.trim() || row.id;
  const path = `/offers/${seg}`;
  const absolute = `${absoluteBase()}${path}`;
  const hasSlug = !!row.slug?.trim();

  await prisma.offer.update({
    where: { id: offerId },
    data: {
      seoCanonicalUrl: absolute,
      seoCanonicalSource: hasSlug ? SeoCanonicalSource.AUTO : SeoCanonicalSource.FALLBACK,
    },
    select: { id: true },
  });
}

export async function syncRouteCanonical(routeId: string): Promise<void> {
  const row = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, slug: true, seoCanonicalSource: true },
  });
  if (!row || row.seoCanonicalSource === SeoCanonicalSource.MANUAL) return;

  const path = `/routes/${row.slug}`;
  const absolute = `${absoluteBase()}${path}`;

  await prisma.route.update({
    where: { id: routeId },
    data: {
      seoCanonicalUrl: absolute,
      seoCanonicalSource: SeoCanonicalSource.AUTO,
    },
    select: { id: true },
  });
}

export async function syncArticleCanonical(articleId: string): Promise<void> {
  try {
    const row = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, slug: true, seoCanonicalSource: true },
    });
    if (!row || row.seoCanonicalSource === SeoCanonicalSource.MANUAL) return;

    const seg = row.slug?.trim() || row.id;
    const path = `/blog/${seg}`;
    const absolute = `${absoluteBase()}${path}`;
    const hasSlug = !!row.slug?.trim();

    await prisma.article.update({
      where: { id: articleId },
      data: {
        seoCanonicalUrl: absolute,
        seoCanonicalSource: hasSlug ? SeoCanonicalSource.AUTO : SeoCanonicalSource.FALLBACK,
      },
      select: { id: true },
    });
  } catch (e) {
    console.error("[syncArticleCanonical]", articleId, e);
  }
}
