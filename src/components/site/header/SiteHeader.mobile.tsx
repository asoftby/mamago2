"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileIntentTabs } from "@/components/mobile/MobileIntentTabs";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import { getIntentFromPath, getCityFromPath, isCityHubPath } from "@/lib/intent";
import { useCity } from "@/contexts/CityContext";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";

export function SiteHeaderMobile() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const isScrolled = useHeaderScrolled(50); // Hide tabs after 50px scroll
  
  const currentIntent = getIntentFromPath(pathname);
  const currentCity = getCityFromPath(pathname);
  const { citySlug } = useCity();
  const isCityHub = isCityHubPath(pathname);

  const displayCity = citySlug;
  const displayIntent = currentIntent || "kuda";
  
  // Check if we're on a discovery page (has intent)
  const isDiscoveryPage = currentIntent !== null && currentCity !== null;
  const intentConfig = currentIntent ? DISCOVERY_INTENT_CONFIG[currentIntent] : null;

  return (
    <>
      <header className={cn(
        "bg-white transition-shadow duration-200",
        isScrolled && "shadow-sm"
      )}>
        <div className="mx-auto w-full">
          {/* Search Entry Bar with Filter Button */}
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <MobileSearchEntry
                  cityHubOnly={isCityHub}
                  onSearchClick={() => setIsSearchSheetOpen(true)}
                  citySlug={displayCity}
                  currentIntent={displayIntent}
                />
              </div>
              
              {/* Filter Button - only show on discovery pages with filters */}
              {isDiscoveryPage && intentConfig?.hasFilters && (
                <MobileFilterButton intent={currentIntent} />
              )}
            </div>
          </div>

          {/* Intent Tabs - show on all pages but hide when scrolled on non-discovery pages */}
          <div 
            className={cn(
              "py-2 transition-all duration-300 ease-in-out overflow-hidden",
              // Hide tabs when scrolled on non-discovery pages, always show on discovery pages
              (!isDiscoveryPage && isScrolled) || (isDiscoveryPage && isScrolled)
                ? "max-h-0 py-0 opacity-0 pointer-events-none" 
                : "max-h-[100px] opacity-100"
            )}
          >
            <MobileIntentTabs city={displayCity} currentIntent={currentIntent} />
          </div>
        </div>
      </header>

      {/* Search Sheet */}
      <MobileSearchSheet
        isOpen={isSearchSheetOpen}
        onClose={() => setIsSearchSheetOpen(false)}
        citySlug={displayCity}
        currentIntent={displayIntent}
        cityHubOnly={isCityHub}
      />
    </>
  );
}
