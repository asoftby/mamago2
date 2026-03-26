import type { SeoPageSection, SeoPageType } from "@/lib/admin/seo/domain/types";

export type SeoEntityType = Extract<
  SeoPageType,
  "event" | "place" | "offer" | "route" | "article"
>;

export type SeoEntityListingRow = {
  id: string;
  path: string;
  section: SeoPageSection;
  type: SeoEntityType;
  title: string;
  h1: string;
  description: string;
  canonical: string | null;
  updatedAt: string;
  indexationStatus: "indexed" | "noindex" | "draft";
  isIndexable: boolean;
  filtersSnapshot: { entity: SeoEntityType; entityId: string } & Record<string, unknown>;
};

export type SeoEntityEditorModel = {
  id: string;
  title: string;
  summary: string;
  slug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoH1: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoRobots: string | null;
  seoJsonLdOverride: unknown | null;
};

export type SeoEntityRedirectRow = {
  id: string;
  slug: string;
  createdAt: Date;
};

export type SeoEntityRedirects = {
  currentSlug: string | null;
  history: SeoEntityRedirectRow[];
};

export type SeoEntityUpdateInput = {
  slug: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoH1: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoRobots: string | null;
  seoJsonLdOverride: unknown | null;
};

export type SeoEntityProvider = {
  entityType: SeoEntityType;
  badgeLabel: string;
  section: SeoPageSection;

  listRows(): Promise<SeoEntityListingRow[]>;
  loadEditorModel(entityId: string): Promise<SeoEntityEditorModel | null>;
  updateSeo(entityId: string, input: SeoEntityUpdateInput): Promise<void>;
  toggleIndexation(entityId: string): Promise<void>;
  loadRedirects(entityId: string): Promise<SeoEntityRedirects>;
  buildSchema(entityId: string): Promise<Record<string, unknown> | null>;
};

