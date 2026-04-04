import { ActivityType, ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import {
  indexationStatusForPublishedEntity,
  isIndexableForPublishedEntity,
} from "../utils";
import { buildEventEntityDiagnostics } from "../buildEntityDiagnostics";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { applyActivitySeoUpdate } from "@/lib/admin/seo/entities/applyEntitySeoUpdate";
import { buildEventJsonLd } from "@/lib/seo/schema/buildEventJsonLd";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";

const EVENT_LIST_LIMIT = 500;

export const eventProvider: SeoEntityProvider = {
  entityType: "event",
  badgeLabel: "Event",
  section: "events",

  async listRows() {
    const activities = await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        status: { not: ContentStatus.DELETED },
      },
      orderBy: { updatedAt: "desc" },
      take: EVENT_LIST_LIMIT,
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
        place: { select: { city: { select: { slug: true } } } },
      },
    });

    return activities.map((a) => {
      const citySlug = a.place?.city?.slug ?? "minsk";
      const published = a.status === ContentStatus.PUBLISHED;
      const path = publicActivityPath(a.id, citySlug, a.slug);
      const canonical = a.seoCanonicalUrl?.trim() || path;
      const entityDiagnostics = buildEventEntityDiagnostics({
        activityId: a.id,
        title: a.title,
        slug: a.slug,
        citySlug,
        seoCanonicalUrl: a.seoCanonicalUrl,
        seoCanonicalSource: a.seoCanonicalSource,
        seoRobots: a.seoRobots,
        contentStatus: a.status,
      });
      return {
        id: `entity:event:${a.id}`,
        path,
        section: "events",
        type: "event",
        filtersSnapshot: { entity: "event", entityId: a.id, city: citySlug },
        title: a.seoTitle?.trim() || a.title,
        h1: a.seoH1?.trim() || a.title,
        description: a.seoDescription?.trim() || a.shortDesc || "",
        canonical,
        updatedAt: a.updatedAt.toISOString(),
        indexationStatus: indexationStatusForPublishedEntity(
          published,
          a.seoRobots,
        ),
        isIndexable: isIndexableForPublishedEntity(published, a.seoRobots),
        entityDiagnostics,
      };
    });
  },

  async loadEditorModel(entityId) {
    const a = await prisma.activity.findUnique({
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
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!a) return null;
    const citySlug = a.place?.city?.slug ?? "minsk";
    const urlDiagnostics = buildEventEntityDiagnostics({
      activityId: a.id,
      title: a.title,
      slug: a.slug,
      citySlug,
      seoCanonicalUrl: a.seoCanonicalUrl,
      seoCanonicalSource: a.seoCanonicalSource,
      seoRobots: a.seoRobots,
      contentStatus: a.status,
    });
    return {
      id: a.id,
      title: a.title,
      summary: a.shortDesc,
      slug: a.slug,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      seoH1: a.seoH1,
      seoCanonicalUrl: a.seoCanonicalUrl,
      seoCanonicalSource: a.seoCanonicalSource,
      seoOgTitle: a.seoOgTitle,
      seoOgDescription: a.seoOgDescription,
      seoOgImage: a.seoOgImage,
      seoRobots: a.seoRobots,
      seoJsonLdOverride: (a.seoJsonLdOverride as unknown) ?? null,
      urlDiagnostics,
      contentStatus: a.status,
      citySlug,
    };
  },

  async updateSeo(entityId, input) {
    await applyActivitySeoUpdate(entityId, input);
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.activity.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex")
      ? SEO_ROBOTS_INDEX_FOLLOW
      : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.activity.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async setIndexFollow(entityId, index) {
    const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.activity.update({ where: { id: entityId }, data: { seoRobots } });
  },

  async loadRedirects(entityId) {
    const current = await prisma.activity.findUnique({
      where: { id: entityId },
      select: { slug: true },
    });
    const history = await prisma.activitySlugHistory.findMany({
      where: { activityId: entityId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, createdAt: true },
    });
    return { currentSlug: current?.slug ?? null, history };
  },

  async buildSchema(entityId) {
    const a = await prisma.activity.findUnique({
      where: { id: entityId },
      select: {
        slug: true,
        seoJsonLdOverride: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!a?.slug) return null;
    if (a.seoJsonLdOverride && typeof a.seoJsonLdOverride === "object") {
      return a.seoJsonLdOverride as Record<string, unknown>;
    }
    const citySlug = a.place?.city?.slug ?? "minsk";
    const loaded = await loadPublicActivityForCityPage(citySlug, a.slug);
    if (!loaded) return null;
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildEventJsonLd({ activity: loaded, citySlug, publicBase });
  },
};

