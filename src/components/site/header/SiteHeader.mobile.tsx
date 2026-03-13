"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileSearchEntry } from "@/components/mobile/MobileSearchEntry";
import { MobileIntentTabs } from "@/components/mobile/MobileIntentTabs";
import { MobileSearchSheet } from "@/components/mobile/MobileSearchSheet";
import { MobileFilterButton } from "@/components/mobile/MobileFilterButton";
import { getIntentFromPath, getCityFromPath } from "@/lib/intent";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";

export function SiteHeaderMobile() {
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const pathname = usePathname();
  const isScrolled = useHeaderScrolled(50); // Hide tabs after 50px scroll
  
  // Get current intent and city from path
  const currentIntent = getIntentFromPath(pathname);
  const currentCity = getCityFromPath(pathname);
  
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
                  onSearchClick={() => setIsSearchSheetOpen(true)}
                  citySlug={currentCity || "minsk"}
                  currentIntent={currentIntent || "kuda"}
                />
              </div>
              
              {/* Filter Button - only show on discovery pages with filters */}
              {isDiscoveryPage && intentConfig?.hasFilters && (
                <MobileFilterButton intent={currentIntent} />
              )}
            </div>
          </div>

          {/* Intent Tabs - only show on discovery pages and hide when scrolled */}
          {isDiscoveryPage && currentCity && (
            <div 
              className={cn(
                "py-2 transition-all duration-300 ease-in-out overflow-hidden",
                isScrolled 
                  ? "max-h-0 py-0 opacity-0 pointer-events-none" 
                  : "max-h-[100px] opacity-100"
              )}
            >
              <MobileIntentTabs 
                city={currentCity} 
                currentIntent={currentIntent}
              />
            </div>
          )}
        </div>
      </header>

      {/* Search Sheet */}
      <MobileSearchSheet 
        isOpen={isSearchSheetOpen}
        onClose={() => setIsSearchSheetOpen(false)}
        citySlug={currentCity || "minsk"}
        currentIntent={currentIntent || "kuda"}
      />
    </>
  );
}
