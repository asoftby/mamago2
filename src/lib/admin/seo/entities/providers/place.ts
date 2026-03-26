import type { Prisma } from "@prisma/client";
import { ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import { indexationStatusFromRobots, isIndexableFromRobots } from "../utils";
import { updatePlaceSlug } from "@/lib/slug/placeSlugService";
import { buildPlaceJsonLd } from "@/lib/seo/schema/buildPlaceJsonLd";

export const placeProvider: SeoEntityProvider = {
  entityType: "place",
  badgeLabel: "Place",
  section: "kuda",

  async listRows() {
    const places = await prisma.place.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        archivedAt: null,
        slug: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDesc: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoRobots: true,
      },
    });

    return places.map((p) => {
      const path = `/places/${p.slug}`;
      const canonical = p.seoCanonicalUrl?.trim() || path;
      return {
        id: `entity:place:${p.id}`,
        path,
        section: "kuda",
        type: "place",
        filtersSnapshot: { entity: "place", entityId: p.id },
        title: p.seoTitle?.trim() || p.title,
        h1: p.seoH1?.trim() || p.title,
        description: p.seoDescription?.trim() || p.shortDesc || "",
        canonical,
        updatedAt: p.updatedAt.toISOString(),
        indexationStatus: indexationStatusFromRobots(p.seoRobots),
        isIndexable: isIndexableFromRobots(p.seoRobots),
      };
    });
  },

  async loadEditorModel(entityId) {
    const p = await prisma.place.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        shortDesc: true,
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
    if (!p) return null;
    return {
      id: p.id,
      title: p.title,
      summary: p.shortDesc,
      slug: p.slug,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      seoH1: p.seoH1,
      seoCanonicalUrl: p.seoCanonicalUrl,
      seoOgTitle: p.seoOgTitle,
      seoOgDescription: p.seoOgDescription,
      seoOgImage: p.seoOgImage,
      seoRobots: p.seoRobots,
      seoJsonLdOverride: (p.seoJsonLdOverride as unknown) ?? null,
    };
  },

  async updateSeo(entityId, input) {
    if (typeof input.slug === "string") {
      await updatePlaceSlug(entityId, input.slug);
    }
    await prisma.place.update({
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
    const existing = await prisma.place.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex") ? "index,follow" : "noindex,follow";
    await prisma.place.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async loadRedirects(entityId) {
    const current = await prisma.place.findUnique({
      where: { id: entityId },
      select: { slug: true },
    });
    const history = await prisma.placeSlugHistory.findMany({
      where: { placeId: entityId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, createdAt: true },
    });
    return { currentSlug: current?.slug ?? null, history };
  },

  async buildSchema(entityId) {
    const p = await prisma.place.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        description: true,
        slug: true,
        formattedAddr: true,
        customAddress: true,
        seoJsonLdOverride: true,
      },
    });
    if (!p) return null;
    if (p.seoJsonLdOverride && typeof p.seoJsonLdOverride === "object") {
      return p.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildPlaceJsonLd({ place: p, publicBase });
  },
};

