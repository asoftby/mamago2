import type { Prisma } from "@prisma/client";
import { OfferStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import { indexationStatusFromRobots, isIndexableFromRobots } from "../utils";
import { updateOfferSlug } from "@/lib/slug/offerSlugService";
import { buildOfferJsonLd } from "@/lib/seo/schema/buildOfferJsonLd";

export const offerProvider: SeoEntityProvider = {
  entityType: "offer",
  badgeLabel: "Offer",
  section: "birthday",

  async listRows() {
    const offers = await prisma.offer.findMany({
      where: { status: OfferStatus.PUBLISHED, slug: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoRobots: true,
      },
    });

    return offers.map((o) => {
      const path = `/offers/${o.slug}`;
      const canonical = o.seoCanonicalUrl?.trim() || path;
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
        indexationStatus: indexationStatusFromRobots(o.seoRobots),
        isIndexable: isIndexableFromRobots(o.seoRobots),
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
        seoTitle: true,
        seoDescription: true,
        seoH1: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoOgImage: true,
        seoRobots: true,
        seoJsonLdOverride: true,
      },
    });
    if (!o) return null;
    return {
      id: o.id,
      title: o.title,
      summary: o.description ?? "",
      slug: o.slug,
      seoTitle: o.seoTitle,
      seoDescription: o.seoDescription,
      seoH1: o.seoH1,
      seoCanonicalUrl: o.seoCanonicalUrl,
      seoOgTitle: o.seoOgTitle,
      seoOgDescription: o.seoOgDescription,
      seoOgImage: o.seoOgImage,
      seoRobots: o.seoRobots,
      seoJsonLdOverride: (o.seoJsonLdOverride as unknown) ?? null,
    };
  },

  async updateSeo(entityId, input) {
    if (typeof input.slug === "string") {
      await updateOfferSlug(entityId, input.slug);
    }
    await prisma.offer.update({
      where: { id: entityId },
      data: {
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        seoH1: input.seoH1,
        seoCanonicalUrl: input.seoCanonicalUrl,
        seoOgTitle: input.seoOgTitle,
        seoOgDescription: input.seoOgDescription,
        seoOgImage: input.seoOgImage,
        seoRobots: input.seoRobots,
        seoJsonLdOverride: input.seoJsonLdOverride as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.offer.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex") ? "index,follow" : "noindex,follow";
    await prisma.offer.update({ where: { id: entityId }, data: { seoRobots: next } });
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
        seoJsonLdOverride: true,
        place: { select: { title: true, slug: true } },
      },
    });
    if (!o) return null;
    if (o.seoJsonLdOverride && typeof o.seoJsonLdOverride === "object") {
      return o.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildOfferJsonLd({ offer: o, place: o.place, publicBase });
  },
};

