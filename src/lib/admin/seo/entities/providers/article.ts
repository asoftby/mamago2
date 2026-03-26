import type { Prisma } from "@prisma/client";
import { ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import { indexationStatusFromRobots, isIndexableFromRobots } from "../utils";
import { updateArticleSlug } from "@/lib/slug/articleSlugService";
import { buildArticleJsonLd } from "@/lib/seo/schema/buildArticleJsonLd";

export const articleProvider: SeoEntityProvider = {
  entityType: "article",
  badgeLabel: "Article",
  section: "journal",

  async listRows() {
    const articles = await prisma.article.findMany({
      where: { status: ContentStatus.PUBLISHED, slug: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        updatedAt: true,
        seoH1: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoRobots: true,
      },
    });

    return articles.map((a) => {
      const path = `/blog/${a.slug}`;
      const canonical = a.seoCanonicalUrl?.trim() || path;
      return {
        id: `entity:article:${a.id}`,
        path,
        section: "journal",
        type: "article",
        filtersSnapshot: { entity: "article", entityId: a.id },
        title: a.seoTitle?.trim() || a.title,
        h1: a.seoH1?.trim() || a.title,
        description: a.seoDescription?.trim() || a.excerpt || "",
        canonical,
        updatedAt: a.updatedAt.toISOString(),
        indexationStatus: indexationStatusFromRobots(a.seoRobots),
        isIndexable: isIndexableFromRobots(a.seoRobots),
      };
    });
  },

  async loadEditorModel(entityId) {
    const a = await prisma.article.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        excerpt: true,
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
      summary: a.excerpt ?? "",
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
      await updateArticleSlug(entityId, input.slug);
    }
    await prisma.article.update({
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
    const existing = await prisma.article.findUnique({ where: { id: entityId }, select: { seoRobots: true } });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex") ? "index,follow" : "noindex,follow";
    await prisma.article.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async loadRedirects(entityId) {
    const current = await prisma.article.findUnique({ where: { id: entityId }, select: { slug: true } });
    const history = await prisma.articleSlugHistory.findMany({
      where: { articleId: entityId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, createdAt: true },
    });
    return { currentSlug: current?.slug ?? null, history };
  },

  async buildSchema(entityId) {
    const a = await prisma.article.findUnique({
      where: { id: entityId },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        heroImage: true,
        publishedAt: true,
        seoJsonLdOverride: true,
      },
    });
    if (!a) return null;
    if (a.seoJsonLdOverride && typeof a.seoJsonLdOverride === "object") {
      return a.seoJsonLdOverride as Record<string, unknown>;
    }
    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    return buildArticleJsonLd({ article: a, publicBase });
  },
};

