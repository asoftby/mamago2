/**
 * Точки входа данных SEO-раздела.
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
import { buildAdminPath } from "@/lib/routing/surface";
import type { SeoGeoContext } from "@/lib/admin/seo/geo";
import { filterPagesByGeoContext } from "@/lib/admin/seo/geo";
import type { SeoPageIndexationStatus, SeoPageType } from "../domain/types";
import {
  parseSeoPagesPageSize,
  SEO_PAGES_DEFAULT_PAGE_SIZE,
  type SeoPagesPageSize,
} from "@/lib/admin/seoNavConfig";

function hasMissingSeoFields(row: SeoPage): boolean {
  const titleEmpty = !row.title?.trim();
  const descEmpty = !row.description?.trim();
  const h1Empty = !row.h1?.trim();
  return titleEmpty || descEmpty || h1Empty;
}

export function buildSeoDashboardSummaryFromPages(
  pages: SeoPage[],
): SeoDashboardSummary {
  const pagesPath = buildAdminPath("/seo/pages");
  const withIssues = pages.filter(
    (p) => (p.entityDiagnostics?.issues.length ?? 0) > 0,
  );
  const noindex = pages.filter((p) => p.indexationStatus === "noindex");
  const draft = pages.filter((p) => p.indexationStatus === "draft");
  const missingSeo = pages.filter(hasMissingSeoFields);

  const stats = [
    {
      id: "pagesTotal" as const,
      label: "Страницы",
      value: pages.length,
      hint: "В выбранном SEO-контексте",
      href: pagesPath,
    },
    {
      id: "pagesWithIssues" as const,
      label: "С проблемами",
      value: withIssues.length,
      hint: "Диагностика URL / slug / canonical",
      href: pagesPath,
    },
    {
      id: "pagesNoindex" as const,
      label: "noindex",
      value: noindex.length,
      hint: "Закрыты от индексации",
      href: pagesPath,
    },
    {
      id: "pagesMissingSeo" as const,
      label: "Без SEO-полей",
      value: missingSeo.length,
      hint: "Пустые title, description или H1",
      href: pagesPath,
    },
    {
      id: "pagesDraft" as const,
      label: "Черновики",
      value: draft.length,
      hint: "Ещё не опубликованы",
      href: pagesPath,
    },
  ];

  const attentionItems: SeoDashboardSummary["attentionItems"] = [];

  if (withIssues.length > 0) {
    attentionItems.push({
      id: "diag-issues",
      title: `${withIssues.length} страниц с проблемами диагностики`,
      detail: "Проверьте slug, canonical и public URL",
      severity: withIssues.some((p) =>
        (p.entityDiagnostics?.issues ?? []).some((i) =>
          i.toLowerCase().includes("критично"),
        ),
      )
        ? "high"
        : "medium",
      href: pagesPath,
    });
  }

  if (missingSeo.length > 0) {
    attentionItems.push({
      id: "missing-seo",
      title: `${missingSeo.length} страниц с незаполненными SEO-полями`,
      detail: "Добавьте title, description или H1",
      severity: "medium",
      href: pagesPath,
    });
  }

  if (isGlobalNoindexEnabled()) {
    attentionItems.push({
      id: "global-noindex",
      title: "Глобальный noindex включён",
      detail: getGlobalNoindexReason() || "Сайт закрыт от индексации через env",
      severity: "high",
      href: buildAdminPath("/seo/settings/indexation"),
    });
  }

  return {
    stats,
    attentionItems,
    externalSourcesConnected: false,
  };
}

export async function getSeoDashboardSummary(
  geoContext?: SeoGeoContext,
): Promise<SeoDashboardSummary> {
  const allPages = await getSeoPages();
  const pages = geoContext
    ? filterPagesByGeoContext(allPages, geoContext)
    : allPages;
  return buildSeoDashboardSummaryFromPages(pages);
}

export async function getSeoPages(): Promise<SeoPage[]> {
  const { getAllEntitySeoPages } = await import("./getEntitySeoPages");
  return getAllEntitySeoPages();
}

export type SeoPagesListQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: SeoPageType | "all";
  indexation?: SeoPageIndexationStatus | "all";
};

export type SeoPagesListResult = {
  items: SeoPage[];
  pagination: AdminPaginationResult;
  filters: {
    q: string;
    type: SeoPageType | "all";
    indexation: SeoPageIndexationStatus | "all";
    pageSize: SeoPagesPageSize;
  };
};

export function matchesSeoPageSearch(row: SeoPage, q: string): boolean {
  if (!q.trim()) return true;
  const x = q.trim().toLowerCase();
  const slug = row.path.split("/").filter(Boolean).pop() ?? "";
  const d = row.entityDiagnostics;
  return (
    row.path.toLowerCase().includes(x) ||
    row.h1.toLowerCase().includes(x) ||
    row.title.toLowerCase().includes(x) ||
    slug.toLowerCase().includes(x) ||
    row.id.toLowerCase().includes(x) ||
    Boolean(
      d &&
        (d.entityId.toLowerCase().includes(x) ||
          (d.slug ?? "").toLowerCase().includes(x) ||
          d.entityTitle.toLowerCase().includes(x) ||
          (d.citySlug ?? "").toLowerCase().includes(x)),
    )
  );
}

/**
 * In-memory pagination helper for contract tests (and overview-style aggregates).
 * Production SEO Pages list uses bounded provider count/list APIs instead.
 */
export function buildSeoPagesListResult(
  allRows: SeoPage[],
  geoContext: SeoGeoContext,
  query: SeoPagesListQuery = {},
): SeoPagesListResult {
  const q = query.q?.trim() ?? "";
  const type = query.type ?? "all";
  const indexation = query.indexation ?? "all";
  const pageSize = parseSeoPagesPageSize(
    query.pageSize != null ? String(query.pageSize) : null,
  );

  let filtered = filterPagesByGeoContext(allRows, geoContext);
  if (type !== "all") {
    filtered = filtered.filter((row) => row.type === type);
  }
  if (indexation !== "all") {
    filtered = filtered.filter((row) => row.indexationStatus === indexation);
  }
  if (q) {
    filtered = filtered.filter((row) => matchesSeoPageSearch(row, q));
  }

  const pagination = getAdminPagination({
    page: query.page ?? 1,
    total: filtered.length,
    pageSize,
  });
  const items = filtered.slice(pagination.skip, pagination.skip + pagination.take);

  return {
    items,
    pagination,
    filters: { q, type, indexation, pageSize },
  };
}

/**
 * Bounded SEO Pages listing: provider countRows + listRowsPage with
 * registry-order concat windows (event→place→offer→route→article).
 * Does not materialize the full catalog for a single page request.
 */
export async function getSeoPagesList(
  geoContext: SeoGeoContext,
  query: SeoPagesListQuery = {},
): Promise<SeoPagesListResult> {
  const { countEntityRows, listEntityRowsPage } = await import(
    "@/lib/admin/seo/entities/service"
  );
  const q = query.q?.trim() ?? "";
  const type = query.type ?? "all";
  const indexation = query.indexation ?? "all";
  const pageSize = parseSeoPagesPageSize(
    query.pageSize != null ? String(query.pageSize) : null,
  );
  const filters = {
    geoContext,
    q: q || undefined,
    indexation,
  };

  const counted = await countEntityRows({ filters, type });
  const pagination = getAdminPagination({
    page: query.page ?? 1,
    total: counted.total,
    pageSize,
  });

  const pagePass = await listEntityRowsPage({
    filters,
    type,
    skip: pagination.skip,
    take: pagination.take,
    counts: counted.counts,
    providers: counted.providers,
  });

  return {
    items: pagePass.rows,
    pagination,
    filters: { q, type, indexation, pageSize },
  };
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
        "Глобальная индексация управляется через env. UI в админке отображает текущее состояние.",
      globalNoindexEnabled,
      globalNoindexReason,
      controlsManagedBy: "env",
    },
  };
}
