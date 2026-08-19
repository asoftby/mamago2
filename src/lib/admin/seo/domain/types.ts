/**
 * SEO Control Center — единый доменный слой (frontend).
 * Импорты из `@/lib/admin/seo/domain` в UI и в адаптерах API.
 */

// -----------------------------------------------------------------------------
// SeoPage
// -----------------------------------------------------------------------------

export type SeoPageType =
  | "preset"
  | "category"
  | "generated"
  | "landing"
  | "event"
  | "place"
  | "offer"
  | "route"
  | "article";

export type SeoPageIndexationStatus = "indexed" | "noindex" | "draft";

export type SeoPageSection =
  | "kuda"
  | "zanyatiya"
  | "events"
  | "journal"
  | "routes"
  | "birthday"
  | "other";

export type SeoPageFiltersSnapshot = Record<string, unknown> & {
  city?: string;
  intent?: string;
  ageGroups?: string[];
};

/** Диагностика публичного URL для строк из entity-провайдеров (SEO center). */
export type SeoPageEntityDiagnostics = {
  entityKind: "event" | "place" | "offer" | "route" | "article";
  entityId: string;
  entityTitle: string;
  /** Город (для событий — сегмент перед /events/…) */
  citySlug: string | null;
  slug: string | null;
  /** Последний сегмент пути public URL */
  urlSegment: string;
  /** Относительный публичный путь */
  publicPath: string;
  /** Собрано из NEXT_PUBLIC_APP_URL + publicPath, если base задан */
  absolutePublicUrl: string | null;
  usesIdInUrl: boolean;
  /** Canonical ведёт на slug в пути (не на сырой id) */
  canonicalIsSlugBased: boolean;
  /** Источник seoCanonicalUrl в БД (для SEO center) */
  seoCanonicalSource?: "AUTO" | "MANUAL" | "FALLBACK";
  contentStatus: string;
  seoRobots: string | null;
  issues: string[];
};

/** SEO-посадка: отдельный слой от сущностей Event/Place/Article */
export interface SeoPage {
  id: string;
  path: string;
  section: SeoPageSection;
  type: SeoPageType;
  filtersSnapshot: SeoPageFiltersSnapshot;
  title: string;
  h1: string;
  description: string;
  isIndexable: boolean;
  canonical: string | null;
  updatedAt: string;
  indexationStatus: SeoPageIndexationStatus;
  /** Заполняется для строк из `listRows()` entity-провайдеров */
  entityDiagnostics?: SeoPageEntityDiagnostics | null;
}

/** @deprecated Используйте `SeoPage` */
export type SeoAdminPage = SeoPage;

// -----------------------------------------------------------------------------
// Redirects
// -----------------------------------------------------------------------------

export type AutoRedirectRuleType =
  | "legacy_migration"
  | "preset_mapping"
  | "slug_normalization"
  | "category_mapping";

/**
 * Disposition classification from the shared redirect manifest classifier
 * (`src/lib/seo/redirectManifestClassifier.ts`) — see
 * docs/migration/seo/redirect-audit-summary.md for the full taxonomy.
 */
export type RedirectDisposition =
  | "EXACT_REDIRECT"
  | "VALID_HUB_REMAP"
  | "P1_START_OR_CONTAINS"
  | "INVALID_TARGET"
  | "COLLISION"
  | "CHAIN"
  | "LOOP";

/** Системное / автоматическое правило редиректа */
export interface RedirectRule {
  id: string;
  fromUrl: string;
  toUrl: string;
  ruleType: AutoRedirectRuleType;
  source: string;
  enabled: boolean;
  status: "active" | "paused";
  lastCheckedAt: string | null;
  /** Disposition from the manifest classifier — absent for non-migration rules. */
  disposition?: RedirectDisposition;
  /** Resolved target entity table (Activity/Article/Place/Offer/City), if resolved. */
  resolvedTable?: string | null;
}

/** @deprecated Используйте `RedirectRule` */
export type AutomaticRedirectRule = RedirectRule;

export type ManualRedirectCode = "301" | "302";

export interface ManualRedirect {
  id: string;
  from: string;
  to: string;
  redirectType: ManualRedirectCode;
  note: string | null;
  status: "active" | "disabled";
  updatedAt: string;
}

export type UnmatchedDetectedType =
  | "event"
  | "place"
  | "category"
  | "listing"
  | "unknown";

export type UnmatchedRowStatus = "new" | "reviewed" | "ignored" | "resolved";

export interface UnmatchedUrl {
  id: string;
  legacyUrl: string;
  detectedType: UnmatchedDetectedType;
  suggestedTarget: string | null;
  status: UnmatchedRowStatus;
}

/** @deprecated Используйте `UnmatchedUrl` */
export type UnmatchedUrlRow = UnmatchedUrl;

// -----------------------------------------------------------------------------
// SEO metadata templates (title / H1 / description)
// -----------------------------------------------------------------------------

export type SeoTemplateScope =
  | "preset_page"
  | "category_page"
  | "article_page"
  | "event_page"
  | "place_page";

export interface SeoTemplate {
  id: string;
  name: string;
  scope: SeoTemplateScope;
  appliesToLabel: string;
  titleTemplate: string;
  h1Template: string;
  descriptionTemplate: string;
  active: boolean;
}

export interface SeoTemplateVariableDoc {
  key: string;
  description: string;
  example: string;
}

// -----------------------------------------------------------------------------
// Schema.org (structured data)
// -----------------------------------------------------------------------------

export type SchemaTemplateType =
  | "Organization"
  | "WebSite"
  | "BreadcrumbList"
  | "Event"
  | "Place"
  | "Article"
  | "CollectionPage";

export type SchemaTemplateStatus = "ok" | "degraded" | "disabled";

export interface SchemaFieldMapping {
  schemaField: string;
  source: string;
}

export interface SchemaRequiredFieldStatus {
  key: string;
  satisfied: boolean;
}

export interface SchemaTemplate {
  id: string;
  schemaType: SchemaTemplateType;
  appliesTo: string;
  active: boolean;
  status: SchemaTemplateStatus;
  fieldMappings: SchemaFieldMapping[];
  requiredFields: SchemaRequiredFieldStatus[];
  sampleJsonLd: Record<string, unknown>;
  coverageCount: number;
  warningsCount: number;
}

/** @deprecated Используйте `SchemaTemplate` */
export type SchemaTemplateDefinition = SchemaTemplate;

export type SchemaOverviewKind =
  | "event"
  | "place_local_business"
  | "article"
  | "collection_item_list"
  | "breadcrumb"
  | "organization_website";

export interface SchemaOverviewCard {
  id: string;
  kind: SchemaOverviewKind;
  title: string;
  templateIds: string[];
}

export type ValidationIssueCategory =
  | "missing_required"
  | "disabled_incomplete"
  | "no_structured_data"
  | "warning";

export type ValidationSeverity = "error" | "warning" | "info";

export interface SchemaValidationIssue {
  id: string;
  category: ValidationIssueCategory;
  severity: ValidationSeverity;
  title: string;
  detail: string;
  pageUrl?: string;
}

// -----------------------------------------------------------------------------
// Sitemap & robots
// -----------------------------------------------------------------------------

export type SitemapRegenerationStatus =
  | "idle"
  | "running"
  | "queued"
  | "failed";

export interface SitemapSectionStatus {
  id: string;
  section: string;
  includedInSitemap: boolean;
  pagesCount: number;
  lastUpdatedAt: string;
}

/** @deprecated Используйте `SitemapSectionStatus` */
export type SitemapSectionRow = SitemapSectionStatus;

export interface SitemapStatusSnapshot {
  sitemapUrl: string;
  lastGeneratedAt: string;
  indexedPagesCount: number;
  includedSectionsSummary: string[];
  regenerationStatus: SitemapRegenerationStatus;
}

export interface RobotsIndexationSettings {
  allowIndexing: boolean;
  noindexEnvironments: string[];
  robotsStatus: "ok" | "stale" | "missing";
  futureControlsNote: string;
  globalNoindexEnabled: boolean;
  globalNoindexReason: string;
  controlsManagedBy: "env";
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export type SeoKpiId =
  | "seoPages"
  | "redirects"
  | "schemaTemplates"
  | "unmatchedUrls"
  | "sitemapUrls"
  | "errorsWarnings";

export interface SeoDashboardKpi {
  id: SeoKpiId;
  label: string;
  value: string;
  hint: string;
}

export type SeoSystemStatusLevel = "ok" | "warning" | "empty";

export interface SeoDashboardSystemStatus {
  id: string;
  title: string;
  level: SeoSystemStatusLevel;
  description: string;
}

export type SeoAttentionSeverity = "high" | "medium" | "low";

export interface SeoDashboardAttentionItem {
  id: string;
  title: string;
  detail: string;
  severity: SeoAttentionSeverity;
}

/** Агрегат для главной SEO Control Center (замена разрозненных массивов) */
export interface SeoDashboardSummary {
  kpis: SeoDashboardKpi[];
  systemStatuses: SeoDashboardSystemStatus[];
  attentionItems: SeoDashboardAttentionItem[];
}

/** @deprecated Используйте `SeoSystemStatusLevel` */
export type SystemStatusLevel = SeoSystemStatusLevel;
