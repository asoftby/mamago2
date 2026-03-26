import { ActivityType, ContentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import { indexationStatusFromRobots, isIndexableFromRobots } from "../utils";
import { updateActivitySlug } from "@/lib/slug/activitySlugService";
import { buildEventJsonLd } from "@/lib/seo/schema/buildEventJsonLd";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";

export const eventProvider: SeoEntityProvider = {
  entityType: "event",
  badgeLabel: "Event",
  section: "events",

  async listRows() {
    const activities = await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        status: ContentStatus.PUBLISHED,
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
        place: { select: { city: { select: { slug: true } } } },
      },
    });

    return activities.map((a) => {
      const citySlug = a.place?.city?.slug ?? "minsk";
      const path = `/${citySlug}/activity/${a.slug}`;
      const canonical = a.seoCanonicalUrl?.trim() || path;
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
        indexationStatus: indexationStatusFromRobots(a.seoRobots),
        isIndexable: isIndexableFromRobots(a.seoRobots),
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
    if (!a) return null;
    return {
      id: a.id,
      title: a.title,
      summary: a.shortDesc,
      slug: a.slug,
      seoTitle: a.seoTitle,
      seoDescription: a.seoDescription,
      seoH1: a.seoH1,
      seoCanonicalUrl: a.seoCanonicalUrl,
      seoOgTitle: a.seoOgTitle,
      seoOgDescription: a.seoOgDescription,
      seoOgImage: a.seoOgImage,
      seoRobots: a.seoRobots,
      seoJsonLdOverride: (a.seoJsonLdOverride as unknown) ?? null,
    };
  },

  async updateSeo(entityId, input) {
    if (typeof input.slug === "string") {
      await updateActivitySlug(entityId, input.slug);
    }
    await prisma.activity.update({
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
    const existing = await prisma.activity.findUnique({
      where: { id: entityId },
      select: { seoRobots: true },
    });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex") ? "index,follow" : "noindex,follow";
    await prisma.activity.update({ where: { id: entityId }, data: { seoRobots: next } });
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

