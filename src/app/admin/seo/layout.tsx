import { SeoLayoutHeader } from "@/components/admin/seo/SeoLayoutHeader";
import { resolveSeoMarketSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

/**
 * Каркас SEO: продуктовая навигация + SEO-рынок (не на settings/**).
 */
export default async function SeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSeoMarketSession();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SeoLayoutHeader
        token={session.token}
        marketLabel={session.presentation.marketLabel}
        cityName={session.presentation.cityName}
        regionName={session.presentation.regionName}
        viewScope={session.viewScope}
        supportsMarketScopes={session.presentation.supportsMarketScopes}
        options={session.catalog.options}
      />

      <div className="min-w-0">{children}</div>
    </div>
  );
}
