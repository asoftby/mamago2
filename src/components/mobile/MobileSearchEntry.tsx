"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, Search } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { useOptionalHeaderDiscoveryFilters } from "@/features/filters/discovery/headerDiscoveryFiltersContext";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { Intent } from "@/lib/intent";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { formatWhoHeaderSummary } from "@/lib/family/formatWhoHeaderSummary";
import {
  hasSelectedChildren as familyHasSelectedChildren,
  resolveFamilyAgeMode,
} from "@/lib/family/familyAgeMode";

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
  /** `undefined` на главной хаба — без активного раздела (иконка MapPin). */
  currentIntent?: Intent | null;
  /** Хаб города: как в разделах, но только «Куда» и иконка MapPin */
  cityHubOnly?: boolean;
  /**
   * Явный geo-лейбл вместо вычисляемой городской фразы — для страниц без
   * городского сегмента в URL (REGION/COUNTRY статья на /blog/{slug}),
   * где `citySlug` — не настоящая геопривязка, а лишь предпочтение по
   * умолчанию. См. ArticleGeoLabelContext.
   */
  locationLabelOverride?: string | null;
  /** На посадочной публикации — иконка раздела вместо MapPin при cityHubOnly */
  showSectionIcon?: boolean;
  /** Подсказка «тапни, чтобы выбрать» — только на главной города (`/{city}`) */
  showTapToSelectHint?: boolean;
}

export function MobileSearchEntry({
  onSearchClick,
  className,
  citySlug = "minsk",
  currentIntent,
  cityHubOnly = false,
  showSectionIcon = false,
  showTapToSelectHint = false,
  locationLabelOverride = null,
}: MobileSearchEntryProps) {
  const [isClient, setIsClient] = useState(false);
  const { applied } = useDiscoveryFilters();
  const { isAuthenticated } = useAuthMe();
  const family = useFamilyPersona();
  const headerGeoFilters = useOptionalHeaderDiscoveryFilters();
  const loadHeaderGeoFilters = headerGeoFilters?.loadGeoFilters;
  const headerGeoCitySlug = headerGeoFilters?.citySlug;
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug, { defer: true });

  useEffect(() => {
    const id = window.setTimeout(() => setIsClient(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!loadHeaderGeoFilters || headerGeoCitySlug !== citySlug) {
      return;
    }
    if (!applied.metro && !applied.district) {
      return;
    }
    void loadHeaderGeoFilters();
  }, [
    applied.district,
    applied.metro,
    citySlug,
    headerGeoCitySlug,
    loadHeaderGeoFilters,
  ]);

  const resolvedIntent: Intent | null =
    currentIntent ?? (cityHubOnly ? null : "kuda");

  const intentConfig = resolvedIntent
    ? DISCOVERY_INTENT_CONFIG[resolvedIntent]
    : undefined;
  const FallbackIcon = resolvedIntent
    ? INTENT_ICONS[resolvedIntent]
    : undefined;

  // Build location text
  const getLocationText = () => {
    const cityPhrase = locationLabelOverride ?? getCityLocativePhrase(citySlug);
    const nearbyPart = applied.nearby ? "Поблизости" : null;
    
    let metroOrDistrictPart: string | null = null;
    if (isClient && apiOptions) {
      if (applied.metro) {
        const metro = apiOptions.metros.find(m => m.value === applied.metro);
        if (metro) metroOrDistrictPart = metro.label;
      } else if (applied.district) {
        const district = apiOptions.districts.find(d => d.value === applied.district);
        if (district) metroOrDistrictPart = district.label;
      }
    } else {
      // Fallback: show filter ID if we have filters but no API options yet
      if (applied.metro) {
        metroOrDistrictPart = `Метро: ${applied.metro}`;
      } else if (applied.district) {
        metroOrDistrictPart = `Район: ${applied.district}`;
      }
    }
    
    const parts = [cityPhrase, nearbyPart, metroOrDistrictPart].filter((p): p is string => p != null);
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

  const profileChildren = useMemo(
    () =>
      isAuthenticated && family && !family.loading
        ? family.childPersonasForFilter
        : [],
    [isAuthenticated, family],
  );
  const profileChildIds = useMemo(
    () => profileChildren.map((c) => c.id),
    [profileChildren],
  );
  const hasSelectedChildren = familyHasSelectedChildren(
    family?.selectedPersonaIds ?? [],
    profileChildIds,
  );

  const showChildrenPreset = profileChildren.length > 0;
  const ageMode = resolveFamilyAgeMode({
    hasProfileChildren: showChildrenPreset,
    selectedPersonaIds: family?.selectedPersonaIds ?? [],
    profileChildIds,
  });

  const whoOrAgeText = useMemo(() => {
    if (!isAuthenticated || !family || family.loading) {
      if (applied.age.length === 0) return null;
      const ageLabels = applied.age.map((ageValue) => {
        const group = AGE_GROUPS.find((g) => g.value === ageValue);
        return group ? group.label : ageValue;
      });
      if (ageLabels.length === 1) return ageLabels[0];
      if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
      return `${ageLabels[0]} +${ageLabels.length - 1}`;
    }
    if (ageMode === "free" && showChildrenPreset) {
      return "Для всех";
    }
    const line = formatWhoHeaderSummary({
      hasSelectedChildren,
      selectedPersonaIds: family.selectedPersonaIds,
      personas: family.personas,
      fallbackAgeValues: applied.age,
    });
    if (line === "Выберите возраст") return null;
    return line;
  }, [
    isAuthenticated,
    family,
    ageMode,
    showChildrenPreset,
    hasSelectedChildren,
    applied.age,
  ]);

  const locationText = getLocationText();

  const dateText = isClient ? getDateText() : null;
  const ageText = isClient ? whoOrAgeText : null;

  const parts = cityHubOnly
    ? [locationText]
    : [locationText, dateText, ageText].filter(
        (p): p is string => p != null && p !== "",
      );

  const summaryText =
    parts.length > 0 ? parts.join(" • ") : cityHubOnly ? locationText : "Начать поиск";

  const hasAdditionalFilters = isClient && (cityHubOnly
    ? !!(applied.district || applied.metro || applied.nearby)
    : !!(
        applied.district ||
        applied.metro ||
        applied.nearby ||
        applied.dateFrom ||
        applied.whenPreset ||
        applied.age.length > 0
      ));

  /** Только город в фильтрах (локация по умолчанию), без даты/возраста/метро/района/поблизости */
  const onlyCitySelected = !(
    applied.district ||
    applied.metro ||
    applied.nearby ||
    applied.whenPreset ||
    applied.dateFrom ||
    applied.dateTo ||
    applied.age.length > 0
  );

  /** Подсказка «тапни…» только если кроме города ничего не выбрано */
  const showTapToSelectHintRight =
    onlyCitySelected && (showTapToSelectHint || !cityHubOnly);

  const TAP_HINT = "[ тапни, чтобы выбрать ]";

  return (
    <button
      onClick={onSearchClick}
      className={cn(
        "flex min-w-0 items-center gap-3 h-[52px] w-full max-w-full overflow-hidden rounded-full px-5 relative text-left",
        "border border-gray-200 bg-white shadow-sm transition-all duration-200",
        "hover:border-gray-300 hover:shadow-md",
        "active:scale-[0.98] active:shadow-sm",
        className
      )}
    >
      <div className="flex-shrink-0">
        {cityHubOnly && !showSectionIcon ? (
          <MapPin className="h-5 w-5 text-gray-400" aria-hidden />
        ) : intentConfig?.image ? (
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
      
      {/* Сводка + подсказка, если не выбраны опциональные фильтры (дата/возраст; город не считается) */}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden">
        {showTapToSelectHintRight ? (
          <>
            <span className="block min-w-0 flex-1 truncate text-left text-sm font-normal text-gray-700">
              {summaryText}
            </span>
            <span className="shrink-0 pl-2 text-right text-xs text-neutral-400">
              {TAP_HINT}
            </span>
          </>
        ) : hasAdditionalFilters ? (
          <span className="block min-w-0 flex-1 truncate text-left text-sm font-normal text-gray-700">
            {summaryText}
          </span>
        ) : (
          <span className="block min-w-0 flex-1 truncate text-left text-sm font-normal text-gray-600">
            {summaryText}
          </span>
        )}
      </div>
    </button>
  );
}
