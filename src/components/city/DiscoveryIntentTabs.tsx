"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";
import { Intent } from "@/lib/intent";
import { Label } from "@/components/ui/typography";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";

// Map intent IDs to icons (fallback if no image)
const TAB_ICONS = {
  kuda: IconCompass,
  classes: IconPalette,
  birthday: IconParty,
  routes: IconMap,
};

interface DiscoveryIntentTabsProps {
  city: string;
  currentIntent: Intent;
  className?: string;
}

export function DiscoveryIntentTabs({ 
  city, 
  currentIntent, 
  className 
}: DiscoveryIntentTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Find active index based on current intent
  const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(item => item.id === currentIntent);
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  useEffect(() => {
    const currentTab = tabsRef.current[safeActiveIndex];
    if (currentTab) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.clientWidth
      });
      
      // Scroll into view on mobile if needed
      currentTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
    }
  }, [safeActiveIndex, currentIntent]);

  return (
    <div className={cn("relative w-full bg-background z-10", className)}>
      <div className="flex w-full max-w-screen-xl mx-auto overflow-x-auto no-scrollbar relative pointer-events-auto py-[10px]">
        {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
          const isActive = index === safeActiveIndex;
          const Icon = TAB_ICONS[intentConfig.id];
          
          return (
            <Link
              key={intentConfig.id}
              href={intentConfig.href(city)}
              ref={(el) => { tabsRef.current[index] = el; }}
              scroll={false} // Prevent full page scroll reset
              className={cn(
                "group flex min-w-[80px] flex-col items-center justify-center gap-0.5 px-3 transition-colors duration-200 select-none",
                isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              {intentConfig.image ? (
                <div className="relative h-[48px] w-[48px] flex items-center justify-center">
                  <Image 
                    src={intentConfig.image}
                    alt={intentConfig.label}
                    width={48} 
                    height={48} 
                    className={cn(
                      "object-contain transition-transform duration-200 group-hover:scale-105 mb-[5px]",
                      isActive ? "scale-100" : "scale-[0.75]",
                      isActive && "drop-shadow-[0_4px_8px_rgba(239,135,89,0.35)]"
                    )}
                  />
                </div>
              ) : (
                <Icon 
                  className={cn(
                    "transition-all duration-300",
                    isActive ? "h-6 w-6 opacity-100" : "h-5 w-5 opacity-60"
                  )} 
                />
              )}
              <Label 
                as="span"
                className={cn(
                  "text-[13px] leading-none whitespace-nowrap transition-all duration-300 normal-case tracking-normal text-current",
                  isActive ? "font-bold text-neutral-900" : "font-medium text-neutral-400"
                )}
              >
                {intentConfig.label}
              </Label>
            </Link>
          );
        })}
        
        {/* Animated Indicator */}
        <div
          className="absolute bottom-0 h-[2px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`
          }}
        />
      </div>
    </div>
  );
}