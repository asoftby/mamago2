"use client";

import { useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";
import { Intent } from "@/lib/intent";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { appendCityQuery } from "@/lib/city/appendCityQuery";

// Map intent IDs to icons (fallback if no image)
const TAB_ICONS = {
  kuda: IconCompass,
  classes: IconPalette,
  birthday: IconParty,
  routes: IconMap,
};

interface MobileIntentTabsProps {
  city: string;
  currentIntent: Intent | null;
  className?: string;
}

function MobileIntentTabsContent({ 
  city, 
  currentIntent, 
  className 
}: MobileIntentTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find active index based on current intent
  const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(item => item.id === currentIntent);

  const buildIntentHref = (intentId: string) => {
    const intentConfig = DISCOVERY_INTENT_ITEMS.find((item) => item.id === intentId);
    if (!intentConfig) return "#";
    return appendCityQuery(intentConfig.href(city), city);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div 
        ref={containerRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-4 relative touch-pan-x"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity'
        }}
      >
        {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
          const isActive = activeIndex >= 0 && index === activeIndex;
          const Icon = TAB_ICONS[intentConfig.id];
          
          return (
            <Link
              key={intentConfig.id}
              href={buildIntentHref(intentConfig.id)}
              scroll={false}
              className={cn(
                "group flex min-w-[80px] flex-col items-center justify-center gap-1 py-2 transition-all duration-200 select-none scroll-snap-align-start",
                isActive 
                  ? "text-gray-900" 
                  : "text-gray-500 hover:text-gray-700 active:scale-95"
              )}
            >
              {intentConfig.image ? (
                <div className="relative h-[28px] w-[28px] flex items-center justify-center">
                  <Image 
                    src={intentConfig.image}
                    alt={intentConfig.label}
                    width={28} 
                    height={28} 
                    className={cn(
                      "object-contain transition-all duration-200",
                      isActive ? "scale-100" : "scale-90 opacity-80"
                    )}
                  />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "h-[28px] w-[28px] shrink-0 transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-70",
                  )}
                />
              )}
              <span 
                className={cn(
                  "text-xs leading-tight whitespace-nowrap transition-all duration-200 text-center relative",
                  isActive ? "font-semibold text-gray-900" : "font-medium text-gray-500"
                )}
              >
                {intentConfig.label}
                
                {/* Orange underline for active tab - matches text width */}
                {isActive && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#EF8759] rounded-full transition-all duration-200" />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
export function MobileIntentTabs(props: MobileIntentTabsProps) {
  return (
    <Suspense fallback={<div className="h-[60px] w-full" />}>
      <MobileIntentTabsContent {...props} />
    </Suspense>
  );
}