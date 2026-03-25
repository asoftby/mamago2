/**
 * Точки входа данных SEO Control Center.
 * Сейчас возвращают моки; замените тело на `fetch` / RPC к бэкенду.
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
  const { MOCK_SEO_DASHBOARD_SUMMARY } = await import("../mocks/dashboard");
  return MOCK_SEO_DASHBOARD_SUMMARY;
}

export async function getSeoPages(): Promise<SeoPage[]> {
  const { MOCK_SEO_PAGES } = await import("../mocks/pages");
  return MOCK_SEO_PAGES;
}

export async function getRedirectCenterData(): Promise<{
  automatic: RedirectRule[];
  manual: ManualRedirect[];
  unmatched: UnmatchedUrl[];
}> {
  const m = await import("../mocks/redirects");
  return {
    automatic: m.MOCK_AUTOMATIC_REDIRECTS,
    manual: m.MOCK_MANUAL_REDIRECTS,
    unmatched: m.MOCK_UNMATCHED_URLS,
  };
}

export async function getSeoTemplates(): Promise<SeoTemplate[]> {
  const { MOCK_SEO_TEMPLATES } = await import("../mocks/templates");
  return MOCK_SEO_TEMPLATES;
}

export async function getStructuredDataCenterData(): Promise<{
  overviewCards: SchemaOverviewCard[];
  templates: SchemaTemplate[];
  validation: SchemaValidationIssue[];
}> {
  const m = await import("../mocks/schema");
  return {
    overviewCards: m.MOCK_SCHEMA_OVERVIEW_CARDS,
    templates: m.MOCK_SCHEMA_TEMPLATES,
    validation: m.MOCK_SCHEMA_VALIDATION,
  };
}

export async function getSitemapRobotsData(): Promise<{
  status: SitemapStatusSnapshot;
  sections: SitemapSectionStatus[];
  robots: RobotsIndexationSettings;
}> {
  const m = await import("../mocks/sitemap");
  return {
    status: m.MOCK_SITEMAP_STATUS,
    sections: m.MOCK_SITEMAP_SECTIONS,
    robots: m.MOCK_ROBOTS_SETTINGS,
  };
}
