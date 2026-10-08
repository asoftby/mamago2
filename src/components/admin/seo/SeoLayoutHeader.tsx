"use client";

import { usePathname } from "next/navigation";
import { SeoSubNav } from "@/components/admin/seo/SeoSubNav";
import { SeoGeoContextSelector } from "@/components/admin/seo/SeoGeoContextSelector";
import { shouldShowSeoGeoContextSelector } from "@/lib/admin/seoNavConfig";
import type { SeoGeoSelectorOption } from "@/lib/admin/seo/geo";
import type { SeoMarketViewScope } from "@/lib/admin/seo/geo/seoMarket";

type SeoLayoutHeaderProps = {
  token: string;
  marketLabel: string;
  cityName: string | null;
  regionName: string | null;
  viewScope: SeoMarketViewScope;
  supportsMarketScopes: boolean;
  options: SeoGeoSelectorOption[];
};

export function SeoLayoutHeader({
  token,
  marketLabel,
  cityName,
  regionName,
  viewScope,
  supportsMarketScopes,
  options,
}: SeoLayoutHeaderProps) {
  const pathname = usePathname();
  const showGeo = shouldShowSeoGeoContextSelector(pathname);

  return (
    <header className="space-y-4 pb-4">
      <SeoSubNav />
      {showGeo ? (
        <SeoGeoContextSelector
          token={token}
          marketLabel={marketLabel}
          cityName={cityName}
          regionName={regionName}
          viewScope={viewScope}
          supportsMarketScopes={supportsMarketScopes}
          options={options}
        />
      ) : null}
    </header>
  );
}
