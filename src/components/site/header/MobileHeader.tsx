"use client";

/**
 * Хедер для viewport **< lg** — одна строка (48px).
 * Discovery: лого/«←» · чип «🧭 Минск · Я и Степан» (вход в поиск) · 🔔 · 👤. Кнопка ⚙ фильтров — в строке заголовка раздела.
 * Landing (посадочные): «←» · ♡ · поделиться · 🔔 · 👤.
 * Скролл вниз → хедер уезжает через transform (без layout shift), скролл вверх → возвращается.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { NavIconButton } from "@/components/mobile/NavIconButton";
import { MOBILE_HEADER_ROW_HEIGHT } from "@/components/mobile/mobile-control-geometry";
import {
  getIntentFromPath,
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
          className={cn("flex min-w-0 items-center gap-2 px-3", MOBILE_HEADER_ROW_HEIGHT)}
        >
          {leading}
          {isLanding ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <MobileLandingActions />
              <MobileHeaderActions />
            </div>
          ) : (
            <>
              <MobileSearchEntry
                variant="chip"
                cityHubOnly={cityHubOnly}
                onSearchClick={() => setIsSearchSheetOpen(true)}
                citySlug={displayCity}
                currentIntent={displayIntent}
                locationLabelOverride={articleGeoLabel}
                className="!h-11"
              />
              <MobileHeaderActions />
            </>
          )}
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
