"use client";

import { useRef, RefObject, useEffect } from "react";
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
import type { HeaderPanel } from "@/hooks/useStableHeaderBehavior";

type SearchMode = "compact" | "expanded";

interface DesktopSearchControlProps {
  citySlug?: string;
  className?: string;
  currentIntent?: string | null;
  mode: SearchMode;
  activePanel: HeaderPanel;
  onPanelChange: (panel: HeaderPanel) => void;
  onPanelClose: () => void;
  onExpand?: () => void; // Only used in compact mode
  /** Рендерить выпадающие панели (Куда/Когда/С кем). false — чтобы убрать дубль, когда в DOM два экземпляра формы. */
  renderPanels?: boolean;
  /** Визуально встроена в хедер — без отдельного блока (мягкая обводка, без тени). */
  embeddedInHeader?: boolean;
}

export function DesktopSearchControl({ 
  citySlug = "minsk", 
  className,
  currentIntent,
  mode,
  activePanel,
  onPanelChange,
  onPanelClose,
  onExpand,
  renderPanels = true,
  embeddedInHeader = false
}: DesktopSearchControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const ageRef = useRef<HTMLButtonElement>(null);
  
  const { applied, draft, actions, beginDraft } = useDiscoveryFilters();
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
  
  // Calculate positions for each dropdown (only in expanded mode)
  const locationPosition = useDropdownPosition(
    locationRef as RefObject<HTMLElement | null>, 
    mode === "expanded" && activePanel === "where"
  );
  const datePosition = useDropdownPosition(
    dateRef as RefObject<HTMLElement | null>, 
    mode === "expanded" && activePanel === "when"
  );
  const agePosition = useDropdownPosition(
    ageRef as RefObject<HTMLElement | null>, 
    mode === "expanded" && activePanel === "who"
  );
  
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
    onPanelClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
    if (e.key === "Escape") {
      onPanelClose();
      actions.close(); // Revert draft on escape
    }
  };

  // Handle opening a segment - initialize draft
  const handleSegmentClick = (panel: HeaderPanel) => {
    if (activePanel === panel) {
      onPanelClose();
      actions.close(); // Revert draft when closing
    } else {
      beginDraft(panel as any);
      onPanelChange(panel);
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

  // Handle outside clicks to close panels
  useEffect(() => {
    if (activePanel === "none" || mode !== "expanded") {
      return;
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Проверяем клик внутри любых portal панелей (dropdown'ы поиска)
      const portalPanels = document.querySelectorAll('[data-portal-panel]');
      for (const panel of portalPanels) {
        if (panel.contains(target)) {
          return; // Игнорируем клики внутри dropdown'ов
        }
      }
      
      // Проверяем клик по сегментам формы поиска (кнопки Куда/Когда/С кем)
      if (locationRef.current && locationRef.current.contains(target)) {
        return; // Игнорируем клики по кнопкам сегментов
      }
      if (dateRef.current && dateRef.current.contains(target)) {
        return;
      }
      if (ageRef.current && ageRef.current.contains(target)) {
        return;
      }
      
      // Проверяем клик по кнопке Go
      const goButton = containerRef.current?.querySelector('[aria-label="Применить фильтры"]');
      if (goButton && goButton.contains(target)) {
        return; // Игнорируем клики по кнопке Go
      }
      
      // Любой другой клик - закрываем панель
      onPanelClose();
      actions.close(); // Revert draft when closing
    };
    
    // Используем capture phase для более надежного перехвата
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [activePanel, mode, onPanelClose, actions]);

  // Check if filters are active (use formDisplayFilters for visual feedback)
  const hasLocationFilter = !!(formDisplayFilters.nearby || formDisplayFilters.metro || formDisplayFilters.district);
  const hasDateFilter = !!(formDisplayFilters.dateFrom || formDisplayFilters.dateTo || formDisplayFilters.whenPreset);
  const hasAgeFilter = !!(formDisplayFilters.age && formDisplayFilters.age.length > 0);

  return (
    <div ref={containerRef} className={cn("relative w-full flex items-center gap-3", className)}>
      
      {/* SEARCH SHELL - В compact: вся капсула (поле «Минск») — одна кнопка, клик открывает раскрытый хедер */}
      {mode === "compact" ? (
        <button
          type="button"
          data-search-container
          onClick={(e) => {
            e.preventDefault();
            onExpand?.();
          }}
          className={cn(
            "relative w-full bg-white rounded-full border border-gray-200 shadow-sm flex-1 overflow-hidden text-left",
            "transition-[box-shadow,border-color] duration-200 ease-out",
            "hover:shadow-md hover:border-gray-300",
            "focus:shadow-md focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2",
            "cursor-pointer"
          )}
          aria-label="Поиск: место, дата, возраст — нажмите, чтобы раскрыть"
        >
          <div className="flex items-center gap-3 px-6 py-3">
            <CompactSearchSummary 
              citySlug={citySlug}
              applied={applied}
              apiOptions={safeApiOptions}
              currentIntent={currentIntent || "kuda"}
            />
          </div>
        </button>
      ) : (
        <div 
          data-search-container
          className={cn(
            "relative flex-1 overflow-hidden rounded-full transition-[box-shadow,border-color] duration-200 ease-out",
            embeddedInHeader
              ? "border border-gray-100 bg-gray-50/80 hover:border-gray-200 focus-within:border-gray-200"
              : "bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 focus-within:shadow-md focus-within:border-gray-300",
            "focus-within:outline-none"
          )}
        >
          {/* EXPANDED MODE - Full segmented form */}
          <div className="flex items-center w-full">
            
            {/* Location Segment */}
            <button
              ref={locationRef}
              onClick={() => handleSegmentClick("where")}
              className={cn(
                "flex-1 flex items-center gap-3 px-6 py-4 rounded-l-full hover:bg-gray-50 transition-[background-color] duration-200 ease-out overflow-hidden relative group",
                activePanel === "where" && "bg-gray-50"
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
                    handleClearLocation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClearLocation();
                    }
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-[opacity,background-color] duration-200 ease-out flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                  aria-label="Очистить местоположение"
                >
                  <X className="h-3 w-3 text-gray-600" />
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200" />

            {/* Date Segment */}
            <button
              ref={dateRef}
              onClick={() => handleSegmentClick("when")}
              className={cn(
                "flex-1 flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-[background-color] duration-200 ease-out overflow-hidden relative group",
                activePanel === "when" && "bg-gray-50"
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
                    handleClearDate();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClearDate();
                    }
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-[opacity,background-color] duration-200 ease-out flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                  aria-label="Очистить дату"
                >
                  <X className="h-3 w-3 text-gray-600" />
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200" />

            {/* Age Segment */}
            <button
              ref={ageRef}
              onClick={() => handleSegmentClick("who")}
              className={cn(
                "flex-1 flex items-center gap-3 px-6 py-4 rounded-r-full hover:bg-gray-50 transition-[background-color] duration-200 ease-out overflow-hidden relative group",
                activePanel === "who" && "bg-gray-50"
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
                    handleClearAge();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClearAge();
                    }
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-[opacity,background-color] duration-200 ease-out flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                  aria-label="Очистить возраст"
                >
                  <X className="h-3 w-3 text-gray-600" />
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* GO BUTTON - Only visible in expanded mode */}
      {mode === "expanded" && (
        <button
          onClick={handleSearch}
          className="flex items-center justify-center w-[64px] h-[64px] bg-[#EF8759] hover:bg-[#e67c4f] text-white font-semibold rounded-full transition-colors duration-200 shadow-sm flex-shrink-0"
          aria-label="Применить фильтры"
        >
          Go
        </button>
      )}

      {/* PANELS - только у того экземпляра формы, который по ширине открыт (без дубля) */}
      {mode === "expanded" && renderPanels && (
        <>
          {activePanel === "where" && (
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
                  searchText=""
                  onSearchTextChange={() => {}}
                  onClose={() => {
                    onPanelClose();
                    actions.close(); // Revert draft when closing
                  }}
                  applied={draft}
                  actions={actions}
                  apiOptions={safeApiOptions}
                />
              </div>
            </Portal>
          )}

          {activePanel === "when" && (
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
                    onPanelClose();
                    actions.close(); // Revert draft when closing
                  }}
                  applied={draft}
                  actions={actions}
                />
              </div>
            </Portal>
          )}

          {activePanel === "who" && (
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
                    onPanelClose();
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

      {/* Keyboard handler - Only in expanded mode */}
      {mode === "expanded" && activePanel !== "none" && (
        <div
          className="fixed inset-0 z-[-1]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        />
      )}
    </div>
  );
}

// Compact Search Summary Component
function CompactSearchSummary({ 
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
    <>
      {/* Intent Icon */}
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
    </>
  );
}