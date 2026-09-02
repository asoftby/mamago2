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
import {
  buildEventJsonLd,
  eventJsonLdOverrideHasMissingStartDate,
} from "@/lib/seo/schema/buildEventJsonLd";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import {
  canonicalPublicActivityPath,
  resolveCanonicalCitySlugForEvent,
} from "@/lib/business/eventPublicLink";

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
        cityId: true,
        status: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoCanonicalSource: true,
        seoRobots: true,
        venue: { select: { cityId: true } },
        place: { select: { city: { select: { slug: true } } } },
      },
    });

    const cityIds = Array.from(
      new Set(
        activities
          .flatMap((a) => [a.cityId, a.venue?.cityId])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const cityRows =
      cityIds.length > 0
        ? await prisma.city.findMany({
            where: { id: { in: cityIds } },
            select: { id: true, slug: true },
          })
        : [];
    const citySlugById = new Map(cityRows.map((row) => [row.id, row.slug]));

    return activities.map((a) => {
      const citySlug = resolveCanonicalCitySlugForEvent({
        activityCitySlug: a.cityId ? citySlugById.get(a.cityId) ?? null : null,
        placeCitySlug: a.place?.city?.slug ?? null,
        venueCitySlug: a.venue?.cityId ? citySlugById.get(a.venue.cityId) ?? null : null,
      });
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
        cityId: true,
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
        venue: { select: { cityId: true } },
        seoJsonLdOverride: true,
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!a) return null;
    const [activityCity, venueCity] = await Promise.all([
      a.cityId
        ? prisma.city.findUnique({ where: { id: a.cityId }, select: { slug: true } })
        : Promise.resolve(null),
      a.venue?.cityId
        ? prisma.city.findUnique({ where: { id: a.venue.cityId }, select: { slug: true } })
        : Promise.resolve(null),
    ]);
    const citySlug = resolveCanonicalCitySlugForEvent({
      activityCitySlug: activityCity?.slug ?? null,
      placeCitySlug: a.place?.city?.slug ?? null,
      venueCitySlug: venueCity?.slug ?? null,
    });
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
        id: true,
        slug: true,
        cityId: true,
        seoCanonicalUrl: true,
        seoJsonLdOverride: true,
        place: { select: { city: { select: { slug: true } } } },
        venue: { select: { cityId: true } },
      },
    });
    if (!a?.slug) return null;
    if (
      a.seoJsonLdOverride &&
      typeof a.seoJsonLdOverride === "object" &&
      !eventJsonLdOverrideHasMissingStartDate(a.seoJsonLdOverride)
    ) {
      return a.seoJsonLdOverride as Record<string, unknown>;
    }
    const [activityCity, venueCity] = await Promise.all([
      a.cityId
        ? prisma.city.findUnique({ where: { id: a.cityId }, select: { slug: true } })
        : Promise.resolve(null),
      a.venue?.cityId
        ? prisma.city.findUnique({ where: { id: a.venue.cityId }, select: { slug: true } })
        : Promise.resolve(null),
    ]);
    const citySlug = resolveCanonicalCitySlugForEvent({
      activityCitySlug: activityCity?.slug ?? null,
      placeCitySlug: a.place?.city?.slug ?? null,
      venueCitySlug: venueCity?.slug ?? null,
    });
    const loaded = await loadPublicActivityForCityPage(citySlug, a.slug);
    if (!loaded) return null;
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    const canonicalUrl =
      loaded.seoCanonicalUrl?.trim() ||
      `${publicBase}${canonicalPublicActivityPath({
        activityId: loaded.id,
        activitySlug: loaded.slug,
        activityCitySlug: activityCity?.slug ?? null,
        placeCitySlug: loaded.place?.city?.slug ?? null,
        venueCitySlug: loaded.venue?.place?.city?.slug ?? venueCity?.slug ?? null,
      })}`;
    const locationName =
      loaded.venue?.place?.title ||
      loaded.venue?.title ||
      loaded.place?.title ||
      undefined;
    const locationAddress =
      loaded.venue?.place?.formattedAddr ||
      loaded.venue?.place?.customAddress ||
      loaded.venue?.addressLine ||
      loaded.place?.formattedAddr ||
      loaded.place?.customAddress ||
      undefined;
    return buildEventJsonLd({
      canonicalUrl,
      title: loaded.title,
      description: loaded.shortDesc,
      image: loaded.seoOgImage?.trim() || loaded.coverImageUrl,
      startDate: loaded.schemaStartDate,
      sessions: loaded.sessions,
      format: loaded.format,
      location:
        locationName || locationAddress
          ? {
              name: locationName,
              address: locationAddress,
            }
          : undefined,
      publicBaseUrl: publicBase,
    });
  },
};
