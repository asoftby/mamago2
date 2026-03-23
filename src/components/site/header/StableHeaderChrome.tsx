"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";
import type { HeaderMode, HeaderPanel } from "@/hooks/useStableHeaderBehavior";
import type { Intent } from "@/lib/intent";

interface StableHeaderChromeProps {
  citySlug: string;
  /** Городской хаб `/{city}` — только выбор города в шапке */
  isCityHub: boolean;
  currentIntent?: Intent | null;
  shouldShowIntentTabs: boolean;
  shouldShowFilters: boolean;
  headerBehavior: {
    mode: HeaderMode;
    activePanel: HeaderPanel;
    showSearchSurface: boolean;
    isScrolled: boolean;
    scrollProgress: number;
    actions: {
      openPanel: (panel: HeaderPanel) => void;
      closePanel: () => void;
      openSearchSurface: () => void;
      closeSearchSurface: () => void;
      toggleSearchSurface: () => void;
    };
  };
  isCompact?: boolean;
}

/**
 * Stable Header Chrome
 * 
 * Fixed-height header shell that never changes dimensions.
 * Contains all visual elements but maintains stable layout.
 * No conditional rendering of different header versions.
 */
export function StableHeaderChrome({
  citySlug,
  isCityHub,
  currentIntent,
  shouldShowIntentTabs,
  shouldShowFilters,
  headerBehavior,
  isCompact = false,
}: StableHeaderChromeProps) {
  // Показываем встроенную форму поиска всегда когда не в компактном режиме
  const showEmbeddedSearch = !isCompact;
  
  return (
    <div data-header-chrome className="h-full flex flex-col">
      {/* Развёрнутый хедер: категории, затем форма поиска — всё внутри одного блока хедера */}
      {!isCompact && (
        <>
          {/* Ряд 1: лого, иконка поиска | категории | избранное, профиль */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center shrink-0 pt-5 pb-1">
            <div className="flex items-center gap-3">
              <Link href={`/${citySlug}`} className="hover:opacity-80 transition-opacity flex items-center">
                <Image
                  src="/favico_mamago.webp"
                  alt="MamaGo"
                  width={100}
                  height={100}
                  priority
                  className="w-auto h-[39px]"
                />
              </Link>
              <Link
                href={`/${citySlug}`}
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Город и поиск"
              >
                <Search className="h-5 w-5 text-gray-600" />
              </Link>
            </div>
            <div className="flex items-center justify-center min-w-0 px-2">
              {shouldShowIntentTabs ? (
                <DiscoveryIntentTabs city={citySlug} currentIntent={currentIntent ?? null} />
              ) : (
                <span className="text-sm text-gray-400" aria-hidden />
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/me"
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Избранное"
              >
                <Heart className="h-5 w-5 text-gray-600" />
              </Link>
              <Link
                href="/profile"
                className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
                aria-label="Профіль"
              >
                <User className="h-5 w-5 text-gray-600" />
              </Link>
            </div>
          </div>
          {/* Ряд 2: форма поиска встроена в хедер */}
          {showEmbeddedSearch && (
            <div className="flex items-center justify-center flex-1 min-h-[52px] min-w-0 pt-0 pb-3">
              <div className="w-full max-w-[760px] flex items-center justify-center">
                <DesktopSearchControl
                  citySlug={citySlug}
                  currentIntent={currentIntent}
                  mode="expanded"
                  activePanel={headerBehavior.activePanel}
                  onPanelChange={headerBehavior.actions.openPanel}
                  onPanelClose={headerBehavior.actions.closePanel}
                  renderPanels={true}
                  embeddedInHeader
                  variant={isCityHub ? "cityHub" : "discovery"}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Компактный хедер: только здесь форма «Минск» + «Фильтры»; клик по Минск открывает раскрытую панель */}
      {isCompact && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 h-full min-h-0 py-0">
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href={`/${citySlug}`} className="hover:opacity-80 transition-opacity flex items-center">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={100}
                height={100}
                priority
                className="w-auto h-[39px]"
              />
            </Link>
            <Link
              href={`/${citySlug}`}
              className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm flex-shrink-0"
              aria-label="Город и поиск"
            >
              <Search className="h-5 w-5 text-gray-600" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 min-w-0 px-1 h-11">
            <div className="flex-1 max-w-[400px] min-w-0 h-full flex items-center">
              <DesktopSearchControl
                citySlug={citySlug}
                currentIntent={currentIntent}
                mode="compact"
                activePanel="none"
                onPanelChange={() => {}}
                onPanelClose={() => {}}
                onExpand={headerBehavior.actions.openSearchSurface}
                variant={isCityHub ? "cityHub" : "discovery"}
              />
            </div>
            {shouldShowFilters && currentIntent && (
              <div className="flex-shrink-0 flex items-center" title="Раскрыть фильтры">
                <RefinementFiltersButtonCompact intent={currentIntent} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/me"
              className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
              aria-label="Избранное"
            >
              <Heart className="h-5 w-5 text-gray-600" />
            </Link>
            <Link
              href="/profile"
              className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
              aria-label="Профіль"
            >
              <User className="h-5 w-5 text-gray-600" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}