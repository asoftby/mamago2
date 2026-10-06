import { SeoPagesClient } from "@/components/admin/seo/SeoPagesClient";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { getSeoPagesList } from "@/lib/admin/seo/data/seoAdminData";
import { formatSeoGeoContextBreadcrumb } from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
import { firstSearchParam } from "@/lib/admin/firstSearchParam";
import { parseAdminPage } from "@/lib/admin/pagination";
import { parseSeoPagesPageSize } from "@/lib/admin/seoNavConfig";
import type {
  SeoPageIndexationStatus,
  SeoPageType,
} from "@/lib/admin/seo/domain/types";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = new Set<SeoPageType>([
  "event",
  "place",
  "offer",
  "route",
  "article",
]);

const INDEXATION = new Set<SeoPageIndexationStatus>([
  "indexed",
  "noindex",
  "draft",
]);

interface PageProps {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
    type?: string | string[];
    indexation?: string | string[];
  }>;
}

export default async function AdminSeoPagesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const { context } = await resolveSeoGeoSession();

  const pageRaw = firstSearchParam(raw.page);
  const pageSizeRaw = firstSearchParam(raw.pageSize);
  const q = firstSearchParam(raw.q);
  const typeRaw = firstSearchParam(raw.type);
  const indexationRaw = firstSearchParam(raw.indexation);

  const type =
    typeRaw && ENTITY_TYPES.has(typeRaw as SeoPageType)
      ? (typeRaw as SeoPageType)
      : "all";
  const indexation =
    indexationRaw && INDEXATION.has(indexationRaw as SeoPageIndexationStatus)
      ? (indexationRaw as SeoPageIndexationStatus)
      : "all";

  const list = await getSeoPagesList(context, {
    page: parseAdminPage(pageRaw),
    pageSize: parseSeoPagesPageSize(pageSizeRaw),
    q,
    type,
    indexation,
  });

  const currentParams: Record<string, string | undefined> = {
    ...(q ? { q } : {}),
    ...(type !== "all" ? { type } : {}),
    ...(indexation !== "all" ? { indexation } : {}),
    pageSize: String(list.filters.pageSize),
  };

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Страницы"
        subtitle={`SEO существующих страниц · ${formatSeoGeoContextBreadcrumb(context)}`}
      />
      <SeoPagesClient
        initialRows={list.items}
        pagination={list.pagination}
        filters={list.filters}
        currentParams={currentParams}
      />
    </div>
  );
}
