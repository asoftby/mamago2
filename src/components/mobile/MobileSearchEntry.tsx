"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
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

interface MobileSearchEntryProps {
  onSearchClick: () => void;
  className?: string;
  citySlug?: string;
  currentIntent?: Intent;
}

export function MobileSearchEntry({ 
  onSearchClick, 
  className,
  citySlug = "minsk",
  currentIntent = "kuda"
}: MobileSearchEntryProps) {
  const [isClient, setIsClient] = useState(false);
  const { applied } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);

  // Ensure we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

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
    const parts: string[] = [];
    
    // Always show city first
    parts.push(getCityDisplayName(citySlug));
    
    // Add "Поблизости" if selected
    if (applied.nearby) {
      parts.push("Поблизости");
    }
    
    // Add metro or district (mutually exclusive with nearby)
    // Only try to match API options when we're on client and have loaded options
    if (isClient && apiOptions) {
      if (applied.metro) {
        const metro = apiOptions.metros.find(m => m.value === applied.metro);
        if (metro) parts.push(metro.label);
      } else if (applied.district) {
        const district = apiOptions.districts.find(d => d.value === applied.district);
        if (district) parts.push(district.label);
      }
    } else {
      // Fallback: show filter ID if we have filters but no API options yet
      if (applied.metro) {
        parts.push(`Метро: ${applied.metro}`);
      } else if (applied.district) {
        parts.push(`Район: ${applied.district}`);
      }
    }
    
    return parts.join(" • ");
  };

  // Helper function to get weekend range
  const getWeekendRange = (now: Date) => {
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + (6 - day));
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    return [saturday, sunday];
  };

  // Build date text
  const getDateText = () => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") {
      const now = new Date();
      const [saturday, sunday] = getWeekendRange(now);
      const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
      
      const satDay = saturday.getDate();
      const sunDay = sunday.getDate();
      const satMonth = saturday.getMonth();
      const sunMonth = sunday.getMonth();
      
      if (satMonth === sunMonth) {
        return `${satDay}–${sunDay} ${months[satMonth]}`;
      } else {
        return `${satDay} ${months[satMonth]}–${sunDay} ${months[sunMonth]}`;
      }
    }
    
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
  const locationText = getLocationText();
  const dateText = getDateText();
  const ageText = getAgeText();
  
  const parts = [
    locationText,
    dateText,
    ageText
  ].filter(Boolean);

  const summaryText = parts.length > 0 ? parts.join(" • ") : "Начать поиск";
  
  // Check if we have any filters beyond just the default city
  const hasAdditionalFilters = applied.district || applied.metro || applied.nearby || applied.dateFrom || applied.whenPreset || applied.age.length > 0;

  return (
    <button
      onClick={onSearchClick}
      className={cn(
        "flex items-center gap-3 w-full h-[52px] rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 px-5 relative",
        "active:scale-[0.98] active:shadow-sm text-left",
        className
      )}
    >
      {/* Intent Icon - Always show current category icon */}
      <div className="flex-shrink-0">
        {intentConfig.image ? (
          <Image 
            src={intentConfig.image}
            alt={intentConfig.label}
            width={20} 
            height={20} 
            className="object-contain"
          />
        ) : FallbackIcon ? (
          <FallbackIcon className="h-5 w-5 text-gray-400" />
        ) : (
          <Search className="h-5 w-5 text-gray-400" />
        )}
      </div>
      
      {/* Search Summary Text */}
      <span className={cn(
        "text-base font-normal truncate flex-1",
        hasAdditionalFilters ? "text-gray-700" : "text-gray-500"
      )}>
        {summaryText}
      </span>
    </button>
  );
}