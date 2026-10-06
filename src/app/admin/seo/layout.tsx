import { SeoSubNav } from "@/components/admin/seo/SeoSubNav";
import { SeoGeoContextSelector } from "@/components/admin/seo/SeoGeoContextSelector";
import {
  formatSeoGeoContextBreadcrumb,
} from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

/**
 * Каркас SEO: продуктовая навигация + Geo SEO Context.
 */
export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { catalog, context, token } = await resolveSeoGeoSession();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="space-y-4 border-b border-gray-200 pb-4">
        <SeoSubNav />
        <SeoGeoContextSelector
          token={token}
          breadcrumb={formatSeoGeoContextBreadcrumb(context)}
          options={catalog.options}
        />
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
