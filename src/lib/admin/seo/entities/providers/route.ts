import { RouteStatus, RouteVisibility } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import {
  indexationStatusForPublishedEntity,
  isIndexableForPublishedEntity,
} from "../utils";
import { buildSegmentEntityDiagnostics } from "../buildEntityDiagnostics";
import { applyRouteSeoUpdate } from "@/lib/admin/seo/entities/applyEntitySeoUpdate";
import { buildRouteJsonLd } from "@/lib/seo/schema/buildRouteJsonLd";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";

const ROUTE_LIST_LIMIT = 300;

export const routeProvider: SeoEntityProvider = {
  entityType: "route",
  badgeLabel: "Route",
  section: "routes",

  async listRows() {
    const routes = await prisma.route.findMany({
      where: { status: { not: RouteStatus.ARCHIVED } },
      orderBy: { updatedAt: "desc" },
      take: ROUTE_LIST_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        visibility: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoCanonicalSource: true,
        seoRobots: true,
      },
    });

    return routes.map((r) => {
      const published =
        r.status === RouteStatus.PUBLISHED &&
        r.visibility === RouteVisibility.PUBLIC;
      const seg = r.slug?.trim() || r.id;
      const path = `/routes/${seg}`;
      const canonical = r.seoCanonicalUrl?.trim() || path;
      const entityDiagnostics = buildSegmentEntityDiagnostics("route", {
        entityId: r.id,
        title: r.title,
        slug: r.slug,
        seoCanonicalUrl: r.seoCanonicalUrl,
        seoCanonicalSource: r.seoCanonicalSource,
        seoRobots: r.seoRobots,
        contentStatus: `${r.status}/${r.visibility}`,
      });
      return {
        id: `entity:route:${r.id}`,
        path,
        section: "routes",
        type: "route",
        filtersSnapshot: { entity: "route", entityId: r.id },
        title: r.seoTitle?.trim() || r.title,
        h1: r.seoH1?.trim() || r.title,
        description: r.seoDescription?.trim() || "",
        canonical,
        updatedAt: r.updatedAt.toISOString(),
        indexationStatus: indexationStatusForPublishedEntity(
          published,
          r.seoRobots,
        ),
        isIndexable: isIndexableForPublishedEntity(published, r.seoRobots),
        entityDiagnostics,
      };
    });
  },

  async loadEditorModel(entityId) {
    const r = await prisma.route.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
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
      },
    });
    if (!r) return null;
    const urlDiagnostics = buildSegmentEntityDiagnostics("route", {
      entityId: r.id,
      title: r.title,
      slug: r.slug,
      seoCanonicalUrl: r.seoCanonicalUrl,
      seoCanonicalSource: r.seoCanonicalSource,
      seoRobots: r.seoRobots,
      contentStatus: `${r.status}/${r.visibility}`,
    });
    return {
      id: r.id,
      title: r.title,
      summary: "",
      slug: r.slug,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      seoH1: r.seoH1,
      seoCanonicalUrl: r.seoCanonicalUrl,
      seoCanonicalSource: r.seoCanonicalSource,
      seoOgTitle: r.seoOgTitle,
      seoOgDescription: r.seoOgDescription,
      seoOgImage: r.seoOgImage,
      seoRobots: r.seoRobots,
      seoJsonLdOverride: (r.seoJsonLdOverride as unknown) ?? null,
      urlDiagnostics,
      contentStatus: `${r.status}/${r.visibility}`,
      citySlug: null,
    };
  },

  async updateSeo(entityId, input) {
    await applyRouteSeoUpdate(entityId, input);
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.route.findUnique({ where: { id: entityId }, select: { seoRobots: true } });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex")
      ? SEO_ROBOTS_INDEX_FOLLOW
      : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.route.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async setIndexFollow(entityId, index) {
    const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.route.update({ where: { id: entityId }, data: { seoRobots } });
  },

  async loadRedirects(entityId) {
    const current = await prisma.route.findUnique({ where: { id: entityId }, select: { slug: true } });
    const history = await prisma.routeSlugHistory.findMany({
      where: { routeId: entityId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, createdAt: true },
    });
    return { currentSlug: current?.slug ?? null, history };
  },

  async buildSchema(entityId) {
    const r = await prisma.route.findUnique({
      where: { id: entityId },
      include: {
        stops: {
          orderBy: { order: "asc" },
          include: { place: { select: { id: true, slug: true, title: true } } },
        },
      },
    });
    if (!r) return null;
    if (r.seoJsonLdOverride && typeof r.seoJsonLdOverride === "object") {
      return r.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildRouteJsonLd({ route: { slug: r.slug, title: r.title, stops: r.stops }, publicBase });
  },
};
