import { SeoPagesClient } from "@/components/admin/seo/SeoPagesClient";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { getSeoPages } from "@/lib/admin/seo/data/seoAdminData";
import {
  filterPagesByGeoContext,
  formatSeoGeoContextBreadcrumb,
} from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

export default async function AdminSeoPagesPage() {
  const { context } = await resolveSeoGeoSession();
  const allRows = await getSeoPages();
  const rows = filterPagesByGeoContext(allRows, context);

  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Страницы"
        subtitle={`SEO существующих страниц · ${formatSeoGeoContextBreadcrumb(context)}`}
      />
      <SeoPagesClient initialRows={rows} />
    </div>
  );
}
