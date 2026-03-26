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
  | "seoTitle"
  | "seoDescription"
  | "seoH1"
  | "seoCanonicalUrl"
  | "seoOgTitle"
  | "seoOgDescription"
  | "seoOgImage"
  | "seoRobots"
  | "seoJsonLdOverride"
>;

export type DbBackedArticle = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  readTime: number;
  publishedAt: string;
  heroImage: string | null;
  _redirectToSlug: string | null;
  _seo: DbArticleSeo;
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

