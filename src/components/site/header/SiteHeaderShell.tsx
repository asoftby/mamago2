"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStableHeaderBehavior } from "@/hooks/useStableHeaderBehavior";
import { getIntentFromPath, getCityFromPath } from "@/lib/intent";

import { StableHeaderChrome } from "./StableHeaderChrome";
import { SearchSurface } from "./SearchSurface";

/**
 * Site Header Shell - Stable Architecture
 *
 * При скролле меню становится компактным и остаётся sticky.
 * Высота: развёрнутый 200px, компактный 72px (синхронизировано с отступом контента через --header-height).
 */

export const HEADER_HEIGHT_EXPANDED = 200;
export const HEADER_HEIGHT_COMPACT = 72;
/** Для обратной совместимости и начального SSR: максимальная высота */
export const HEADER_HEIGHT = HEADER_HEIGHT_EXPANDED;

export function SiteHeaderShell() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const headerBehavior = useStableHeaderBehavior({ scrollThreshold: 80, headerRef });

  // Компактный режим только когда прокрутили достаточно И не показывается SearchSurface
  // Если режим expanded-top, то всегда показываем полную высоту
  const isCompact = headerBehavior.mode === "compact";
  const currentHeight = isCompact ? HEADER_HEIGHT_COMPACT : HEADER_HEIGHT_EXPANDED;

  const currentIntent = getIntentFromPath(pathname);
  const currentCity = getCityFromPath(pathname);
  const displayCity = currentCity || "minsk";
  const shouldShowFilters = !!(currentIntent && currentCity);
  // Show intent tabs always — use displayCity as fallback for non-city pages
  const shouldShowIntentTabs = true;

  return (
    <>
      {/* Фиксированный хедер: всегда прижат к верху viewport при скролле */}
      <header
        ref={headerRef}
        data-header-shell
        className={cn(
          "fixed left-0 right-0 top-0 z-50 w-full bg-white border-b border-gray-200",
          "transition-[height,box-shadow] duration-300 ease-out",
          headerBehavior.isScrolled ? "shadow-md" : "shadow-sm"
        )}
        style={{
          height: `${currentHeight}px`,
          backfaceVisibility: "hidden",
          willChange: "box-shadow"
        }}
      >
        <div className="mx-auto w-full max-w-[1200px] px-4 h-full">
          <StableHeaderChrome
            citySlug={displayCity}
            currentIntent={currentIntent}
            shouldShowIntentTabs={shouldShowIntentTabs}
            shouldShowFilters={shouldShowFilters}
            headerBehavior={headerBehavior}
            isCompact={isCompact}
          />
        </div>
      </header>

      {/* Search Surface Overlay - только если действительно нужен overlay */}
      {headerBehavior.showSearchSurface && (
        <SearchSurface
          citySlug={displayCity}
          currentIntent={currentIntent}
          shouldShowIntentTabs={shouldShowIntentTabs}
          shouldShowFilters={shouldShowFilters}
          isVisible={headerBehavior.showSearchSurface}
          activePanel={headerBehavior.activePanel}
          onPanelChange={headerBehavior.actions.openPanel}
          onPanelClose={headerBehavior.actions.closePanel}
          onClose={headerBehavior.actions.closeSearchSurface}
          headerHeight={currentHeight}
        />
      )}

      {/* Spacer в потоке документа, чтобы контент не уходил под fixed header */}
      <div
        aria-hidden
        className="hidden lg:block shrink-0 transition-[height] duration-300 ease-out"
        style={{ height: `${currentHeight}px` }}
      />
    </>
  );
}