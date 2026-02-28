"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconCompass, IconPalette, IconParty, IconBookOpen } from "@/components/ui/icons";
import { INTENT_ITEMS, getIntentFromPath, getCityFromPath } from "@/lib/intent";
import { Label } from "@/components/ui/typography";

// Map INTENT_ITEMS to tabs with icons
const TAB_ICONS = {
  kuda: IconCompass,
  classes: IconPalette,
  birthday: IconParty,
  journal: IconBookOpen,
};

export function IntentTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const city = getCityFromPath(pathname);
  const currentIntent = getIntentFromPath(pathname);
  
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Find active index based on current intent
  const activeIndex = INTENT_ITEMS.findIndex(item => item.id === currentIntent);
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
  }, [safeActiveIndex, pathname]); // Recalculate on path change

  return (
    <div className={cn("relative w-full bg-background", className)}>
      <div className="flex h-16 w-full max-w-screen-xl mx-auto overflow-x-auto no-scrollbar relative">
        {INTENT_ITEMS.map((tab, index) => {
          const isActive = index === safeActiveIndex;
          const Icon = TAB_ICONS[tab.id];
          
          return (
            <Link
              key={tab.id}
              href={tab.href(city)}
              ref={(el) => { tabsRef.current[index] = el; }}
              scroll={false} // Prevent full page scroll reset
              className={cn(
                "flex min-w-[90px] flex-col items-center justify-center gap-1 px-4 transition-colors duration-200 select-none",
                isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              <Icon 
                className={cn(
                  "transition-all duration-300",
                  isActive ? "h-[30px] w-[30px] opacity-100" : "h-6 w-6 opacity-60"
                )} 
              />
              <Label 
                as="span"
                className={cn(
                  "text-[12px] leading-none whitespace-nowrap transition-all duration-300 normal-case tracking-normal text-current",
                  isActive ? "font-bold text-neutral-900" : "font-medium text-neutral-400"
                )}
              >
                {tab.label}
              </Label>
            </Link>
          );
        })}
        
        {/* Animated Indicator */}
        <div
          className="absolute bottom-0 h-[3px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`
          }}
        />
      </div>
    </div>
  );
}
