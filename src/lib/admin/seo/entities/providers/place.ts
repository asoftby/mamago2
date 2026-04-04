import { ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import {
  indexationStatusForPublishedEntity,
  isIndexableForPublishedEntity,
} from "../utils";
import { buildSegmentEntityDiagnostics } from "../buildEntityDiagnostics";
import { applyPlaceSeoUpdate } from "@/lib/admin/seo/entities/applyEntitySeoUpdate";
import { buildPlaceJsonLd } from "@/lib/seo/schema/buildPlaceJsonLd";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";

const PLACE_LIST_LIMIT = 400;

export const placeProvider: SeoEntityProvider = {
  entityType: "place",
  badgeLabel: "Place",
  section: "kuda",

  async listRows() {
    const places = await prisma.place.findMany({
      where: {
        archivedAt: null,
        status: { not: ContentStatus.DELETED },
      },
      orderBy: { updatedAt: "desc" },
      take: PLACE_LIST_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDesc: true,
        status: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoCanonicalSource: true,
        seoRobots: true,
      },
    });

    return places.map((p) => {
      const published = p.status === ContentStatus.PUBLISHED;
      const seg = p.slug?.trim() || p.id;
      const path = `/places/${seg}`;
      const canonical = p.seoCanonicalUrl?.trim() || path;
      const entityDiagnostics = buildSegmentEntityDiagnostics("place", {
        entityId: p.id,
        title: p.title,
        slug: p.slug,
        seoCanonicalUrl: p.seoCanonicalUrl,
        seoCanonicalSource: p.seoCanonicalSource,
        seoRobots: p.seoRobots,
        contentStatus: p.status,
      });
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
        indexationStatus: indexationStatusForPublishedEntity(
          published,
          p.seoRobots,
        ),
        isIndexable: isIndexableForPublishedEntity(published, p.seoRobots),
        entityDiagnostics,
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
        status: true,
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
        city: { select: { slug: true } },
      },
    });
    if (!p) return null;
    const urlDiagnostics = buildSegmentEntityDiagnostics("place", {
      entityId: p.id,
      title: p.title,
      slug: p.slug,
      seoCanonicalUrl: p.seoCanonicalUrl,
      seoCanonicalSource: p.seoCanonicalSource,
      seoRobots: p.seoRobots,
      contentStatus: p.status,
    });
    return {
      id: p.id,
      title: p.title,
      summary: p.shortDesc,
      slug: p.slug,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      seoH1: p.seoH1,
      seoCanonicalUrl: p.seoCanonicalUrl,
      seoCanonicalSource: p.seoCanonicalSource,
      seoOgTitle: p.seoOgTitle,
      seoOgDescription: p.seoOgDescription,
      seoOgImage: p.seoOgImage,
      seoRobots: p.seoRobots,
      seoJsonLdOverride: (p.seoJsonLdOverride as unknown) ?? null,
      urlDiagnostics,
      contentStatus: p.status,
      citySlug: p.city?.slug ?? null,
    };
  },

  async updateSeo(entityId, input) {
    await applyPlaceSeoUpdate(entityId, input);
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.place.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex")
      ? SEO_ROBOTS_INDEX_FOLLOW
      : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.place.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async setIndexFollow(entityId, index) {
    const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.place.update({ where: { id: entityId }, data: { seoRobots } });
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

