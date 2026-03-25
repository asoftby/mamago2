"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import {
  getIntentFromPath,
  getCityFromPath,
  isCityHubPath,
  isPublicationDetailPath,
} from "@/lib/intent";
import { useCity } from "@/contexts/CityContext";
import { usePublicationIntent } from "@/contexts/PublicationIntentContext";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { useAirbnbMobileHeaderScroll } from "@/hooks/useAirbnbMobileHeaderScroll";

export function SiteHeaderMobile() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const reduceMotion = useReducedMotion();
  const isScrolled = useHeaderScrolled(50);

  const routeIntent = getIntentFromPath(pathname);
  const publicationIntent = usePublicationIntent();
  const isPublicationPage = isPublicationDetailPath(pathname);
  const searchIntent = routeIntent ?? publicationIntent ?? null;
  const currentCity = getCityFromPath(pathname);
  const { citySlug } = useCity();
  const isCityHubRoute = isCityHubPath(pathname);

  const mobileScroll = useAirbnbMobileHeaderScroll({
    searchSurfaceOpen: isSearchSheetOpen,
    reduceMotion,
    scrollDirectionMode: routeIntent !== null,
  });

  const displayCity = citySlug;
  /** На главной города (`/minsk`) в URL нет раздела — не подсвечиваем «Куда пойти». */
  const displayIntent = searchIntent ?? (isCityHubRoute ? undefined : "kuda");

  const isDiscoveryPage = searchIntent !== null && currentCity !== null;
  const intentConfig = searchIntent
    ? DISCOVERY_INTENT_CONFIG[searchIntent]
    : null;

  const cityHubOnly = isCityHubRoute || isPublicationPage;

  const useScrollTransform = mobileScroll.enabled;

  useLayoutEffect(() => {
    if (!useScrollTransform) return;
    const el = headerRef.current;
    if (!el) return;
    const sync = () => setSpacerHeight(Math.round(el.offsetHeight));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useScrollTransform, pathname, isSearchSheetOpen]);

  return (
    <>
      <header
        ref={headerRef}
        data-header-shell
        style={
          useScrollTransform
            ? {
                transform: `translate3d(0, calc(-100% * ${mobileScroll.hideRatio}), 0)`,
              }
            : undefined
        }
        className={cn(
          "z-50 w-full border-b border-[#EBEBEB] bg-gradient-to-b from-white to-[#F7F7F7] text-foreground antialiased transition-shadow duration-200",
          useScrollTransform
            ? "fixed left-0 right-0 top-0 will-change-transform"
            : "sticky top-0",
          useScrollTransform &&
            mobileScroll.fullyHidden &&
            "pointer-events-none",
          isScrolled && "shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
        )}
        aria-hidden={
          useScrollTransform && mobileScroll.fullyHidden ? true : undefined
        }
      >
        <div className="mx-auto w-full">
          <div className="px-4 pt-4 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">
                <MobileSearchEntry
                  cityHubOnly={cityHubOnly}
                  showSectionIcon={isPublicationPage}
                  showTapToSelectHint={isCityHubRoute}
                  onSearchClick={() => setIsSearchSheetOpen(true)}
                  citySlug={displayCity}
                  currentIntent={displayIntent}
                />
              </div>

              {isDiscoveryPage && intentConfig?.hasFilters && searchIntent && (
                <MobileFilterButton intent={searchIntent} />
              )}
            </div>
          </div>
        </div>
      </header>

      {useScrollTransform ? (
        <div
          aria-hidden
          className="w-full shrink-0"
          style={{ height: spacerHeight }}
        />
      ) : null}

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
