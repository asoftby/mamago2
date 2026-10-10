"use client";

/**
 * Хедер для viewport **< lg**.
 * Discovery: два ряда. Ряд 1 (48px) — лого/«←» слева, 🔔 и 👤 справа; ряд 2 — плашка поиска
 * «Куда сходить?» (+ ⚙ фильтры на категориях). Landing (посадочные): один ряд — «←», ♡, поделиться, 🔔, 👤.
 * Скролл вниз → ряд 1 уезжает через transform (без layout shift), ряд 2 остаётся прилипшим;
 * скролл вверх → возвращается. На landing при скролле вниз уезжает весь хедер.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import { NavIconButton } from "@/components/mobile/NavIconButton";
import {
  MOBILE_HEADER_ROW1_COLLAPSE,
  MOBILE_HEADER_ROW_HEIGHT,
} from "@/components/mobile/mobile-control-geometry";
import {
  getIntentFromPath,
  getCityFromPath,
  getDiscoveryIntentForPublicationPath,
  getDiscoveryIntentForMePath,
  isCityHubPath,
  isPublicationDetailPath,
  isJournalPath,
} from "@/lib/intent";
import { getSiteHeaderVariant } from "@/lib/site/siteHeaderVariant";
import { useCity } from "@/contexts/CityContext";
import { usePublicationIntent } from "@/contexts/PublicationIntentContext";
import { useArticleGeoLabel } from "@/contexts/ArticleGeoLabelContext";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useBranding } from "@/contexts/BrandingContext";
import { OPEN_MOBILE_SEARCH_EVENT } from "@/lib/mobile/openMobileSearchEvent";
import { OPEN_PUBLIC_SEARCH_EVENT } from "@/lib/search/openPublicSearchEvent";
import { MobileHeaderActions } from "./MobileHeaderActions";
import { MobileHeaderBackButton } from "./MobileHeaderBackButton";
import { MobileLandingActions } from "./MobileLandingActions";

const HEADER_BG = "bg-[#F6F2EA]";

export function MobileHeader() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const isScrolled = useHeaderScrolled(50);
  const { logoUrl } = useBranding();
  const row1Ref = useRef<HTMLDivElement>(null);
  /** Не сворачиваем ряд, пока на нём клавиатурный фокус (иначе фокус «теряется» под inert). */
  const isRow1KeyboardFocused = useCallback(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLElement &&
      !!row1Ref.current?.contains(active) &&
      active.matches(":focus-visible")
    );
  }, []);
  const collapsed = useScrollDirection({ isLocked: isRow1KeyboardFocused, resetKey: pathname });

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
  const isLanding = getSiteHeaderVariant(pathname) === "landing";
  /** Корневые страницы города (хаб, витрины, подборки) — лого; внутренние — «←». */
  const isRootPage = !isLanding && pathname.split("/").filter(Boolean).length <= 2;
  const homeHref = `/${displayCity}`;

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

  const leading = isRootPage ? (
    <NavIconButton
      href={homeHref}
      isActive={false}
      ariaLabel="На главную"
      isHomeLogo
      logoSrc={logoUrl ?? undefined}
      chrome="dark"
      size="compact"
      className="border-2 border-white bg-white shadow-none"
      onClick={(event) => {
        if (pathname !== homeHref) return;
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    />
  ) : (
    <MobileHeaderBackButton fallbackHref={homeHref} />
  );

  return (
    <>
      {isLanding ? (
        <header
          data-header-shell
          inert={collapsed}
          className={cn(
            "sticky top-0 z-50 w-full border-b border-[#EBEBEB] pt-[env(safe-area-inset-top)] text-foreground antialiased",
            HEADER_BG,
            "transition-[transform,box-shadow] duration-[220ms] ease-out motion-reduce:transition-none",
            collapsed && "-translate-y-full",
            isScrolled && !collapsed && "shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
          )}
        >
          <div
            ref={row1Ref}
            className={cn("flex min-w-0 items-center justify-between gap-2 px-3", MOBILE_HEADER_ROW_HEIGHT)}
          >
            {leading}
            <div className="flex shrink-0 items-center gap-2">
              <MobileLandingActions />
              <MobileHeaderActions />
            </div>
          </div>
        </header>
      ) : (
        <header
          data-header-shell
          className="pointer-events-none sticky top-0 z-50 w-full pt-[env(safe-area-inset-top)] text-foreground antialiased"
        >
          {/* Зона под вырезом/статус-баром не двигается: ряд 1 уезжает под неё. */}
          <div
            aria-hidden
            className={cn("pointer-events-auto absolute inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)]", HEADER_BG)}
          />
          <div
            className={cn(
              "pointer-events-auto transform-gpu transition-transform duration-[220ms] ease-out motion-reduce:transition-none",
              collapsed && MOBILE_HEADER_ROW1_COLLAPSE,
            )}
          >
            <div
              ref={row1Ref}
              inert={collapsed}
              className={cn(
                "flex min-w-0 items-center justify-between gap-2 px-3",
                MOBILE_HEADER_ROW_HEIGHT,
                HEADER_BG,
              )}
            >
              {leading}
              <MobileHeaderActions />
            </div>
            <div
              className={cn(
                "flex min-w-0 items-center gap-2 border-b border-[#EBEBEB] px-3 py-1.5 transition-shadow duration-200 motion-reduce:transition-none",
                HEADER_BG,
                collapsed && "shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
              )}
            >
              <MobileSearchEntry
                variant="bar"
                cityHubOnly={cityHubOnly}
                onSearchClick={() => setIsSearchSheetOpen(true)}
                citySlug={displayCity}
                currentIntent={displayIntent}
                locationLabelOverride={articleGeoLabel}
              />
              {showFilterButton && searchIntent ? (
                <MobileFilterButton intent={searchIntent} className="h-11 w-11" />
              ) : null}
            </div>
          </div>
        </header>
      )}

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
