"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Calendar, Users, X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { LocationPanel, DatePanel, AgePanel } from "./search-segments";
import { Portal } from "@/components/ui/portal";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";

interface DesktopSearchControlProps {
  citySlug?: string;
  className?: string;
  onClose?: () => void;
  isCompact?: boolean; // Новый пропс для компактного состояния
  onExpand?: () => void; // Колбэк для расширения
  onCollapse?: () => void; // Колбэк для сворачивания
  currentIntent?: string; // Текущий активный раздел
}

export function DesktopSearchControl({ 
  citySlug = "minsk", 
  className,
  onClose,
  isCompact = false,
  onExpand,
  onCollapse,
  currentIntent = "kuda"
}: DesktopSearchControlProps) {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const ageRef = useRef<HTMLButtonElement>(null);
  
  const { applied, actions, derived } = useDiscoveryFilters();
  const { options: apiOptions, error } = useDiscoveryFilterOptions(citySlug);
  
  // Fallback options if API fails
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: []
  };
  
  // Calculate positions for each dropdown
  const locationPosition = useDropdownPosition(locationRef, activeSegment === "location");
  const datePosition = useDropdownPosition(dateRef, activeSegment === "date");
  const agePosition = useDropdownPosition(ageRef, activeSegment === "age");
  
  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside the main container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      
      // Check if click is inside any of the portal panels
      const portalPanels = document.querySelectorAll('[data-portal-panel]');
      for (const panel of portalPanels) {
        if (panel.contains(target)) {
          return;
        }
      }
      
      // Click is outside - close the panel and collapse expanded header
      setActiveSegment(null);
      onClose?.();
      onCollapse?.(); // Also collapse the expanded header
    };

    if (activeSegment) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeSegment, onClose, onCollapse]);

  // Close expanded header when clicking outside (even when no panels are open)
  useEffect(() => {
    if (isCompact || activeSegment) return; // Skip if compact or panels are open (handled by first effect)

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is inside the main container
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      
      // Check if click is inside the header (intent tabs area)
      const header = document.querySelector('header');
      if (header && header.contains(target)) {
        return;
      }
      
      // Click is outside - collapse the expanded header
      onCollapse?.();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCompact, activeSegment, onCollapse]);

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

  // Build location display text
  const getLocationText = () => {
    if (searchText.trim()) return searchText;
    if (applied.district) {
      const district = safeApiOptions.districts.find(d => d.value === applied.district);
      return district?.label || applied.district;
    }
    if (applied.metro) {
      const metro = safeApiOptions.metros.find(m => m.value === applied.metro);
      return metro?.label || applied.metro;
    }
    return getCityDisplayName(citySlug);
  };

  // Build date display text
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
    
    return "Когда";
  };

  // Build age display text
  const getAgeText = () => {
    if (applied.age.length === 0) return "С кем";
    
    const ageLabels = applied.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  const handleSearch = () => {
    // Close any open panels
    setActiveSegment(null);
    // In a real app, this would trigger search/navigation
    console.log("Search triggered with filters:", applied, "and text:", searchText);
  };

  const handleClearAll = () => {
    // Clear all filters
    actions.resetAll();
    // Clear search text
    setSearchText("");
    // Close any open panels
    setActiveSegment(null);
    console.log("All filters cleared");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setActiveSegment(null);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full flex items-center gap-3", className)}>
      {/* Main Search Control - Transforms between full and compact */}
      <div 
        data-search-container
        className={cn(
          "relative bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-all duration-150 ease-out flex-1",
          isCompact && "cursor-pointer" // Make clickable when compact
        )}
        onClick={isCompact ? onExpand : undefined} // Expand when compact and clicked
      >
        {isCompact ? (
          // COMPACT STATE: Simple summary button
          <CompactSearchButton 
            citySlug={citySlug}
            applied={applied}
            apiOptions={safeApiOptions}
            currentIntent={currentIntent}
          />
        ) : (
          // FULL STATE: Complete search form
          <FullSearchForm 
            activeSegment={activeSegment}
            setActiveSegment={setActiveSegment}
            getLocationText={getLocationText}
            getDateText={getDateText}
            getAgeText={getAgeText}
            locationRef={locationRef}
            dateRef={dateRef}
            ageRef={ageRef}
          />
        )}
      </div>

      {/* Clear All Button - Only in full state */}
      {!isCompact && derived.isDirty && (
        <button
          onClick={handleClearAll}
          className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 shadow-sm"
          aria-label="Очистить все фильтры"
        >
          <X className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
        </button>
      )}

      {/* Panels - Only in full state */}
      {!isCompact && (
        <>
          {activeSegment === "location" && (
            <Portal>
              <div
                data-portal-panel
                style={{
                  position: "absolute",
                  top: locationPosition.top + 8,
                  left: locationPosition.containerLeft, // Use container left instead of segment left
                  width: locationPosition.containerWidth, // Use full container width
                  zIndex: 9999,
                }}
              >
                <LocationPanel
                  citySlug={citySlug}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onClose={() => setActiveSegment(null)}
                  applied={applied}
                  actions={actions}
                  apiOptions={safeApiOptions}
                />
              </div>
            </Portal>
          )}

          {activeSegment === "date" && (
            <Portal>
              <div
                data-portal-panel
                style={{
                  position: "absolute",
                  top: datePosition.top + 8,
                  left: datePosition.containerLeft, // Use container left instead of segment left
                  width: datePosition.containerWidth, // Use full container width
                  zIndex: 9999,
                }}
              >
                <DatePanel
                  onClose={() => setActiveSegment(null)}
                  applied={applied}
                  actions={actions}
                />
              </div>
            </Portal>
          )}

          {activeSegment === "age" && (
            <Portal>
              <div
                data-portal-panel
                style={{
                  position: "absolute",
                  top: agePosition.top + 8,
                  left: agePosition.containerLeft, // Use container left instead of segment left
                  width: agePosition.containerWidth, // Use full container width
                  zIndex: 9999,
                }}
              >
                <AgePanel
                  onClose={() => setActiveSegment(null)}
                  applied={applied}
                  actions={actions}
                />
              </div>
            </Portal>
          )}
        </>
      )}

      {/* Keyboard handler - Only in full state */}
      {!isCompact && activeSegment && (
        <div
          className="fixed inset-0 z-[-1]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        />
      )}
    </div>
  );

// Compact Search Button Component
function CompactSearchButton({ 
  citySlug, 
  applied, 
  apiOptions: safeApiOptions,
  currentIntent 
}: {
  citySlug: string;
  applied: any;
  apiOptions: any;
  currentIntent: string;
}) {
  // Map intent IDs to fallback icons
  const INTENT_ICONS = {
    kuda: IconCompass,
    classes: IconPalette,
    birthday: IconParty,
    routes: IconMap,
  };

  // Get current intent config and icon
  const intentConfig = DISCOVERY_INTENT_CONFIG[currentIntent as keyof typeof DISCOVERY_INTENT_CONFIG];
  const FallbackIcon = INTENT_ICONS[currentIntent as keyof typeof INTENT_ICONS];

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

  // Build summary text
  const parts = [];
  
  // Location
  if (applied.district) {
    const district = safeApiOptions.districts.find((d: any) => d.value === applied.district);
    parts.push(district?.label || applied.district);
  } else if (applied.metro) {
    const metro = safeApiOptions.metros.find((m: any) => m.value === applied.metro);
    parts.push(metro?.label || applied.metro);
  } else {
    parts.push(getCityDisplayName(citySlug));
  }

  // Date
  if (applied.whenPreset === "TODAY") parts.push("Сегодня");
  else if (applied.whenPreset === "TOMORROW") parts.push("Завтра");
  else if (applied.whenPreset === "WEEKEND") parts.push("Выходные");
  else if (applied.dateFrom) {
    const fromDate = new Date(applied.dateFrom);
    const day = fromDate.getDate();
    const month = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][fromDate.getMonth()];
    parts.push(`${day} ${month}`);
  }

  // Age
  if (applied.age.length > 0) {
    const ageLabels = applied.age.map((ageValue: string) => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    if (ageLabels.length === 1) parts.push(ageLabels[0]);
    else if (ageLabels.length === 2) parts.push(`${ageLabels[0]}, ${ageLabels[1]}`);
    else parts.push(`${ageLabels[0]} +${ageLabels.length - 1}`);
  }

  const summaryText = parts.length > 0 ? parts.join(" • ") : "Поиск";

  return (
    <div className="flex items-center gap-3 px-6 py-3 w-full">
      {/* Intent Icon instead of Search - Увеличена на 30% от оригинала */}
      <div className="flex-shrink-0">
        {intentConfig?.image ? (
          <Image 
            src={intentConfig.image}
            alt={intentConfig.label}
            width={21} 
            height={21} 
            className="object-contain"
          />
        ) : (
          <FallbackIcon className="h-[21px] w-[21px] text-gray-400" />
        )}
      </div>
      <span className="text-sm text-gray-700 truncate flex-1">
        {summaryText}
      </span>
    </div>
  );
}

// Full Search Form Component
function FullSearchForm({
  activeSegment,
  setActiveSegment,
  getLocationText,
  getDateText,
  getAgeText,
  locationRef,
  dateRef,
  ageRef
}: {
  activeSegment: string | null;
  setActiveSegment: (segment: string | null) => void;
  getLocationText: () => string;
  getDateText: () => string;
  getAgeText: () => string;
  locationRef: React.RefObject<HTMLButtonElement>;
  dateRef: React.RefObject<HTMLButtonElement>;
  ageRef: React.RefObject<HTMLButtonElement>;
}) {
  return (
    <div className="flex items-center">
      {/* Location Segment */}
      <button
        ref={locationRef}
        onClick={() => setActiveSegment(activeSegment === "location" ? null : "location")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 rounded-l-full hover:bg-gray-50 transition-colors overflow-hidden",
          activeSegment === "location" && "bg-gray-50"
        )}
      >
        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs font-medium text-gray-900">Куда</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getLocationText()}
          </span>
        </div>
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Date Segment */}
      <button
        ref={dateRef}
        onClick={() => setActiveSegment(activeSegment === "date" ? null : "date")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors overflow-hidden",
          activeSegment === "date" && "bg-gray-50"
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs font-medium text-gray-900">Когда</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getDateText()}
          </span>
        </div>
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Age Segment */}
      <button
        ref={ageRef}
        onClick={() => setActiveSegment(activeSegment === "age" ? null : "age")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 rounded-r-full hover:bg-gray-50 transition-colors overflow-hidden",
          activeSegment === "age" && "bg-gray-50"
        )}
      >
        <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs font-medium text-gray-900">С кем</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getAgeText()}
          </span>
        </div>
      </button>
    </div>
  );
}
}