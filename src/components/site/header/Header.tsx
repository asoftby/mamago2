"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STABLE_HEADER_BLOCK1_DEFAULT_PX,
  STABLE_HEADER_BLOCK2_PX,
  useStableHeaderBehavior,
} from "@/hooks/useStableHeaderBehavior";
import {
  getIntentFromPath,
  getDiscoveryIntentForPublicationPath,
  isPublicationDetailPath,
} from "@/lib/intent";
import { getSiteHeaderVariant } from "@/lib/site/siteHeaderVariant";
import { useCity } from "@/contexts/CityContext";
import { usePublicationIntent } from "@/contexts/PublicationIntentContext";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { Button } from "@/components/ui/button";
import { SITE_CONTENT_CONTAINER_CLASS } from "@/components/ui/Container";
import { HeaderAccountMenu } from "@/components/site/header/HeaderAccountMenu";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { SearchOverlay } from "@/components/search/SearchOverlay";

/** Плавный кроссфейд табов ↔ компактной капсулы (без «мигания» пустым центром). */
const CENTER_EASE = [0.32, 0.72, 0, 1] as const;

/** Явный maxHeight — на iOS Safari `height: auto` у motion часто даёт рывок вместо анимации. */
const SEARCH_ROW_MAX_PX = STABLE_HEADER_BLOCK1_DEFAULT_PX + 120;

function searchRowTransition(reduceMotion: boolean | null) {
  const d = reduceMotion ? 0.01 : 0.4;
  return { duration: d, ease: CENTER_EASE };
}

/** Одна сетка для expanded/compact — иначе смена `grid-template-columns` даёт мгновенный reflow (заметно на iOS). */
const TOP_ROW_GRID_CLASS =
  "grid-cols-[minmax(0,1fr)_minmax(0,min(760px,100%))_minmax(0,1fr)]";

/** Внутренние отступы всего блока хедера (сверху и снизу). Должны совпадать с `style` на обёртке. */
const HEADER_INNER_PADDING_Y_PX = 8;
const HEADER_INNER_PADDING_TOTAL_PX = HEADER_INNER_PADDING_Y_PX * 2;

export const HEADER_TOP_ROW_PX = STABLE_HEADER_BLOCK2_PX;
export const HEADER_RESERVE_CLOSED_PX = STABLE_HEADER_BLOCK1_DEFAULT_PX;
export const HEADER_RESERVE_OPEN_PX =
  STABLE_HEADER_BLOCK2_PX +
  STABLE_HEADER_BLOCK1_DEFAULT_PX +
  HEADER_INNER_PADDING_TOTAL_PX;
export const HEADER_BAR_HEIGHT = STABLE_HEADER_BLOCK2_PX;
export const HEADER_HEIGHT_EXPANDED = HEADER_RESERVE_OPEN_PX;
export const HEADER_HEIGHT_COMPACT =
  STABLE_HEADER_BLOCK2_PX + HEADER_INNER_PADDING_TOTAL_PX;
export const HEADER_HEIGHT = STABLE_HEADER_BLOCK1_DEFAULT_PX;

/** Совпадает с обёрткой развёрнутой строки поиска (ниже). */
const HEADER_SEARCH_BAR_WRAP_CLASS = "w-full max-w-[760px]";

/**
 * Десктоп-хедер в стиле Airbnb (в потоке документа, не fixed):
 * - **По умолчанию у верха:** строка 1 — лого | навигация по разделам | поиск и меню; строка 2 — большая овальная строка поиска.
 * - **После скролла:** одна строка — лого | компактная капсула | поиск и меню.
 * - При открытой search surface — визуально усиленная строка поиска.
 */
export function SiteHeaderShell() {
  const pathname = usePathname();
  const headerVariant = getSiteHeaderVariant(pathname);
  const isLandingHeader = headerVariant === "landing";
  const routeIntent = getIntentFromPath(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const hb = useStableHeaderBehavior({
    scrollThreshold: 80,
    scrollHysteresisPx: 16,
    headerRef,
  });
  const centerFadeDuration = reduceMotion ? 0.01 : 0.34;
  const publicationIntent = usePublicationIntent();
  const isPublicationPage = isPublicationDetailPath(pathname);
  const searchIntent =
    routeIntent ??
    publicationIntent ??
    getDiscoveryIntentForPublicationPath(pathname) ??
    null;
  const tabsIntent = isPublicationPage ? null : routeIntent ?? null;
  const { citySlug } = useCity();
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const expandedSearchVariant =
    isPublicationPage ? "cityHub" : "discovery";
  const compactSearchVariant =
    isPublicationPage ? "cityHub" : "discovery";
  const shouldShowIntentTabs = true;
  const isCityHomePage =
    pathname === `/${citySlug}` || pathname === `/${citySlug}/`;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Home/Header] mounted", { pathname });
    }
    return () => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Home/Header] unmounted", { pathname });
      }
    };
  }, [pathname]);

  /** Вторая строка (сегментированный поиск): на посадочных не показываем. */
  const showExpandedSearchRow = !hb.showAirbnbCompactBar;

  const expandedSearchRowInner = (
    <div
      className={cn(
        SITE_CONTENT_CONTAINER_CLASS,
        "pb-3 pt-1",
      )}
    >
      <div className="flex justify-center">
        <div className={HEADER_SEARCH_BAR_WRAP_CLASS}>
          <DesktopSearchControl
            citySlug={citySlug}
            currentIntent={searchIntent}
            compactIconIntent={isPublicationPage ? searchIntent : null}
            mode="expanded"
            activePanel={hb.activePanel}
            onPanelChange={hb.actions.openPanel}
            onPanelClose={hb.actions.closePanel}
            renderPanels={true}
            variant={expandedSearchVariant}
            embeddedInHeader={!hb.showSearchSurface}
          />
        </div>
      </div>
    </div>
  );

  const intentTabsRow = (
    <div className="flex w-full min-w-0 max-w-3xl items-center justify-center">
      {shouldShowIntentTabs && citySlug ? (
        <DiscoveryIntentTabs
          city={citySlug}
          currentIntent={tabsIntent}
          variant="airbnb"
        />
      ) : (
        <div className="h-10 w-full" aria-hidden />
      )}
    </div>
  );

  return (
    <>
      <header
        ref={headerRef}
        data-header-shell
        className={cn(
          // На страницах событий хедер не sticky — не перекрывает контент при скролле
          isPublicationPage ? "relative z-50 m-0 w-full" : "sticky top-0 z-50 m-0 w-full",
          "bg-gradient-to-b from-white to-[#F7F7F7]",
          "border-b border-[#EBEBEB]",
          "transition-shadow duration-300 ease-out",
          hb.isScrolled ? "shadow-md" : "shadow-sm",
        )}
      >
        <div
          className="relative w-full"
          style={{
            paddingTop: HEADER_INNER_PADDING_Y_PX,
            paddingBottom: HEADER_INNER_PADDING_Y_PX,
          }}
        >
          {/* Верхняя строка: всегда */}
          <div
            data-header-chrome
            data-header-block2
            className="w-full shrink-0 bg-transparent"
          >
            <div
              className={cn(
                SITE_CONTENT_CONTAINER_CLASS,
                "grid h-20 items-center gap-x-2 md:gap-x-4",
                TOP_ROW_GRID_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center justify-self-start">
                {isCityHomePage ? (
                  <span
                    className="flex shrink-0 items-center rounded-lg p-0.5"
                    aria-label="MamaGo"
                  >
                    <Image
                      src="/favico_mamago.webp"
                      alt="MamaGo"
                      width={100}
                      height={100}
                      priority
                      className="h-8 w-auto md:h-9"
                    />
                  </span>
                ) : (
                  <Link
                    href={`/${citySlug}`}
                    className="flex shrink-0 items-center rounded-lg p-0.5 transition-opacity hover:opacity-90"
                    aria-label="MamaGo — на главную"
                  >
                    <Image
                      src="/favico_mamago.webp"
                      alt="MamaGo"
                      width={100}
                      height={100}
                      priority
                      className="h-8 w-auto md:h-9"
                    />
                  </Link>
                )}
              </div>

              <div className="relative isolate h-20 w-full min-w-0 justify-self-stretch px-0">
                {isLandingHeader ? (
                  <div className="absolute inset-0 z-[1] flex items-center justify-center px-1">
                    {intentTabsRow}
                  </div>
                ) : (
                  <motion.div
                    className="absolute inset-0 z-[1] flex items-center justify-center px-1 will-change-[opacity]"
                    initial={false}
                    animate={{
                      opacity: hb.showAirbnbCompactBar ? 0 : 1,
                    }}
                    transition={{
                      duration: centerFadeDuration,
                      ease: CENTER_EASE,
                    }}
                    style={{
                      pointerEvents: hb.showAirbnbCompactBar ? "none" : "auto",
                    }}
                  >
                    {intentTabsRow}
                  </motion.div>
                )}
                {!isLandingHeader ? (
                  <motion.div
                    className={cn(
                      "absolute inset-0 z-[2] flex items-center justify-center will-change-[opacity]",
                      HEADER_SEARCH_BAR_WRAP_CLASS,
                    )}
                    initial={false}
                    animate={{
                      opacity: hb.showAirbnbCompactBar ? 1 : 0,
                    }}
                    transition={{
                      duration: centerFadeDuration,
                      ease: CENTER_EASE,
                    }}
                    style={{
                      pointerEvents: hb.showAirbnbCompactBar ? "auto" : "none",
                    }}
                  >
                    <DesktopSearchControl
                      className="min-h-11 w-full"
                      citySlug={citySlug}
                      currentIntent={searchIntent}
                      compactIconIntent={
                        isPublicationPage ? searchIntent : null
                      }
                      mode="compact"
                      activePanel="none"
                      onPanelChange={() => {}}
                      onPanelClose={() => {}}
                      onExpand={hb.actions.toggleSearchSurface}
                      variant={compactSearchVariant}
                      renderPanels={false}
                    />
                  </motion.div>
                ) : null}
              </div>

              <div className="flex min-w-0 items-center justify-end justify-self-end gap-1.5 md:gap-2">
                {isLandingHeader ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={HEADER_CHROME_ICON_BUTTON_CLASS}
                    aria-label="Поиск — в каталоге"
                    asChild
                  >
                    <Link href={`/${citySlug}/kuda`}>
                      <Search className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={HEADER_CHROME_ICON_BUTTON_CLASS}
                    aria-label="Поиск"
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        window.matchMedia("(min-width: 1024px)").matches
                      ) {
                        setSearchOverlayOpen(true);
                      } else {
                        hb.actions.openSearchSurface();
                      }
                    }}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}

                <HeaderAccountMenu />
              </div>
            </div>
          </div>

          {/* Вторая строка: сегментированный поиск — не на посадочных */}
          {!isLandingHeader && (
            <motion.div
              data-header-block1
              data-search-surface
              initial={false}
              animate={{
                maxHeight: showExpandedSearchRow ? SEARCH_ROW_MAX_PX : 0,
                opacity: showExpandedSearchRow ? 1 : 0,
              }}
              transition={searchRowTransition(reduceMotion)}
              className="w-full shrink-0 overflow-hidden bg-transparent will-change-[max-height,opacity]"
              style={{
                pointerEvents: showExpandedSearchRow ? "auto" : "none",
              }}
              aria-hidden={!showExpandedSearchRow}
            >
              {expandedSearchRowInner}
            </motion.div>
          )}
        </div>
      </header>
      {!isLandingHeader ? (
        <SearchOverlay open={searchOverlayOpen} onOpenChange={setSearchOverlayOpen} />
      ) : null}
    </>
  );
}

export const Header = SiteHeaderShell;
