import { ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SeoEntityProvider } from "../types";
import {
  indexationStatusForPublishedEntity,
  isIndexableForPublishedEntity,
} from "../utils";
import { buildSegmentEntityDiagnostics } from "../buildEntityDiagnostics";
import { applyArticleSeoUpdate } from "@/lib/admin/seo/entities/applyEntitySeoUpdate";
import { buildArticleJsonLd } from "@/lib/seo/schema/buildArticleJsonLd";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";

const ARTICLE_LIST_LIMIT = 400;

export const articleProvider: SeoEntityProvider = {
  entityType: "article",
  badgeLabel: "Article",
  section: "journal",

  async listRows() {
    const articles = await prisma.article.findMany({
      where: { status: { not: ContentStatus.DELETED } },
      orderBy: { updatedAt: "desc" },
      take: ARTICLE_LIST_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
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

    return articles.map((a) => {
      const published = a.status === ContentStatus.PUBLISHED;
      const seg = a.slug?.trim() || a.id;
      const path = `/blog/${seg}`;
      const canonical = a.seoCanonicalUrl?.trim() || path;
      const entityDiagnostics = buildSegmentEntityDiagnostics("article", {
        entityId: a.id,
        title: a.title,
        slug: a.slug,
        seoCanonicalUrl: a.seoCanonicalUrl,
        seoCanonicalSource: a.seoCanonicalSource,
        seoRobots: a.seoRobots,
        contentStatus: a.status,
      });
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
    const a = await prisma.article.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        excerpt: true,
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
      },
    });
    if (!a) return null;
    const urlDiagnostics = buildSegmentEntityDiagnostics("article", {
      entityId: a.id,
      title: a.title,
      slug: a.slug,
      seoCanonicalUrl: a.seoCanonicalUrl,
      seoCanonicalSource: a.seoCanonicalSource,
      seoRobots: a.seoRobots,
      contentStatus: a.status,
    });
    return {
      id: a.id,
      title: a.title,
      summary: a.excerpt ?? "",
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
      citySlug: null,
    };
  },

  async updateSeo(entityId, input) {
    await applyArticleSeoUpdate(entityId, input);
  },

  async toggleIndexation(entityId) {
    const existing = await prisma.article.findUnique({ where: { id: entityId }, select: { seoRobots: true } });
    if (!existing) return;
    const raw = (existing.seoRobots ?? "").toLowerCase();
    const next = raw.includes("noindex")
      ? SEO_ROBOTS_INDEX_FOLLOW
      : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.article.update({ where: { id: entityId }, data: { seoRobots: next } });
  },

  async setIndexFollow(entityId, index) {
    const seoRobots = index ? SEO_ROBOTS_INDEX_FOLLOW : SEO_ROBOTS_NOINDEX_FOLLOW;
    await prisma.article.update({ where: { id: entityId }, data: { seoRobots } });
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

