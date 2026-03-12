"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { DesktopSearchControl } from "./DesktopSearchControl";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { Intent } from "@/lib/intent";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";

// Map intent IDs to fallback icons
const INTENT_ICONS = {
  kuda: IconCompass,
  classes: IconPalette,
  birthday: IconParty,
  routes: IconMap,
};

interface CompactSearchSummaryProps {
  citySlug?: string;
  currentIntent?: Intent;
  className?: string;
  onExpand?: () => void;
  onCollapse?: () => void;
  isCompact?: boolean; // Новый пропс для уменьшения кнопки
}

export function CompactSearchSummary({ 
  citySlug = "minsk", 
  currentIntent = "kuda",
  className,
  onExpand,
  onCollapse,
  isCompact = false // По умолчанию false
}: CompactSearchSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { applied } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);

  // Get current intent config
  const intentConfig = DISCOVERY_INTENT_CONFIG[currentIntent];
  const FallbackIcon = INTENT_ICONS[currentIntent];

  // Format city display name
  const getCityDisplayName = (slug: string) => {
    const cityNames: Record<string, string> = {
      minsk: "Минск",
      brest: "Брест",
      gomel: "Гомель",
      grodno: "Гродно",
      mogilev: "Могилёв",
      vitebsk: "Витебск",
    };
    return cityNames[slug] || slug;
  };

  // Build location text
  const getLocationText = () => {
    if (applied.district) {
      const district = apiOptions.districts.find(d => d.value === applied.district);
      return district?.label || applied.district;
    }
    if (applied.metro) {
      const metro = apiOptions.metros.find(m => m.value === applied.metro);
      return metro?.label || applied.metro;
    }
    return getCityDisplayName(citySlug);
  };

  // Build date text
  const getDateText = () => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") return "Выходные";
    
    if (applied.dateFrom) {
      const fromDate = new Date(applied.dateFrom);
      if (applied.dateTo && applied.dateFrom !== applied.dateTo) {
        const toDate = new Date(applied.dateTo);
        const fromDay = fromDate.getDate();
        const toDay = toDate.getDate();
        const fromMonth = fromDate.getMonth();
        const toMonth = toDate.getMonth();
        
        const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
        
        if (fromMonth === toMonth) {
          return `${fromDay}–${toDay} ${months[fromMonth]}`;
        } else {
          return `${fromDay} ${months[fromMonth]}–${toDay} ${months[toMonth]}`;
        }
      }
      
      const day = fromDate.getDate();
      const month = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][fromDate.getMonth()];
      return `${day} ${month}`;
    }
    
    return null;
  };

  // Build age text
  const getAgeText = () => {
    if (applied.age.length === 0) return null;
    
    const ageLabels = applied.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  // Build summary parts
  const parts = [
    getLocationText(),
    getDateText(),
    getAgeText()
  ].filter(Boolean);

  const summaryText = parts.length > 0 ? parts.join(" • ") : "Поиск";

  const handleClick = () => {
    if (isExpanded) {
      setIsExpanded(false);
      setIsAnimating(true);
      // Delay the collapse callback to allow animation
      setTimeout(() => {
        onCollapse?.();
        setIsAnimating(false);
      }, 300); // Match the transition duration
    } else {
      setIsAnimating(true);
      setIsExpanded(true);
      onExpand?.();
      // Reset animating state after expansion
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }
  };

  // If expanded, show full search control with intent tabs
  if (isExpanded) {
    return (
      <div className={cn("relative", className)}>
        {/* Intent Navigation - animated entrance */}
        <div className={cn(
          "w-full transition-all duration-300 overflow-hidden",
          isAnimating ? "h-0 opacity-0" : "h-auto opacity-100 mb-3"
        )}>
          <DiscoveryIntentTabs 
            city={citySlug} 
            currentIntent={currentIntent}
          />
        </div>
        
        {/* Full Search Control - animated entrance */}
        <div className={cn(
          "w-full transition-all duration-300 overflow-hidden",
          isAnimating ? "h-0 opacity-0" : "h-auto opacity-100"
        )}>
          <DesktopSearchControl 
            citySlug={citySlug}
            onClose={() => {
              setIsExpanded(false);
              setIsAnimating(true);
              // Delay the collapse callback to allow animation
              setTimeout(() => {
                onCollapse?.();
                setIsAnimating(false);
              }, 300);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Compact Search Bar */}
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 text-left min-w-0",
          isCompact ? "w-[80%]" : "w-full" // Только уменьшение ширины на 20%
        )}
      >
        {/* Active Intent Icon */}
        <div className="flex-shrink-0">
          {intentConfig.image ? (
            <Image 
              src={intentConfig.image}
              alt={intentConfig.label}
              width={16} 
              height={16} 
              className="object-contain"
            />
          ) : (
            <FallbackIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {/* Search Summary Text */}
        <span className="text-sm text-gray-700 truncate flex-1">
          {summaryText}
        </span>
      </button>
    </div>
  );
}