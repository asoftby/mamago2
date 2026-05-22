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
import {
  getGlobalNoindexReason,
  isGlobalNoindexEnabled,
} from "@/lib/seo/globalNoindex";

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
  const globalNoindexEnabled = isGlobalNoindexEnabled();
  const globalNoindexReason = getGlobalNoindexReason();
  const noindexEnvironments = [
    process.env.APP_ENV?.trim(),
    process.env.VERCEL_ENV?.trim(),
    process.env.NODE_ENV?.trim(),
  ].filter((value): value is string => Boolean(value));

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
      allowIndexing: !globalNoindexEnabled,
      noindexEnvironments,
      robotsStatus: "ok",
      futureControlsNote:
        "На текущем этапе глобальная индексация управляется через env. UI в админке пока только отображает состояние.",
      globalNoindexEnabled,
      globalNoindexReason,
      controlsManagedBy: "env",
    },
  };
}
