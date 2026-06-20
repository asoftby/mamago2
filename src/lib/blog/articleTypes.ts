import type { Article } from "@prisma/client";

export type DbArticleSeo = Pick<
  Article,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "excerpt"
  | "heroImage"
  | "publishedAt"
  | "updatedAt"
  | "seoTitle"
  | "seoDescription"
  | "seoH1"
  | "seoCanonicalUrl"
  | "seoOgTitle"
  | "seoOgDescription"
  | "seoOgImage"
  | "seoRobots"
  | "seoJsonLdOverride"
  | "noindex"
  | "authorLabel"
>;

export type DbArticleSeoAuthor = {
  authorUser?: { displayName: string | null } | null;
  category?: { nameRu: string | null } | null;
  tags?: Array<{ title: string }>;
};

export type DbBackedArticle = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  readTime: number;
  publishedAt: string;
  heroImage: string | null;
  _redirectToSlug: string | null;
  _seo: DbArticleSeo & DbArticleSeoAuthor;
};

export type MockArticle = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  readTime: number;
  publishedAt: string;
  heroImage: string | null;
};

export type ArticleVm = DbBackedArticle | MockArticle;
