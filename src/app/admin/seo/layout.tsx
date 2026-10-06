import { SeoLayoutHeader } from "@/components/admin/seo/SeoLayoutHeader";
import {
  formatSeoGeoContextBreadcrumb,
} from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

/**
 * Каркас SEO: продуктовая навигация + Geo SEO Context (не на settings/**).
 */
export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { catalog, context, token } = await resolveSeoGeoSession();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SeoLayoutHeader
        token={token}
        breadcrumb={formatSeoGeoContextBreadcrumb(context)}
        options={catalog.options}
      />

      <div className="min-w-0">{children}</div>
    </div>
  );
}
