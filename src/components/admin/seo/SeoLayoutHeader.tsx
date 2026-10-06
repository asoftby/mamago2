"use client";

import { usePathname } from "next/navigation";
import { SeoSubNav } from "@/components/admin/seo/SeoSubNav";
import { SeoGeoContextSelector } from "@/components/admin/seo/SeoGeoContextSelector";
import { shouldShowSeoGeoContextSelector } from "@/lib/admin/seoNavConfig";
import type { SeoGeoSelectorOption } from "@/lib/admin/seo/geo";

type SeoLayoutHeaderProps = {
  token: string;
  breadcrumb: string;
  options: SeoGeoSelectorOption[];
};

/**
 * Product SEO pages show Geo Context; global settings must not imply city filtering.
 */
export function SeoLayoutHeader({
  token,
  breadcrumb,
  options,
}: SeoLayoutHeaderProps) {
  const pathname = usePathname();
  const showGeo = shouldShowSeoGeoContextSelector(pathname);

  return (
    <header className="space-y-4 border-b border-gray-200 pb-4">
      <SeoSubNav />
      {showGeo ? (
        <SeoGeoContextSelector
          token={token}
          breadcrumb={breadcrumb}
          options={options}
        />
      ) : null}
    </header>
  );
}
