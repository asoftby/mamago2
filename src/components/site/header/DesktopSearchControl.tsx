"use client";

import { useState, useRef, useEffect, RefObject } from "react";
import { MapPin, Calendar, Users, X } from "lucide-react";
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
  
  const { applied, draft, actions, beginDraft, openKey } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);
  
  // Fallback options if API fails
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: []
  };
  
  // Use draft for visual feedback in form fields (shows immediate changes)
  // Use applied for URL state (only changes when "Go" is clicked)
  const formDisplayFilters = draft;
  
  // Calculate positions for each dropdown
  const locationPosition = useDropdownPosition(locationRef as RefObject<HTMLElement | null>, activeSegment === "location");
  const datePosition = useDropdownPosition(dateRef as RefObject<HTMLElement | null>, activeSegment === "date");
  const agePosition = useDropdownPosition(ageRef as RefObject<HTMLElement | null>, activeSegment === "age");
  
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
      
      // Click is outside - close the panel only
      setActiveSegment(null);
      actions.close(); // Revert draft
      // Don't call onClose or onCollapse - parent handles its own collapse logic
    };

    if (activeSegment) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeSegment, onClose, onCollapse, actions]);

  // Close panels on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (activeSegment) {
        setActiveSegment(null);
        actions.close(); // Revert draft
        // Don't call onClose or onCollapse - parent handles its own collapse logic
      }
    };

    if (activeSegment) {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [activeSegment, actions]);

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
    
    const parts = [];
    
    // Always show city first
    parts.push(getCityDisplayName(citySlug));
    
    // Add nearby if selected
    if (formDisplayFilters.nearby) {
      parts.push("Поблизости");
    }
    
    // Add metro or district (mutually exclusive with nearby)
    if (formDisplayFilters.metro) {
      const metro = safeApiOptions.metros.find(m => m.value === formDisplayFilters.metro);
      parts.push(metro?.label || formDisplayFilters.metro);
    } else if (formDisplayFilters.district) {
      const district = safeApiOptions.districts.find(d => d.value === formDisplayFilters.district);
      parts.push(district?.label || formDisplayFilters.district);
    }
    
    return parts.join(" • ");
  };

  // Build date display text
  const getDateText = () => {
    if (formDisplayFilters.whenPreset === "TODAY") return "Сегодня";
    if (formDisplayFilters.whenPreset === "TOMORROW") return "Завтра";
    if (formDisplayFilters.whenPreset === "WEEKEND") return "Выходные";
    
    if (formDisplayFilters.dateFrom) {
      const fromDate = new Date(formDisplayFilters.dateFrom);
      if (formDisplayFilters.dateTo && formDisplayFilters.dateFrom !== formDisplayFilters.dateTo) {
        const toDate = new Date(formDisplayFilters.dateTo);
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
    if (formDisplayFilters.age.length === 0) return "С кем";
    
    const ageLabels = formDisplayFilters.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  const handleSearch = () => {
    // Apply draft filters to URL
    actions.apply();
    // Close any open panels
    setActiveSegment(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      setActiveSegment(null);
      actions.close(); // Revert draft on escape
    }
  };

  // Handle opening a segment - initialize draft
  const handleSegmentClick = (segment: string) => {
    if (activeSegment === segment) {
      setActiveSegment(null);
      actions.close(); // Revert draft when closing
    } else {
      beginDraft(segment as any);
      setActiveSegment(segment);
    }
  };

  // Clear handlers for each segment
  const handleClearLocation = () => {
    actions.setDraft({ nearby: false, metro: null, district: null });
  };

  const handleClearDate = () => {
    actions.setDraft({ dateFrom: null, dateTo: null, whenPreset: null });
  };

  const handleClearAge = () => {
    actions.setDraft({ age: [] });
  };

  // Check if filters are active (use formDisplayFilters for visual feedback)
  const hasLocationFilter = !!(formDisplayFilters.nearby || formDisplayFilters.metro || formDisplayFilters.district);
  const hasDateFilter = !!(formDisplayFilters.dateFrom || formDisplayFilters.dateTo || formDisplayFilters.whenPreset);
  const hasAgeFilter = !!(formDisplayFilters.age && formDisplayFilters.age.length > 0);

  return (
    <div ref={containerRef} className={cn("relative w-full flex items-center gap-3", className)}>
      {/* Search Control - Renders appropriate state based on isCompact prop */}
      <div 
        data-search-container
        className={cn(
          "relative bg-white rounded-full border border-gray-200 shadow-sm hover:shadow-md flex-1 overflow-hidden",
          "transition-[box-shadow] duration-300 ease-out",
          isCompact && "cursor-pointer"
        )}
        onClick={isCompact ? onExpand : undefined}
      >
        {isCompact ? (
          <CompactSearchButton 
            citySlug={citySlug}
            applied={applied}
            apiOptions={safeApiOptions}
            currentIntent={currentIntent}
          />
        ) : (
          <FullSearchForm 
            activeSegment={activeSegment}
            onSegmentClick={handleSegmentClick}
            getLocationText={getLocationText}
            getDateText={getDateText}
            getAgeText={getAgeText}
            locationRef={locationRef}
            dateRef={dateRef}
            ageRef={ageRef}
            onClearLocation={handleClearLocation}
            onClearDate={handleClearDate}
            onClearAge={handleClearAge}
            hasLocationFilter={hasLocationFilter}
            hasDateFilter={hasDateFilter}
            hasAgeFilter={hasAgeFilter}
          />
        )}
      </div>

      {/* Go Button - Only in full state, on the right */}
      {!isCompact && (
        <button
          onClick={handleSearch}
          className="flex items-center justify-center w-[64px] h-[64px] bg-[#EF8759] hover:bg-[#e67c4f] text-white font-semibold rounded-full transition-colors duration-200 shadow-sm flex-shrink-0"
          aria-label="Применить фильтры"
        >
          Go
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
                  left: locationPosition.containerLeft,
                  width: locationPosition.containerWidth,
                  zIndex: 9999,
                }}
              >
                <LocationPanel
                  citySlug={citySlug}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onClose={() => {
                    setActiveSegment(null);
                    actions.close(); // Revert draft when closing
                  }}
                  applied={draft}
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
                  left: datePosition.containerLeft,
                  width: datePosition.containerWidth,
                  zIndex: 9999,
                }}
              >
                <DatePanel
                  onClose={() => {
                    setActiveSegment(null);
                    actions.close(); // Revert draft when closing
                  }}
                  applied={draft}
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
                  left: agePosition.containerLeft,
                  width: agePosition.containerWidth,
                  zIndex: 9999,
                }}
              >
                <AgePanel
                  onClose={() => {
                    setActiveSegment(null);
                    actions.close(); // Revert draft when closing
                  }}
                  applied={draft}
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
}

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
  const FallbackIcon = INTENT_ICONS[currentIntent as keyof typeof INTENT_ICONS] || IconCompass;

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
  
  // Location - Always show city first
  parts.push(getCityDisplayName(citySlug));
  
  // Add nearby if selected
  if (applied.nearby) {
    parts.push("Поблизости");
  }
  
  // Add metro or district (mutually exclusive with nearby)
  if (applied.metro) {
    const metro = safeApiOptions.metros.find((m: any) => m.value === applied.metro);
    parts.push(metro?.label || applied.metro);
  } else if (applied.district) {
    const district = safeApiOptions.districts.find((d: any) => d.value === applied.district);
    parts.push(district?.label || applied.district);
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
      {/* Intent Icon - Reduced by 35% */}
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
  onSegmentClick,
  getLocationText,
  getDateText,
  getAgeText,
  locationRef,
  dateRef,
  ageRef,
  onClearLocation,
  onClearDate,
  onClearAge,
  hasLocationFilter,
  hasDateFilter,
  hasAgeFilter,
}: {
  activeSegment: string | null;
  onSegmentClick: (segment: string) => void;
  getLocationText: () => string;
  getDateText: () => string;
  getAgeText: () => string;
  locationRef: React.RefObject<HTMLButtonElement | null>;
  dateRef: React.RefObject<HTMLButtonElement | null>;
  ageRef: React.RefObject<HTMLButtonElement | null>;
  onClearLocation: () => void;
  onClearDate: () => void;
  onClearAge: () => void;
  hasLocationFilter: boolean;
  hasDateFilter: boolean;
  hasAgeFilter: boolean;
}) {
  return (
    <div className="flex items-center">
      {/* Location Segment - Reduced by 35% */}
      <button
        ref={locationRef}
        onClick={() => onSegmentClick("location")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 rounded-l-full hover:bg-gray-50 transition-colors overflow-hidden relative group",
          activeSegment === "location" && "bg-gray-50"
        )}
      >
        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-900">Куда</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getLocationText()}
          </span>
        </div>
        {hasLocationFilter && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClearLocation();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onClearLocation();
              }
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Очистить местоположение"
          >
            <X className="h-3 w-3 text-gray-600" />
          </div>
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Date Segment - Reduced by 35% */}
      <button
        ref={dateRef}
        onClick={() => onSegmentClick("date")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors overflow-hidden relative group",
          activeSegment === "date" && "bg-gray-50"
        )}
      >
        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-900">Когда</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getDateText()}
          </span>
        </div>
        {hasDateFilter && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClearDate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onClearDate();
              }
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Очистить дату"
          >
            <X className="h-3 w-3 text-gray-600" />
          </div>
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Age Segment - Reduced by 35% */}
      <button
        ref={ageRef}
        onClick={() => onSegmentClick("age")}
        className={cn(
          "flex-1 flex items-center gap-3 px-6 py-4 rounded-r-full hover:bg-gray-50 transition-colors overflow-hidden relative group",
          activeSegment === "age" && "bg-gray-50"
        )}
      >
        <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-xs font-medium text-gray-900">С кем</span>
          <span className="text-sm text-gray-600 truncate w-full text-left">
            {getAgeText()}
          </span>
        </div>
        {hasAgeFilter && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClearAge();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onClearAge();
              }
            }}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Очистить возраст"
          >
            <X className="h-3 w-3 text-gray-600" />
          </div>
        )}
      </button>
    </div>
  );
}