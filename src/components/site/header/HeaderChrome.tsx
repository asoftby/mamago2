"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";

interface HeaderChromeProps {
  citySlug: string;
  currentIntent?: string | null;
  shouldShowFilters: boolean;
  isScrolled: boolean;
  onSearchClick: () => void;
}

/**
 * Header Chrome - Верхний уровень
 * 
 * Стабильный header с фиксированной высотой.
 * Содержит: logo, основной поиск, разделы, избранное, аккаунт.
 * 
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 * - Фиксированная высота (никогда не меняется)
 * - Стабильный sticky/fixed контейнер
 * - Не участвует в layout animation
 * - Только compact search button (без расширенной формы)
 */
export function HeaderChrome({
  citySlug,
  currentIntent,
  shouldShowFilters,
  isScrolled,
  onSearchClick
}: HeaderChromeProps) {
  
  return (
    <div 
      data-header-chrome
      className="h-full flex items-center"
    >
      
      {/* ============================================ */}
      {/* FIXED LAYOUT - Никогда не меняется */}
      {/* ============================================ */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] w-full items-center">

        {/* LEFT ANCHOR - Logo */}
        <div className="flex items-center gap-3">
          <Link href="/minsk" className="hover:opacity-80 transition-opacity">
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
            href="/minsk"
            className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
            aria-label="Глобальный поиск"
          >
            <Search className="h-5 w-5 text-gray-600" />
          </Link>
        </div>

        {/* CENTER - Compact Search Button */}
        <div className="flex items-center justify-center gap-3 min-w-[400px]">
          
          {/* Compact Search Button */}
          <div className="flex-1 max-w-[400px]">
            <button
              onClick={onSearchClick}
              className="w-full"
            >
              <DesktopSearchControl
                citySlug={citySlug}
                currentIntent={currentIntent}
                mode="compact"
                activePanel="none"
                onPanelChange={() => {}}
                onPanelClose={() => {}}
                onExpand={onSearchClick}
              />
            </button>
          </div>
          
          {/* Compact Filters Button */}
          {shouldShowFilters && currentIntent && (
            <div className="flex-shrink-0">
              <RefinementFiltersButtonCompact intent={currentIntent} />
            </div>
          )}
          
        </div>

        {/* RIGHT ANCHOR - Profile and favorites */}
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
      
    </div>
  );
}