"use client";

/**
 * Хедер для viewport **< lg**.
 * Поисковая точка входа — как на discovery.
 * Одна строка: значок «Ma» → главная · контекст-чип (вход в поиск) · ⚙ фильтры (только на категориях).
 * 🔔 и 👤 живут в нижней панели (MobileBottomBar).
 * Прячется при скролле вниз, возвращается при скролле вверх.
 */
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import { NavIconButton } from "@/components/mobile/NavIconButton";
import { MOBILE_HEADER_ROW_HEIGHT } from "@/components/mobile/mobile-control-geometry";
import {
  getIntentFromPath,
  getCityFromPath,
  getDiscoveryIntentForPublicationPath,
  getDiscoveryIntentForMePath,
  isCityHubPath,
  isPublicationDetailPath,
  isNonStickyHeaderPath,
  isJournalPath,
} from "@/lib/intent";
import { getSiteHeaderVariant } from "@/lib/site/siteHeaderVariant";
import { useCity } from "@/contexts/CityContext";
import { usePublicationIntent } from "@/contexts/PublicationIntentContext";
import { useArticleGeoLabel } from "@/contexts/ArticleGeoLabelContext";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { useHideOnScrollDirection } from "@/hooks/useHideOnScrollDirection";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useBranding } from "@/contexts/BrandingContext";
import { OPEN_MOBILE_SEARCH_EVENT } from "@/lib/mobile/openMobileSearchEvent";
import { OPEN_PUBLIC_SEARCH_EVENT } from "@/lib/search/openPublicSearchEvent";

export function MobileHeader() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const isScrolled = useHeaderScrolled(50);
  const scrollHidden = useHideOnScrollDirection({ threshold: 8, topOffset: 24 });
  const { logoUrl } = useBranding();

  const routeIntent = getIntentFromPath(pathname);
  const publicationIntent = usePublicationIntent();
  const isPublicationPage = isPublicationDetailPath(pathname);
  /** Intent из pathname, чтобы SSR и первый клиентский кадр совпадали (контекст публикации заполняется позже в useEffect). */
  const intentFromPathForPublication = getDiscoveryIntentForPublicationPath(pathname);
  const intentFromMe = getDiscoveryIntentForMePath(pathname);
  const searchIntent =
    routeIntent ??
    publicationIntent ??
    intentFromPathForPublication ??
    intentFromMe ??
    null;
  const currentCity = getCityFromPath(pathname);
  const isJournalRoute = isJournalPath(pathname);
  const { citySlug } = useCity();
  const isCityHubRoute = isCityHubPath(pathname);
  /** REGION/COUNTRY статья на /blog/{slug} — там нет городского сегмента, citySlug ниже — не настоящая геопривязка. */
  const articleGeoLabel = useArticleGeoLabel();

  const displayCity = citySlug;
  /** На главной города (`/minsk`) в URL нет раздела — не подсвечиваем «Куда пойти». */
  const displayIntent = isJournalRoute
    ? "journal"
    : searchIntent ?? (isCityHubRoute ? undefined : "kuda");

  const isDiscoveryPage = searchIntent !== null && currentCity !== null;
  const showFilterButton =
    getSiteHeaderVariant(pathname) !== "landing" &&
    isDiscoveryPage &&
    !!searchIntent && DISCOVERY_INTENT_CONFIG[searchIntent].hasFilters;

  const cityHubOnly = isPublicationPage || isJournalRoute;
  const isSticky = !isNonStickyHeaderPath(pathname);

  useEffect(() => {
    const open = () => setIsSearchSheetOpen(true);
    const openPublicSearch = () => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      open();
    };

    window.addEventListener(OPEN_MOBILE_SEARCH_EVENT, open);
    window.addEventListener(OPEN_PUBLIC_SEARCH_EVENT, openPublicSearch);
    return () => {
      window.removeEventListener(OPEN_MOBILE_SEARCH_EVENT, open);
      window.removeEventListener(OPEN_PUBLIC_SEARCH_EVENT, openPublicSearch);
    };
  }, []);

  return (
    <>
      <header
        data-header-shell
        inert={isSticky && scrollHidden}
        className={cn(
          // На страницах событий и деталях маршрута хедер не sticky
          isSticky ? "sticky top-0 z-50 w-full" : "relative z-50 w-full",
          "border-b border-[#EBEBEB] bg-[#F6F2EA] pt-[env(safe-area-inset-top)] text-foreground antialiased",
          "transition-[transform,box-shadow] duration-200 ease-in-out motion-reduce:transition-none",
          isSticky && scrollHidden && "-translate-y-full",
          isScrolled && "shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-2 px-3", MOBILE_HEADER_ROW_HEIGHT)}>
          <NavIconButton
            href={`/${displayCity}`}
            isActive={false}
            ariaLabel="На главную"
            isHomeLogo
            logoSrc={logoUrl ?? undefined}
            chrome="dark"
            className="border-2 border-white bg-white shadow-[0_4px_14px_rgba(0,0,0,0.14)]"
          />
          <MobileSearchEntry
            variant="chip"
            cityHubOnly={cityHubOnly}
            onSearchClick={() => setIsSearchSheetOpen(true)}
            citySlug={displayCity}
            currentIntent={displayIntent}
            locationLabelOverride={articleGeoLabel}
          />
          {showFilterButton && searchIntent ? <MobileFilterButton intent={searchIntent} className="h-[52px] w-[52px]" /> : null}
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
