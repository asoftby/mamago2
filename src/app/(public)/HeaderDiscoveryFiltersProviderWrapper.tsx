"use client";

import { useCity } from "@/contexts/CityContext";
import { HeaderDiscoveryFiltersProvider } from "@/features/filters/discovery/headerDiscoveryFiltersContext";
import type { ReactNode } from "react";

/**
 * Shared provider for geo-filters, placed above SiteHeader to avoid
 * double-fetching in desktop/mobile header variants.
 */
export function HeaderDiscoveryFiltersProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const { citySlug } = useCity();

  return (
    <HeaderDiscoveryFiltersProvider citySlug={citySlug}>
      {children}
    </HeaderDiscoveryFiltersProvider>
  );
}
