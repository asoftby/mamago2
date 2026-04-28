"use client";

/**
 * Хедер для viewport **&lt; lg**.
 * Поисковая точка входа — как на discovery.
 * Иконка фильтров скрыта на посадочных маршрутах (`getSiteHeaderVariant` === `landing`), на витринах — как раньше.
 */
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import {
  getIntentFromPath,
  getCityFromPath,
  getDiscoveryIntentForPublicationPath,
  isCityHubPath,
  isPublicationDetailPath,
} from "@/lib/intent";
import { useCity } from "@/contexts/CityContext";
import { usePublicationIntent } from "@/contexts/PublicationIntentContext";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { getSiteHeaderVariant } from "@/lib/site/siteHeaderVariant";
import { OPEN_MOBILE_SEARCH_EVENT } from "@/lib/mobile/openMobileSearchEvent";

export function MobileHeader() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const siteHeaderVariant = getSiteHeaderVariant(pathname);
  const isScrolled = useHeaderScrolled(50);

  const routeIntent = getIntentFromPath(pathname);
  const publicationIntent = usePublicationIntent();
  const isPublicationPage = isPublicationDetailPath(pathname);
  /** Intent из pathname, чтобы SSR и первый клиентский кадр совпадали (контекст публикации заполняется позже в useEffect). */
  const intentFromPathForPublication = getDiscoveryIntentForPublicationPath(pathname);
  const searchIntent =
    routeIntent ?? publicationIntent ?? intentFromPathForPublication ?? null;
  const currentCity = getCityFromPath(pathname);
  const { citySlug } = useCity();
  const isCityHubRoute = isCityHubPath(pathname);

  const displayCity = citySlug;
  /** На главной города (`/minsk`) в URL нет раздела — не подсвечиваем «Куда пойти». */
  const displayIntent = searchIntent ?? (isCityHubRoute ? undefined : "kuda");

  const isDiscoveryPage = searchIntent !== null && currentCity !== null;
  const intentConfig = searchIntent
    ? DISCOVERY_INTENT_CONFIG[searchIntent]
    : null;

  const cityHubOnly = isPublicationPage;

  useEffect(() => {
    const open = () => setIsSearchSheetOpen(true);
    window.addEventListener(OPEN_MOBILE_SEARCH_EVENT, open);
    return () => window.removeEventListener(OPEN_MOBILE_SEARCH_EVENT, open);
  }, []);

  return (
    <>
      <header
        data-header-shell
        className={cn(
          // На страницах событий хедер не sticky на мобильном тоже
          isPublicationPage ? "relative z-50 w-full" : "sticky top-0 z-50 w-full",
          "border-b border-[#EBEBEB] bg-gradient-to-b from-white to-[#F7F7F7] text-foreground antialiased transition-shadow duration-200",
          isScrolled && "shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
        )}
      >
        <div className="mx-auto w-full">
          <div className="px-4 pt-4 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">
                <MobileSearchEntry
                  cityHubOnly={cityHubOnly}
                  showSectionIcon={isPublicationPage}
                  showTapToSelectHint={false}
                  onSearchClick={() => setIsSearchSheetOpen(true)}
                  citySlug={displayCity}
                  currentIntent={displayIntent}
                />
              </div>

              {siteHeaderVariant !== "landing" &&
                isDiscoveryPage &&
                intentConfig?.hasFilters &&
                searchIntent && (
                  <MobileFilterButton intent={searchIntent} />
                )}
            </div>
          </div>
        </div>
      </header>

      <MobileSearchSheet
        isOpen={isSearchSheetOpen}
        onClose={() => setIsSearchSheetOpen(false)}
        citySlug={displayCity}
        currentIntent={displayIntent}
        cityHubOnly={cityHubOnly}
      />
    </>
  );
}
