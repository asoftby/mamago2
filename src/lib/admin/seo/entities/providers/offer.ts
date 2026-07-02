import { OfferStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import {
  indexationStatusForPublishedEntity,
  isIndexableForPublishedEntity,
} from "../utils";
import { buildSegmentEntityDiagnostics } from "../buildEntityDiagnostics";
import { applyOfferSeoUpdate } from "@/lib/admin/seo/entities/applyEntitySeoUpdate";
import { buildOfferStructuredData } from "@/lib/seo/schema/buildOfferStructuredData";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import { resolveOfferStructuredDataType } from "@/lib/seo/schema/buildOfferJsonLd";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";

const OFFER_LIST_LIMIT = 300;

export const offerProvider: SeoEntityProvider = {
  entityType: "offer",
  badgeLabel: "Offer",
  section: "birthday",

  async listRows() {
    const offers = await prisma.offer.findMany({
      where: { status: { not: OfferStatus.REJECTED } },
      orderBy: { updatedAt: "desc" },
      take: OFFER_LIST_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        archivedAt: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoCanonicalSource: true,
        seoRobots: true,
      },
    });

    return offers.map((o) => {
      const published = o.status === OfferStatus.PUBLISHED && !o.archivedAt;
      const seg = o.slug?.trim() || o.id;
      const path = `/offers/${seg}`;
      const canonical = o.seoCanonicalUrl?.trim() || path;
      const entityDiagnostics = buildSegmentEntityDiagnostics("offer", {
        entityId: o.id,
        title: o.title,
        slug: o.slug,
        seoCanonicalUrl: o.seoCanonicalUrl,
        seoCanonicalSource: o.seoCanonicalSource,
        seoRobots: o.seoRobots,
        contentStatus: o.status,
      });
      return {
        id: `entity:offer:${o.id}`,
        path,
        section: "birthday",
        type: "offer",
        filtersSnapshot: { entity: "offer", entityId: o.id },
        title: o.seoTitle?.trim() || o.title,
        h1: o.seoH1?.trim() || o.title,
        description: o.seoDescription?.trim() || o.description || "",
        canonical,
        updatedAt: o.updatedAt.toISOString(),
        indexationStatus: indexationStatusForPublishedEntity(
          published,
          o.seoRobots,
        ),
        isIndexable: isIndexableForPublishedEntity(published, o.seoRobots),
        entityDiagnostics,
      };
    });
  },

  async loadEditorModel(entityId) {
    const o = await prisma.offer.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        description: true,
        slug: true,
        status: true,
        archivedAt: true,
        seoTitle: true,
        seoDescription: true,
        seoH1: true,
        seoCanonicalUrl: true,
        seoCanonicalSource: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoOgImage: true,
        seoRobots: true,
        seoJsonLdOverride: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!o) return null;
    const urlDiagnostics = buildSegmentEntityDiagnostics("offer", {
      entityId: o.id,
      title: o.title,
      slug: o.slug,
      seoCanonicalUrl: o.seoCanonicalUrl,
      seoCanonicalSource: o.seoCanonicalSource,
      seoRobots: o.seoRobots,
      contentStatus: o.status,
    });
    return {
      id: o.id,
      title: o.title,
      summary: o.description ?? "",
      slug: o.slug,
      seoTitle: o.seoTitle,
      seoDescription: o.seoDescription,
      seoH1: o.seoH1,
      seoCanonicalUrl: o.seoCanonicalUrl,
      seoCanonicalSource: o.seoCanonicalSource,
      seoOgTitle: o.seoOgTitle,
      seoOgDescription: o.seoOgDescription,
      seoOgImage: o.seoOgImage,
      seoRobots: o.seoRobots,
      seoJsonLdOverride: (o.seoJsonLdOverride as unknown) ?? null,
      urlDiagnostics,
      contentStatus: o.status,
      citySlug: o.place?.city?.slug ?? null,
    };
  },

  async updateSeo(entityId, input) {
    await applyOfferSeoUpdate(entityId, input);
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.offer.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex")
      ? SEO_ROBOTS_INDEX_FOLLOW
      : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.offer.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async setIndexFollow(entityId, index) {
    const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.offer.update({ where: { id: entityId }, data: { seoRobots } });
  },

  async loadRedirects(entityId) {
    const current = await prisma.offer.findUnique({ where: { id: entityId }, select: { slug: true } });
    const history = await prisma.offerSlugHistory.findMany({
      where: { offerId: entityId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, createdAt: true },
    });
    return { currentSlug: current?.slug ?? null, history };
  },

  async buildSchema(entityId) {
    const o = await prisma.offer.findUnique({
      where: { id: entityId },
      select: {
        slug: true,
        title: true,
        description: true,
        priceFrom: true,
        priceText: true,
        coverImage: true,
        kind: true,
        campProgramType: true,
        seoCanonicalUrl: true,
        seoJsonLdOverride: true,
        place: {
          select: {
            title: true,
            slug: true,
            formattedAddr: true,
            customAddress: true,
            city: { select: { slug: true } },
          },
        },
      },
    });
    if (!o) return null;
    if (o.seoJsonLdOverride && typeof o.seoJsonLdOverride === "object") {
      return o.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    const citySlug = o.place?.city?.slug || "minsk";
    const canonicalUrl =
      o.seoCanonicalUrl?.trim() ||
      `${publicBase}${getOfferPublicPath(o, citySlug)}`;

    return buildOfferStructuredData({
      canonicalUrl,
      publicType: resolveOfferStructuredDataType(o),
      title: o.title,
      description: o.description,
      image: o.coverImage,
      price: o.priceFrom,
      priceText: o.priceText,
      priceCurrency: "BYN",
      place: o.place
        ? {
            name: o.place.title,
            slug: o.place.slug,
            address: o.place.formattedAddr || o.place.customAddress,
            url: o.place.slug ? `/places/${o.place.slug}` : undefined,
          }
        : null,
      publicBaseUrl: publicBase,
    });
  },
};
