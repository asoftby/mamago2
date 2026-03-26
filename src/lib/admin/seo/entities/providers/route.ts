import type { Prisma } from "@prisma/client";
import { RouteStatus, RouteVisibility } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import { indexationStatusFromRobots, isIndexableFromRobots } from "../utils";
import { updateRouteSlug } from "@/lib/slug/routeSlugService";
import { buildRouteJsonLd } from "@/lib/seo/schema/buildRouteJsonLd";

export const routeProvider: SeoEntityProvider = {
  entityType: "route",
  badgeLabel: "Route",
  section: "routes",

  async listRows() {
    const routes = await prisma.route.findMany({
      where: { status: RouteStatus.PUBLISHED, visibility: RouteVisibility.PUBLIC },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoRobots: true,
      },
    });

    return routes.map((r) => {
      const path = `/routes/${r.slug}`;
      const canonical = r.seoCanonicalUrl?.trim() || path;
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
        indexationStatus: indexationStatusFromRobots(r.seoRobots),
        isIndexable: isIndexableFromRobots(r.seoRobots),
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
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      summary: "",
      slug: r.slug,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      seoH1: r.seoH1,
      seoCanonicalUrl: r.seoCanonicalUrl,
      seoOgTitle: r.seoOgTitle,
      seoOgDescription: r.seoOgDescription,
      seoOgImage: r.seoOgImage,
      seoRobots: r.seoRobots,
      seoJsonLdOverride: (r.seoJsonLdOverride as unknown) ?? null,
    };
  },

  async updateSeo(entityId, input) {
    if (typeof input.slug === "string") {
      await updateRouteSlug(entityId, input.slug);
    }
    await prisma.route.update({
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
    const existing = await prisma.route.findUnique({ where: { id: entityId }, select: { seoRobots: true } });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex") ? "index,follow" : "noindex,follow";
    await prisma.route.update({ where: { id: entityId }, data: { seoRobots: next } });
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
      include: { stops: { orderBy: { order: "asc" }, include: { place: { select: { id: true, title: true } } } } },
    });
    if (!r) return null;
    if (r.seoJsonLdOverride && typeof r.seoJsonLdOverride === "object") {
      return r.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildRouteJsonLd({ route: { slug: r.slug, title: r.title, stops: r.stops }, publicBase });
  },
};

