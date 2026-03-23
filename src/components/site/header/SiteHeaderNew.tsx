"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHeaderBehavior } from "@/hooks/useHeaderBehavior";
import { getIntentFromPath, getCityFromPath } from "@/lib/intent";

// New architecture components
import { HeaderChrome } from "./HeaderChrome";
import { HeaderExtension } from "./HeaderExtension";

/**
 * Site Header - Новая архитектура
 * 
 * Двухуровневая архитектура header для устранения layout shift:
 * 
 * 1️⃣ HeaderChrome (верхний уровень):
 *    - Фиксированная высота
 *    - Стабильный sticky контейнер
 *    - Содержит: logo, compact search, профиль
 * 
 * 2️⃣ HeaderExtension (нижний уровень):
 *    - Floating layer под HeaderChrome
 *    - Не участвует в document flow
 *    - Содержит: expanded search, intent tabs
 *    - Анимируется через opacity/transform
 * 
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 * - Высота root header контейнера НИКОГДА не изменяется
 * - Расширение header через floating layer
 * - Контент страницы не двигается
 * - Только compositor-friendly анимации
 */

const HEADER_HEIGHT = 95; // Фиксированная высота в пикселях

export function SiteHeaderNew() {
  const pathname = usePathname();
  const headerBehavior = useHeaderBehavior({ scrollThreshold: 80 });
  
  // Extract current intent and city from URL
  const currentIntent = getIntentFromPath(pathname);
  const currentCity = getCityFromPath(pathname);
  const displayCity = currentCity || "minsk";
  
  const shouldShowFilters = !!(currentIntent && currentCity);
  /** Вкладки discovery на всех страницах города, включая хаб `/minsk` */
  const shouldShowIntentTabs = !!currentCity;
  
  return (
    <>
      {/* ============================================ */}
      {/* HEADER CHROME - Верхний уровень */}
      {/* Фиксированная высота, никогда не меняется */}
      {/* ============================================ */}
      <header
        data-header-shell
        className={cn(
          "sticky top-0 z-50 w-full bg-white border-b border-gray-200",
          "transition-[box-shadow] duration-300 ease-out",
          "will-change-box-shadow",
          headerBehavior.isScrolled ? "shadow-md" : "shadow-sm"
        )}
        style={{
          height: `${HEADER_HEIGHT}px`, // ФИКСИРОВАННАЯ ВЫСОТА - никогда не меняется
          backfaceVisibility: "hidden"
        }}
      >
        <div className="mx-auto w-full max-w-[1200px] px-4 h-full">
          
          <HeaderChrome
            citySlug={displayCity}
            currentIntent={currentIntent}
            shouldShowFilters={shouldShowFilters}
            isScrolled={headerBehavior.isScrolled}
            onSearchClick={headerBehavior.actions.showExtension}
          />
          
        </div>
      </header>
      
      {/* ============================================ */}
      {/* HEADER EXTENSION - Нижний уровень */}
      {/* Floating layer, не влияет на layout страницы */}
      {/* ============================================ */}
      <HeaderExtension
        citySlug={displayCity}
        currentIntent={currentIntent}
        shouldShowIntentTabs={shouldShowIntentTabs}
        isVisible={headerBehavior.showExtension}
        activePanel={headerBehavior.activePanel}
        onPanelChange={headerBehavior.actions.openPanel}
        onPanelClose={headerBehavior.actions.closePanel}
        onClose={headerBehavior.actions.hideExtension}
      />
    </>
  );
}