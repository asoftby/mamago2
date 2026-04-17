"use client";

import { useRef, useEffect, useLayoutEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";
import { Intent } from "@/lib/intent";
import { Label } from "@/components/ui/typography";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { appendCityQuery } from "@/lib/city/appendCityQuery";

// Map intent IDs to icons (fallback if no image)
const TAB_ICONS = {
  kuda: IconCompass,
  classes: IconPalette,
  birthday: IconParty,
  routes: IconMap,
};

interface DiscoveryIntentTabsProps {
  city: string | null;
  /** На городском хабе (например `/minsk`) — без активной вкладки */
  currentIntent: Intent | null;
  className?: string;
  /** Верхняя строка хедера: иконка + подпись, подчёркивание у активного (как Airbnb). */
  variant?: "default" | "airbnb";
}

function DiscoveryIntentTabsContent({
  city,
  currentIntent,
  className,
  variant = "default",
}: DiscoveryIntentTabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  const activeIndex =
    currentIntent === null
      ? -1
      : DISCOVERY_INTENT_ITEMS.findIndex((item) => item.id === currentIntent);

  const buildIntentHref = (intentId: string) => {
    if (!city) return "#";
    const intentConfig = DISCOVERY_INTENT_ITEMS.find((item) => item.id === intentId);
    if (!intentConfig) return "#";
    return appendCityQuery(intentConfig.href(city), city);
  };

  useLayoutEffect(() => {
    if (variant === "airbnb") return;
    if (activeIndex < 0) {
      requestAnimationFrame(() => setIndicatorStyle({ left: 0, width: 0 }));
      return;
    }
    const currentTab = tabsRef.current[activeIndex];
    if (currentTab) {
      const newStyle = {
        left: currentTab.offsetLeft,
        width: currentTab.clientWidth,
      };
      requestAnimationFrame(() => setIndicatorStyle(newStyle));

      currentTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeIndex, currentIntent, variant]);

  // If no city, don't render tabs (after all hooks)
  if (!city) {
    return null;
  }

  if (variant === "airbnb") {
    return (
      <nav
        className={cn("relative z-10 w-full max-w-2xl bg-transparent", className)}
        aria-label="Разделы развлечений"
      >
        <div className="flex min-h-[64px] items-end justify-center gap-0 overflow-x-auto no-scrollbar pointer-events-auto md:min-h-[68px] md:gap-1">
          {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
            const isActive = activeIndex >= 0 && index === activeIndex;
            const Icon = TAB_ICONS[intentConfig.id];

            return (
              <Link
                key={intentConfig.id}
                href={buildIntentHref(intentConfig.id)}
                ref={(el) => {
                  tabsRef.current[index] = el;
                }}
                scroll={false}
                className={cn(
                  "group flex min-w-[68px] max-w-[120px] flex-col items-center gap-0.5 border-b-2 border-transparent px-2 pb-2 pt-1 transition-colors duration-200 select-none md:min-w-[80px] md:px-3",
                  isActive
                    ? "border-primary text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {intentConfig.image ? (
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center md:h-9 md:w-9">
                    <Image
                      src={intentConfig.image}
                      alt={intentConfig.label}
                      width={36}
                      height={36}
                      className={cn(
                        "h-full w-full object-contain transition-transform duration-200",
                        isActive ? "scale-100" : "scale-90 opacity-80",
                      )}
                    />
                  </div>
                ) : (
                  <Icon
                    className={cn(
                      "h-8 w-8 shrink-0 transition-opacity md:h-9 md:w-9",
                      isActive ? "opacity-100" : "opacity-60",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "whitespace-nowrap text-[11px] leading-tight tracking-normal transition-colors md:text-xs normal-case",
                    isActive ? "font-semibold text-neutral-900" : "font-medium text-neutral-500",
                  )}
                >
                  {intentConfig.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div className={cn("relative w-full bg-transparent z-10", className)}>
      <div className="flex w-full justify-center overflow-x-auto no-scrollbar relative pointer-events-auto">
        {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
          const isActive = activeIndex >= 0 && index === activeIndex;
          const Icon = TAB_ICONS[intentConfig.id];

          return (
            <Link
              key={intentConfig.id}
              href={buildIntentHref(intentConfig.id)}
              ref={(el) => {
                tabsRef.current[index] = el;
              }}
              scroll={false} // Prevent full page scroll reset
              className={cn(
                "group flex min-w-[80px] flex-col items-center justify-center gap-0.5 px-3 transition-colors duration-200 select-none",
                isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600",
              )}
            >
              {intentConfig.image ? (
                <div className="relative h-[40px] w-[40px] flex items-center justify-center">
                  <Image
                    src={intentConfig.image}
                    alt={intentConfig.label}
                    width={40}
                    height={40}
                    className={cn(
                      "object-contain transition-transform duration-200 group-hover:scale-105",
                      isActive ? "scale-100" : "scale-[0.8]",
                      isActive && "drop-shadow-[0_2px_4px_rgba(239,135,89,0.25)]",
                    )}
                  />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "transition-all duration-300",
                    isActive ? "h-5 w-5 opacity-100" : "h-4 w-4 opacity-60",
                  )}
                />
              )}
              <Label
                as="span"
                className={cn(
                  "text-[12px] leading-none whitespace-nowrap transition-all duration-300 normal-case tracking-normal text-current mb-[7px]",
                  isActive ? "font-bold text-neutral-900" : "font-medium text-neutral-400",
                )}
              >
                {intentConfig.label}
              </Label>
            </Link>
          );
        })}

        {/* Animated Indicator */}
        <div
          className="absolute bottom-0 h-[4px] rounded-full bg-[#EF8759] transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
      </div>
    </div>
  );
}

export function DiscoveryIntentTabs(props: DiscoveryIntentTabsProps) {
  const h = props.variant === "airbnb" ? "h-[68px]" : "h-[60px]";
  return (
    <Suspense fallback={<div className={cn("w-full", h)} />}>
      <DiscoveryIntentTabsContent {...props} />
    </Suspense>
  );
}