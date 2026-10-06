import { SeoPagesClient } from "@/components/admin/seo/SeoPagesClient";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { getSeoPagesList } from "@/lib/admin/seo/data/seoAdminData";
import { formatSeoGeoContextBreadcrumb } from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
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
    page?: string;
    pageSize?: string;
    q?: string;
    type?: string;
    indexation?: string;
  }>;
}

export default async function AdminSeoPagesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { context } = await resolveSeoGeoSession();

  const type =
    params.type && ENTITY_TYPES.has(params.type as SeoPageType)
      ? (params.type as SeoPageType)
      : "all";
  const indexation =
    params.indexation && INDEXATION.has(params.indexation as SeoPageIndexationStatus)
      ? (params.indexation as SeoPageIndexationStatus)
      : "all";

  const list = await getSeoPagesList(context, {
    page: parseAdminPage(params.page),
    pageSize: parseSeoPagesPageSize(params.pageSize),
    q: params.q,
    type,
    indexation,
  });

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
        currentParams={params}
      />
    </div>
  );
}
