"use client";

import { useCity } from "@/contexts/CityContext";
import { HeaderDiscoveryFiltersProvider } from "@/features/filters/discovery/headerDiscoveryFiltersContext";
import { DesktopHeader } from "./DesktopHeader";
import { MobileHeader } from "./MobileHeader";

/**
 * Два независимых хедера по breakpoint `lg` (без общего `landing` на mobile).
 * @see DesktopHeader — посадочные страницы без поисковой строки
 * @see MobileHeader — всегда discovery-UX (поиск + фильтры)
 *
 * Один {@link HeaderDiscoveryFiltersProvider} на город — без дублирующих geo-fetch
 * между desktop/mobile деревьями (`hidden lg:contents` / `contents lg:hidden`).
 */
export function SiteHeader() {
  const { citySlug } = useCity();

  return (
    <HeaderDiscoveryFiltersProvider citySlug={citySlug}>
      <div className="m-0 hidden p-0 lg:contents">
        <DesktopHeader />
      </div>
      <div className="contents lg:hidden">
        <MobileHeader />
      </div>
    </HeaderDiscoveryFiltersProvider>
  );
}
