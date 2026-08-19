/**
 * Точки входа данных SEO Control Center.
 * Возвращают реальные данные, а для неподключённых агрегатов — честные пустые состояния.
 */
import type {
  ManualRedirect,
  RedirectDisposition,
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
} from "../domain/types";
import {
  getGlobalNoindexReason,
  isGlobalNoindexEnabled,
} from "@/lib/seo/globalNoindex";
import prisma from "@/lib/prisma";
import {
  classifyRedirectManifest,
  loadWpRedirectManifestEntries,
  type ClassifiedRedirectEntry,
} from "@/lib/seo/redirectManifestClassifier";
import {
  getAdminPagination,
  type AdminPaginationResult,
} from "@/lib/admin/pagination";

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

export interface RedirectCenterQuery {
  /** Matches against source or destination, case-insensitive substring. */
  search?: string;
  /** A single disposition, or "ALL" (default). */
  filter?: RedirectDisposition | "ALL";
  page?: number;
}

export interface RedirectCenterSummary {
  /** Total rows in the migration manifest (scripts/data/wp-redirect-map.json). */
  systemTotal: number;
  /** Manual (admin-created) redirects — 0 today; no persisted admin create/update flow exists. */
  manualCount: number;
  counts: Record<RedirectDisposition, number>;
}

export interface RedirectCenterData {
  automatic: RedirectRule[];
  automaticPagination: AdminPaginationResult;
  manual: ManualRedirect[];
  summary: RedirectCenterSummary;
}

function toRedirectRule(entry: ClassifiedRedirectEntry): RedirectRule {
  return {
    id: entry.source,
    fromUrl: entry.source,
    toUrl: entry.destination,
    ruleType: "legacy_migration",
    source: "wp-redirect-map.json",
    enabled: true,
    status: "active",
    lastCheckedAt: null,
    disposition: entry.disposition,
    resolvedTable: entry.resolvedTable,
  };
}

/**
 * Reads the same build-time migration redirect manifest next.config.ts
 * consumes (via scripts/data/wp-redirect-map.json -> manifest.csv ->
 * src/lib/seo/redirectManifest.ts) and classifies it with the shared
 * engine also used by scripts/validate-redirect-map.ts — one
 * classification implementation, two consumers, so the admin view can
 * never drift from the CLI diagnostic or from the actual runtime
 * redirects. No second source of truth: this reads the manifest and the
 * live DB directly, it does not persist anything.
 *
 * "Manual" redirects have no DB model yet (checked: only MigrationRedirect
 * exists in schema.prisma, and nothing writes to it) — returns an empty
 * array rather than inventing storage for it in this pass.
 */
export async function getRedirectCenterData(
  query: RedirectCenterQuery = {},
): Promise<RedirectCenterData> {
  const manifest = loadWpRedirectManifestEntries();
  const classification = await classifyRedirectManifest(prisma, manifest);
  return buildRedirectCenterData(classification, query);
}

export function buildRedirectCenterData(
  classification: Awaited<ReturnType<typeof classifyRedirectManifest>>,
  query: RedirectCenterQuery = {},
  manual: ManualRedirect[] = [],
): RedirectCenterData {
  const search = query.search?.trim().toLowerCase();
  const filter = query.filter ?? "ALL";

  let filtered = classification.entries;
  if (filter !== "ALL") {
    filtered = filtered.filter((e) => e.disposition === filter);
  }
  if (search) {
    filtered = filtered.filter(
      (e) => e.source.toLowerCase().includes(search) || e.destination.toLowerCase().includes(search),
    );
  }

  const pagination = getAdminPagination({ page: query.page ?? 1, total: filtered.length });
  const pageEntries = filtered.slice(pagination.skip, pagination.skip + pagination.take);

  return {
    automatic: pageEntries.map(toRedirectRule),
    automaticPagination: pagination,
    manual,
    summary: {
      systemTotal: classification.total,
      manualCount: manual.length,
      counts: classification.counts,
    },
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
