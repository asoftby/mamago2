import { SeoCanonicalSource } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  syncActivityCanonical,
  syncArticleCanonical,
  syncOfferCanonical,
  syncPlaceCanonical,
  syncRouteCanonical,
} from "@/lib/seo/syncEntityCanonical";
import { updateActivitySlug } from "@/lib/slug/activitySlugService";
import { updateArticleSlug } from "@/lib/slug/articleSlugService";
import { updateOfferSlug } from "@/lib/slug/offerSlugService";
import { updatePlaceSlug } from "@/lib/slug/placeSlugService";
import { updateRouteSlug } from "@/lib/slug/routeSlugService";
import type { SeoEntityUpdateInput } from "./types";

export async function applyActivitySeoUpdate(entityId: string, input: SeoEntityUpdateInput): Promise<void> {
  if (typeof input.slug === "string") {
    await updateActivitySlug(entityId, input.slug);
  }
  const trimmedCanon = input.seoCanonicalUrl?.trim() || null;
  const manual = !!trimmedCanon;

  await prisma.activity.update({
    where: { id: entityId },
    data: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoH1: input.seoH1,
      ...(manual
        ? { seoCanonicalUrl: trimmedCanon, seoCanonicalSource: SeoCanonicalSource.MANUAL }
        : { seoCanonicalSource: SeoCanonicalSource.FALLBACK }),
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: input.seoOgImage,
      seoRobots: input.seoRobots,
      seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
    },
  });

  if (!manual) {
    await syncActivityCanonical(entityId);
  }
}

export async function applyPlaceSeoUpdate(entityId: string, input: SeoEntityUpdateInput): Promise<void> {
  if (typeof input.slug === "string") {
    await updatePlaceSlug(entityId, input.slug);
  }
  const trimmedCanon = input.seoCanonicalUrl?.trim() || null;
  const manual = !!trimmedCanon;

  await prisma.place.update({
    where: { id: entityId },
    data: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoH1: input.seoH1,
      ...(manual
        ? { seoCanonicalUrl: trimmedCanon, seoCanonicalSource: SeoCanonicalSource.MANUAL }
        : { seoCanonicalSource: SeoCanonicalSource.FALLBACK }),
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: input.seoOgImage,
      seoRobots: input.seoRobots,
      seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
    },
  });

  if (!manual) {
    await syncPlaceCanonical(entityId);
  }
}

export async function applyOfferSeoUpdate(entityId: string, input: SeoEntityUpdateInput): Promise<void> {
  if (typeof input.slug === "string") {
    await updateOfferSlug(entityId, input.slug);
  }
  const trimmedCanon = input.seoCanonicalUrl?.trim() || null;
  const manual = !!trimmedCanon;

  await prisma.offer.update({
    where: { id: entityId },
    data: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoH1: input.seoH1,
      ...(manual
        ? { seoCanonicalUrl: trimmedCanon, seoCanonicalSource: SeoCanonicalSource.MANUAL }
        : { seoCanonicalSource: SeoCanonicalSource.FALLBACK }),
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: input.seoOgImage,
      seoRobots: input.seoRobots,
      seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
    },
  });

  if (!manual) {
    await syncOfferCanonical(entityId);
  }
}

export async function applyRouteSeoUpdate(entityId: string, input: SeoEntityUpdateInput): Promise<void> {
  if (typeof input.slug === "string") {
    await updateRouteSlug(entityId, input.slug);
  }
  const trimmedCanon = input.seoCanonicalUrl?.trim() || null;
  const manual = !!trimmedCanon;

  await prisma.route.update({
    where: { id: entityId },
    data: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoH1: input.seoH1,
      ...(manual
        ? { seoCanonicalUrl: trimmedCanon, seoCanonicalSource: SeoCanonicalSource.MANUAL }
        : { seoCanonicalSource: SeoCanonicalSource.FALLBACK }),
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: input.seoOgImage,
      seoRobots: input.seoRobots,
      seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
    },
  });

  if (!manual) {
    await syncRouteCanonical(entityId);
  }
}

export async function applyArticleSeoUpdate(entityId: string, input: SeoEntityUpdateInput): Promise<void> {
  if (typeof input.slug === "string") {
    await updateArticleSlug(entityId, input.slug);
  }
  const trimmedCanon = input.seoCanonicalUrl?.trim() || null;
  const manual = !!trimmedCanon;

  await prisma.article.update({
    where: { id: entityId },
    data: {
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoH1: input.seoH1,
      ...(manual
        ? { seoCanonicalUrl: trimmedCanon, seoCanonicalSource: SeoCanonicalSource.MANUAL }
        : { seoCanonicalSource: SeoCanonicalSource.FALLBACK }),
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoOgImage: input.seoOgImage,
      seoRobots: input.seoRobots,
      seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
    },
  });

  if (!manual) {
    await syncArticleCanonical(entityId);
  }
}
