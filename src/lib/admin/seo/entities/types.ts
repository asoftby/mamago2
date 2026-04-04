import type {
  SeoPageEntityDiagnostics,
  SeoPageSection,
  SeoPageType,
} from "@/lib/admin/seo/domain/types";

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
  entityDiagnostics?: SeoPageEntityDiagnostics | null;
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
  seoCanonicalSource: "AUTO" | "MANUAL" | "FALLBACK";
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoOgImage: string | null;
  seoRobots: string | null;
  seoJsonLdOverride: unknown | null;
  /** Фактический public URL / slug (только чтение, для диагностики) */
  urlDiagnostics?: SeoPageEntityDiagnostics | null;
  /** Сырой статус из БД (enum string; у route может быть `STATUS/VISIBILITY`) */
  contentStatus: string;
  /** Город (slug) для событий/мест — для строки метаданных в шапке */
  citySlug?: string | null;
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
  /** Явно: index → `index, follow`, !index → `noindex, follow` */
  setIndexFollow(entityId: string, index: boolean): Promise<void>;
  loadRedirects(entityId: string): Promise<SeoEntityRedirects>;
  buildSchema(entityId: string): Promise<Record<string, unknown> | null>;
};

