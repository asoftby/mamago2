/**
 * Точки входа данных SEO Control Center.
 * Возвращают реальные данные, а для неподключённых агрегатов — честные пустые состояния.
 */
import type {
  ManualRedirect,
  RedirectRule,
  RobotsIndexationSettings,
  SchemaOverviewCard,
  SchemaTemplate,
  SchemaValidationIssue,
  SeoDashboardSummary,
  SeoPage,
  SeoTemplate,
  SitemapSectionStatus,
  SitemapStatusSnapshot,
  UnmatchedUrl,
} from "../domain/types";

export async function getSeoDashboardSummary(): Promise<SeoDashboardSummary> {
  return {
    kpis: [],
    systemStatuses: [],
    attentionItems: [],
  };
}

export async function getSeoPages(): Promise<SeoPage[]> {
  const { getAllEntitySeoPages } = await import("./getEntitySeoPages");
  return getAllEntitySeoPages();
}

export async function getRedirectCenterData(): Promise<{
  automatic: RedirectRule[];
  manual: ManualRedirect[];
  unmatched: UnmatchedUrl[];
}> {
  return {
    automatic: [],
    manual: [],
    unmatched: [],
  };
}

export async function getSeoTemplates(): Promise<SeoTemplate[]> {
  return [];
}

export async function getStructuredDataCenterData(): Promise<{
  overviewCards: SchemaOverviewCard[];
  templates: SchemaTemplate[];
  validation: SchemaValidationIssue[];
}> {
  return {
    overviewCards: [],
    templates: [],
    validation: [],
  };
}

export async function getSitemapRobotsData(): Promise<{
  status: SitemapStatusSnapshot;
  sections: SitemapSectionStatus[];
  robots: RobotsIndexationSettings;
}> {
  return {
    status: {
      sitemapUrl: "/sitemap.xml",
      lastGeneratedAt: "",
      indexedPagesCount: 0,
      includedSectionsSummary: [],
      regenerationStatus: "idle",
    },
    sections: [],
    robots: {
      allowIndexing: true,
      noindexEnvironments: ["development", "preview"],
      robotsStatus: "missing",
      futureControlsNote: "Настройки robots будут загружаться из реального сервиса.",
    },
  };
}
