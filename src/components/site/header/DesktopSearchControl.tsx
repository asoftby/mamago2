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
import type { Intent } from "@/lib/intent";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";

/** Как у кнопки «Фильтры» (RefinementFiltersButtonCompact): белый фон, бордер, тень. */
const SEARCH_BAR_EMBEDDED_IN_HEADER_CLASSES =
  "border border-gray-200 bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 ease-out hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus-within:border-gray-300 focus-within:shadow-md";

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
  /** Хаб города: только выбор города, без даты и «с кем». */
  variant?: "discovery" | "cityHub";
  /** Компактный cityHub: иконка раздела вместо MapPin (страница публикации) */
  compactIconIntent?: Intent | null;
}

export function DesktopSearchControl({
  variant = "discovery",
  ...props
}: DesktopSearchControlProps) {
  if (variant === "cityHub") {
    return <CityHubDesktopSearchControl {...props} />;
  }
  return <DiscoveryDesktopSearchControl {...props} />;
}

type CityHubDesktopSearchControlProps = Omit<DesktopSearchControlProps, "variant">;

/** Хаб города: одна капсула «Куда» как в разделах, без даты и «с кем». */
function CityHubDesktopSearchControl({
  citySlug = "minsk",
  className,
  compactIconIntent = null,
  mode,
  activePanel,
  onPanelChange,
  onPanelClose,
  onExpand,
  renderPanels = true,
  embeddedInHeader = false,
}: CityHubDesktopSearchControlProps) {
  const locationRef = useRef<HTMLButtonElement>(null);
  const { applied, actions } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: [],
  };
  const formDisplayFilters = applied;

  const locationPosition = useDropdownPosition(
    locationRef as RefObject<HTMLElement | null>,
    mode === "expanded" && activePanel === "where",
  );

  const getLocationText = () => {
    const parts: string[] = [];
    parts.push(getCityLocativePhrase(citySlug));
    if (formDisplayFilters.nearby) parts.push("Поблизости");
    if (formDisplayFilters.metro) {
      const metro = safeApiOptions.metros.find(
        (m) => m.value === formDisplayFilters.metro,
      );
      parts.push(metro?.label || formDisplayFilters.metro);
    } else if (formDisplayFilters.district) {
      const district = safeApiOptions.districts.find(
        (d) => d.value === formDisplayFilters.district,
      );
      parts.push(district?.label || formDisplayFilters.district);
    }
    return parts.join(" • ");
  };

  const handleSegmentClick = (panel: HeaderPanel) => {
    if (activePanel === panel) {
      onPanelClose();
      actions.close();
    } else {
      onPanelChange(panel);
    }
  };

  const handleClearLocation = () => {
    actions.setDraft({ nearby: false, metro: null, district: null });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onPanelClose();
      actions.close();
    }
  };

  useEffect(() => {
    if (activePanel === "none" || mode !== "expanded") return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const portalPanels = document.querySelectorAll("[data-portal-panel]");
      for (const panel of portalPanels) {
        if (panel.contains(target)) return;
      }
      if (locationRef.current?.contains(target)) return;
      if (target.closest("[data-secondary-filters-slot]")) return;
      if (target.closest("[data-secondary-filters-trigger]")) return;
      if (target.closest('[data-slot="dialog-content"]')) return;
      if (target.closest('[data-slot="dialog-overlay"]')) return;
      onPanelClose();
      actions.close();
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [activePanel, mode, onPanelClose, actions]);

  const hasLocationFilter = !!(
    formDisplayFilters.nearby ||
    formDisplayFilters.metro ||
    formDisplayFilters.district
  );

  return (
    <div className={cn("relative flex w-full min-h-0 items-stretch gap-3", className)}>
      {mode === "compact" ? (
        <button
          type="button"
          data-search-container
          onClick={(e) => {
            e.preventDefault();
            onExpand?.();
          }}
          className={cn(
            "relative min-h-0 w-full flex-1 overflow-hidden rounded-full border border-gray-200 bg-white text-left shadow-sm",
            "transition-[box-shadow,border-color] duration-200 ease-out",
            "hover:shadow-md hover:border-gray-300",
            "focus:shadow-md focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2",
            "cursor-pointer",
          )}
          aria-label="Где: город и район — нажмите, чтобы раскрыть"
        >
          <div className="flex h-full items-center gap-3 px-6 py-3">
            <CompactLocationSummary
              citySlug={citySlug}
              applied={applied}
              apiOptions={safeApiOptions}
              iconIntent={compactIconIntent}
            />
          </div>
        </button>
      ) : (
        <div
          data-search-container
          className={cn(
            "relative flex-1 overflow-hidden rounded-full transition-[box-shadow,border-color,background-color] duration-200 ease-out",
            embeddedInHeader
              ? SEARCH_BAR_EMBEDDED_IN_HEADER_CLASSES
              : "bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 focus-within:shadow-md focus-within:border-gray-300",
            "focus-within:outline-none",
          )}
        >
          <div className="flex w-full items-center">
            <button
              ref={locationRef}
              type="button"
              onClick={() => handleSegmentClick("where")}
              className={cn(
                "group flex w-full flex-1 items-center gap-3 overflow-hidden rounded-full px-6 py-4 text-left transition-[background-color] duration-200 ease-out",
                "hover:bg-gray-50",
                activePanel === "where" && "bg-gray-50",
              )}
            >
              <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="text-xs font-medium text-gray-900">Где?</span>
                <span className="w-full truncate text-left text-sm text-gray-600">
                  {getLocationText()}
                </span>
              </div>
              {hasLocationFilter ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearLocation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClearLocation();
                    }
                  }}
                  className="flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-200 opacity-0 transition-[opacity,background-color] duration-200 ease-out hover:bg-gray-300 group-hover:opacity-100"
                  aria-label="Очистить местоположение"
                >
                  <X className="h-3 w-3 text-gray-600" />
                </div>
              ) : null}
            </button>
          </div>
        </div>
      )}

      {mode === "expanded" && renderPanels && activePanel === "where" ? (
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
              variant="cityHub"
              citySlug={citySlug}
              searchText=""
              onSearchTextChange={() => {}}
              onClose={() => {
                onPanelClose();
                actions.close();
              }}
              applied={applied}
              actions={actions}
              apiOptions={safeApiOptions}
            />
          </div>
        </Portal>
      ) : null}

      {mode === "expanded" && activePanel !== "none" ? (
        <div
          className="fixed inset-0 z-[-1]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}

/** Компактный хаб: как на главной — одна строка локации; при `iconIntent` — иконка раздела вместо MapPin. */
function CompactLocationSummary({
  citySlug,
  applied,
  apiOptions: safeApiOptions,
  iconIntent = null,
}: {
  citySlug: string;
  applied: any;
  apiOptions: any;
  iconIntent?: Intent | null;
}) {
  const INTENT_ICONS = {
    kuda: IconCompass,
    classes: IconPalette,
    birthday: IconParty,
    routes: IconMap,
  };

  const parts: string[] = [];
  parts.push(getCityLocativePhrase(citySlug));
  if (applied.nearby) parts.push("Поблизости");
  if (applied.metro) {
    const metro = safeApiOptions.metros.find(
      (m: any) => m.value === applied.metro,
    );
    parts.push(metro?.label || applied.metro);
  } else if (applied.district) {
    const district = safeApiOptions.districts.find(
      (d: any) => d.value === applied.district,
    );
    parts.push(district?.label || applied.district);
  }

  const summaryText = parts.length > 0 ? parts.join(" • ") : "Поиск";

  const intentKey = iconIntent ?? null;
  const intentConfig =
    intentKey != null
      ? DISCOVERY_INTENT_CONFIG[intentKey as keyof typeof DISCOVERY_INTENT_CONFIG]
      : null;
  const FallbackIcon =
    intentKey != null
      ? INTENT_ICONS[intentKey as keyof typeof INTENT_ICONS] || IconCompass
      : null;

  return (
    <>
      {intentKey != null && intentConfig && FallbackIcon ? (
        <div className="flex-shrink-0">
          {intentConfig.image ? (
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
      ) : (
        <MapPin className="h-[21px] w-[21px] flex-shrink-0 text-gray-400" />
      )}
      <span className="flex-1 truncate text-sm text-gray-700">{summaryText}</span>
    </>
  );
}

type DiscoveryDesktopSearchControlProps = Omit<DesktopSearchControlProps, "variant">;

function DiscoveryDesktopSearchControl({
  citySlug = "minsk",
  className,
  currentIntent,
  compactIconIntent: _compactIconIntent,
  mode,
  activePanel,
  onPanelChange,
  onPanelClose,
  onExpand,
  renderPanels = true,
  embeddedInHeader = false,
}: DiscoveryDesktopSearchControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const ageRef = useRef<HTMLButtonElement>(null);
  
  const { applied, actions } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);
  
  // Fallback options if API fails
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: []
  };
  
  const formDisplayFilters = applied;
  
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
  
  // Build location display text
  const getLocationText = () => {
    const parts = [];
    
    // Always show city first
    parts.push(getCityLocativePhrase(citySlug));
    
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
    
    return "Выберите дату";
  };

  // Build age display text
  const getAgeText = () => {
    if (formDisplayFilters.age.length === 0) return "Выберите возраст";
    
    const ageLabels = formDisplayFilters.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onPanelClose();
      actions.close();
    }
  };

  // Handle opening a segment - initialize draft
  const handleSegmentClick = (panel: HeaderPanel) => {
    if (activePanel === panel) {
      onPanelClose();
      actions.close(); // Revert draft when closing
    } else {
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
      
      if (target.closest("[data-secondary-filters-slot]")) return;
      if (target.closest("[data-secondary-filters-trigger]")) return;
      if (target.closest('[data-slot="dialog-content"]')) return;
      if (target.closest('[data-slot="dialog-overlay"]')) return;

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

  const showSecondaryFiltersInBar =
    mode === "expanded" &&
    !!currentIntent &&
    DISCOVERY_INTENT_CONFIG[currentIntent as Intent]?.hasFilters === true;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full min-h-0 items-stretch gap-3",
        /* Обёртка прозрачная — фон хедера (градиент) виден; белые капсулы внутри. */
        showSecondaryFiltersInBar &&
          "rounded-[28px] bg-transparent p-1.5",
        className,
      )}
    >
      
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
            "relative min-h-0 w-full flex-1 overflow-hidden rounded-full border border-gray-200 bg-white text-left shadow-sm",
            "transition-[box-shadow,border-color] duration-200 ease-out",
            "hover:shadow-md hover:border-gray-300",
            "focus:shadow-md focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2",
            "cursor-pointer"
          )}
          aria-label="Поиск: место, дата, возраст — нажмите, чтобы раскрыть"
        >
          <div className="flex h-full items-center gap-3 px-6 py-3">
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
            "relative flex-1 overflow-hidden rounded-full transition-[box-shadow,border-color,background-color] duration-200 ease-out",
            embeddedInHeader
              ? SEARCH_BAR_EMBEDDED_IN_HEADER_CLASSES
              : showSecondaryFiltersInBar
                ? "border border-gray-200 bg-white shadow-none hover:border-gray-300 focus-within:border-gray-300"
                : "border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 focus-within:shadow-md focus-within:border-gray-300",
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
                <span className="text-xs font-medium text-gray-900">Где?</span>
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
                <span className="text-xs font-medium text-gray-900">Когда?</span>
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
                <span className="text-xs font-medium text-gray-900">С кем?</span>
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

      {/* Secondary filters — [ Куда ][ Когда ][ С кем ] [ Фильтры ] */}
      {showSecondaryFiltersInBar && currentIntent && (
        <div data-secondary-filters-slot className="flex shrink-0 items-stretch self-stretch">
          <RefinementFiltersButtonCompact intent={currentIntent as Intent} />
        </div>
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
                    actions.close();
                  }}
                  applied={applied}
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
                    actions.close();
                  }}
                  applied={applied}
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
                    actions.close();
                  }}
                  applied={applied}
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

  const locationParts: string[] = [getCityLocativePhrase(citySlug)];
  if (applied.nearby) locationParts.push("Поблизости");
  if (applied.metro) {
    const metro = safeApiOptions.metros.find((m: any) => m.value === applied.metro);
    locationParts.push(metro?.label || applied.metro);
  } else if (applied.district) {
    const district = safeApiOptions.districts.find((d: any) => d.value === applied.district);
    locationParts.push(district?.label || applied.district);
  }
  const locationLine = locationParts.join(" • ");

  const dateLine = (() => {
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
        }
        return `${fromDay} ${months[fromMonth]}–${toDay} ${months[toMonth]}`;
      }
      const day = fromDate.getDate();
      const month = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][fromDate.getMonth()];
      return `${day} ${month}`;
    }
    return null;
  })();

  const ageLine = (() => {
    if (applied.age.length === 0) return null;
    const ageLabels = applied.age.map((ageValue: string) => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  })();

  const summaryText = [locationLine, dateLine, ageLine]
    .filter((p): p is string => p != null && p !== "")
    .join(" • ");

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