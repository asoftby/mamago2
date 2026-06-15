"use client";

import { useRef, RefObject, useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, Users, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { FilterOption } from "@/features/filters/discovery/filters.api";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { useOptionalHeaderDiscoveryFilters } from "@/features/filters/discovery/headerDiscoveryFiltersContext";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useChildrenScope } from "@/features/filters/discovery/childrenScope.store";
import { MAX_ACTIVE_FAMILY_PERSONAS } from "@/lib/family/wholeFamilyPreset";
import { formatWhoHeaderSummary } from "@/lib/family/formatWhoHeaderSummary";
import {
  hasSelectedChildren as familyHasSelectedChildren,
  resolveFamilyAgeMode,
} from "@/lib/family/familyAgeMode";
import { mapPlanParticipantsToAudience } from "@/lib/family/audienceSyncMapper";
import { togglePersonaId } from "@/lib/family/togglePersonaSelection";
import { LocationPanel, DatePanel, AgePanel } from "./search-segments";
import { Portal } from "@/components/ui/portal";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { IconCompass, IconPalette, IconParty, IconMap } from "@/components/ui/icons";
import type { HeaderPanel } from "@/hooks/useStableHeaderBehavior";
import type { Intent } from "@/lib/intent";
import { RefinementFiltersButtonCompact } from "@/components/discovery/RefinementFiltersButtonCompact";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";

/** Как у кнопки «Фильтры» (RefinementFiltersButtonCompact): белый фон, бордер, тень. */
const SEARCH_BAR_EMBEDDED_IN_HEADER_CLASSES =
  "border border-gray-200 bg-white shadow-sm transition-[box-shadow,border-color,background-color] duration-200 ease-out hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus-within:border-gray-300 focus-within:shadow-md";

type SearchMode = "compact" | "expanded";

type ProfileChildFilterOption = {
  id: string;
  name: string;
  birthDate?: string;
};

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
  /** Посадочные страницы: без кнопки «Фильтры» рядом с поиском */
  hideSecondaryFilters?: boolean;
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
  const headerGeoFilters = useOptionalHeaderDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug, {
    defer: true,
  });
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
    const cityPhrase = getCityLocativePhrase(citySlug);
    const nearbyPart = formDisplayFilters.nearby ? "Поблизости" : null;
    
    let metroOrDistrictPart: string | null = null;
    if (formDisplayFilters.metro) {
      const metro = safeApiOptions.metros.find(
        (m) => m.value === formDisplayFilters.metro,
      );
      metroOrDistrictPart = metro?.label || formDisplayFilters.metro;
    } else if (formDisplayFilters.district) {
      const district = safeApiOptions.districts.find(
        (d) => d.value === formDisplayFilters.district,
      );
      metroOrDistrictPart = district?.label || formDisplayFilters.district;
    }
    
    const parts = [cityPhrase, nearbyPart, metroOrDistrictPart].filter((p): p is string => p != null);
    return parts.join(" • ");
  };

  const handleSegmentClick = (panel: HeaderPanel) => {
    if (activePanel === panel) {
      onPanelClose();
      actions.close();
    } else {
      if (panel === "where") {
        void headerGeoFilters?.loadGeoFilters(citySlug);
      }
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

  const loadHeaderGeoFilters = headerGeoFilters?.loadGeoFilters;
  const headerGeoCitySlug = headerGeoFilters?.citySlug;

  useEffect(() => {
    if (!loadHeaderGeoFilters || headerGeoCitySlug !== citySlug) {
      return;
    }
    if (!applied.metro && !applied.district) {
      return;
    }
    void loadHeaderGeoFilters(citySlug);
  }, [applied.district, applied.metro, citySlug, headerGeoCitySlug, loadHeaderGeoFilters]);

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
            void headerGeoFilters?.loadGeoFilters(citySlug);
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
                <span className="text-xs text-gray-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>Где?</span>
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
  applied: DiscoveryFilters;
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
  iconIntent?: Intent | null;
}) {
  const INTENT_ICONS = {
    kuda: IconCompass,
    classes: IconPalette,
    birthday: IconParty,
    routes: IconMap,
  };

  const cityPhrase = getCityLocativePhrase(citySlug);
  const nearbyPart = applied.nearby ? "Поблизости" : null;
  
  let metroOrDistrictPart: string | null = null;
  if (applied.metro) {
    const metro = safeApiOptions.metros.find(
      (m) => m.value === applied.metro,
    );
    metroOrDistrictPart = metro?.label || applied.metro;
  } else if (applied.district) {
    const district = safeApiOptions.districts.find(
      (d) => d.value === applied.district,
    );
    metroOrDistrictPart = district?.label || applied.district;
  }

  const parts = [cityPhrase, nearbyPart, metroOrDistrictPart].filter((p): p is string => p != null);
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
  hideSecondaryFilters = false,
}: DiscoveryDesktopSearchControlProps) {
  const router = useRouter();
  /** Вторичная панель «Фильтры» рендерится после mount, чтобы SSR и первый CSR были идентичны. */
  const [secondaryFiltersMounted, setSecondaryFiltersMounted] = useState(false);
  const [pendingCitySlug, setPendingCitySlug] = useState(citySlug);
  const headerGeoFilters = useOptionalHeaderDiscoveryFilters();

  const containerRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const ageRef = useRef<HTMLButtonElement>(null);
  
  const { applied, actions } = useDiscoveryFilters();
  const { options: apiOptions } = useDiscoveryFilterOptions(pendingCitySlug, {
    defer: true,
  });
  const { isAuthenticated, isLoading: authLoading } = useAuthMe();
  const family = useFamilyPersona();
  const profileChildren: ProfileChildFilterOption[] =
    isAuthenticated && family && !family.loading
      ? family.childPersonasForFilter
      : [];
  
  // Fallback options if API fails
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: []
  };
  
  const formDisplayFilters = applied;

  const setAppliedAgeRanges = (nextAge: string[]) => {
    actions.setDraft({ age: nextAge });
  };

  const childrenFamilySync = useMemo(
    () =>
      isAuthenticated && family
        ? {
            loading: family.loading,
            selectedPersonaIds: family.selectedPersonaIds,
            primaryAdultPersonaId: family.primaryAdultPersonaId,
            setSelectedPersonaIds: family.setSelectedPersonaIds,
          }
        : undefined,
    [
      isAuthenticated,
      family,
      family?.loading,
      family?.selectedPersonaIds,
      family?.primaryAdultPersonaId,
      family?.setSelectedPersonaIds,
    ],
  );

  const childrenScope = useChildrenScope({
    citySlug,
    availableChildren: isAuthenticated ? profileChildren : [],
    appliedAgeRanges: applied.age ?? [],
    setAppliedAgeRanges,
    familySync: childrenFamilySync,
  });

  const showChildrenPreset = isAuthenticated && profileChildren.length > 0;
  const allowMultiChildSelect = profileChildren.length >= 2;
  // Always use first persona ID if it's an adult
  const primaryAdultPersonaId = family?.personas?.[0]?.kind === "adult" ? family.personas[0].id : null;
  const adultSelected =
    !!primaryAdultPersonaId &&
    !!family?.selectedPersonaIds.includes(primaryAdultPersonaId);

  const profileChildIds = useMemo(
    () => profileChildren.map((c) => c.id),
    [profileChildren],
  );
  const hasSelectedChildren = familyHasSelectedChildren(
    family?.selectedPersonaIds ?? [],
    profileChildIds,
  );
  const ageMode = resolveFamilyAgeMode({
    hasProfileChildren: showChildrenPreset,
    selectedPersonaIds: family?.selectedPersonaIds ?? [],
    profileChildIds,
  });

  const whoPrimaryLine = useMemo(() => {
    if (ageMode === "free" && showChildrenPreset) {
      return "Свободный поиск";
    }
    return formatWhoHeaderSummary({
      hasSelectedChildren,
      selectedPersonaIds: family?.selectedPersonaIds ?? [],
      personas: family?.personas ?? [],
      fallbackAgeValues: formDisplayFilters.age ?? [],
    });
  }, [
    ageMode,
    showChildrenPreset,
    hasSelectedChildren,
    family?.selectedPersonaIds,
    family?.personas,
    formDisplayFilters.age,
  ]);

  useEffect(() => {
    setPendingCitySlug(citySlug);
  }, [citySlug]);

  const loadDiscoveryHeaderGeoFilters = headerGeoFilters?.loadGeoFilters;
  const discoveryHeaderGeoCitySlug = headerGeoFilters?.citySlug;

  useEffect(() => {
    if (!loadDiscoveryHeaderGeoFilters || discoveryHeaderGeoCitySlug !== citySlug) {
      return;
    }
    if (!formDisplayFilters.metro && !formDisplayFilters.district) {
      return;
    }
    void loadDiscoveryHeaderGeoFilters(citySlug);
  }, [
    citySlug,
    formDisplayFilters.district,
    formDisplayFilters.metro,
    discoveryHeaderGeoCitySlug,
    loadDiscoveryHeaderGeoFilters,
  ]);

  useEffect(() => {
    setSecondaryFiltersMounted(true);
  }, []);

  const buildCityDiscoveryHref = (nextCitySlug: string) => {
    if (!currentIntent) return `/${nextCitySlug}`;
    const intentConfig =
      DISCOVERY_INTENT_CONFIG[currentIntent as keyof typeof DISCOVERY_INTENT_CONFIG];
    return intentConfig?.href(nextCitySlug) ?? `/${nextCitySlug}`;
  };

  const commitCitySelection = (nextCitySlug: string) => {
    if (nextCitySlug === citySlug) return;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Home/CityDropdown] city commit", {
        from: citySlug,
        to: nextCitySlug,
      });
    }
    router.push(buildCityDiscoveryHref(nextCitySlug), { scroll: false });
  };

  /**
   * Toggle persona selection - same logic as in My Plan
   */
  const togglePersona = (personaId: string) => {
    if (!family?.setSelectedPersonaIds) return;
    
    const isSelected = family.selectedPersonaIds.includes(personaId);
    
    if (isSelected) {
      // Deselect persona
      const newIds = family.selectedPersonaIds.filter((id) => id !== personaId);
      family.setSelectedPersonaIds(newIds);
      
      // If no personas left, clear age filters (enters free search mode)
      if (newIds.length === 0) {
        actions.setDraft({ age: [] });
      } else {
        // Sync age filters based on remaining personas
        const newAudience = mapPlanParticipantsToAudience(newIds, family.personas ?? []);
        actions.setDraft({ age: newAudience });
      }
    } else {
      // Select persona (exits free search mode automatically)
      const newIds = [...family.selectedPersonaIds, personaId];
      family.setSelectedPersonaIds(newIds);
      
      // Sync age filters based on new personas
      const newAudience = mapPlanParticipantsToAudience(newIds, family.personas ?? []);
      actions.setDraft({ age: newAudience });
    }
  };

  /**
   * Toggle free search mode - clears all persona selections
   */
  const handleSelectFreeMode = () => {
    if (!family?.setSelectedPersonaIds) return;
    
    // Switch to free mode: clear all selections via FamilyPersonaContext
    family.setSelectedPersonaIds([]);
    // Clear age filters
    actions.setDraft({ age: [] });
  };

  const toggleChild = (childId: string) => {
    togglePersona(childId);
  };

  const toggleAdult = () => {
    if (!primaryAdultPersonaId) return;
    togglePersona(primaryAdultPersonaId);
  };

  const ageLinkedActions = useMemo(
    () => ({
      setDraft: (patch: Partial<typeof applied>) => {
        if (Array.isArray(patch.age)) {
          if (ageMode === "derived") {
            return;
          }
          actions.setDraft({ age: patch.age });
          return;
        }
        actions.setDraft(patch);
      },
    }),
    [actions, ageMode],
  );
  
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
    const effectiveCitySlug =
      mode === "expanded" && activePanel === "where"
        ? pendingCitySlug
        : citySlug;
    const cityPhrase = getCityLocativePhrase(effectiveCitySlug);
    const nearbyPart = formDisplayFilters.nearby ? "Поблизости" : null;
    
    let metroOrDistrictPart: string | null = null;
    if (formDisplayFilters.metro) {
      const metro = safeApiOptions.metros.find(m => m.value === formDisplayFilters.metro);
      metroOrDistrictPart = metro?.label || formDisplayFilters.metro;
    } else if (formDisplayFilters.district) {
      const district = safeApiOptions.districts.find(d => d.value === formDisplayFilters.district);
      metroOrDistrictPart = district?.label || formDisplayFilters.district;
    }
    
    const parts = [cityPhrase, nearbyPart, metroOrDistrictPart].filter((p): p is string => p != null);
    return parts.join(" • ");
  };

  // Build date display text
  const getDateText = () => {
    if (formDisplayFilters.whenPreset === "TODAY") return "Сегодня";
    if (formDisplayFilters.whenPreset === "TOMORROW") return "Завтра";
    if (formDisplayFilters.whenPreset === "WEEKEND") return "На выходных";
    
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
      if (panel === "where") {
        void headerGeoFilters?.loadGeoFilters(pendingCitySlug);
      }
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
    if (ageMode === "free" && showChildrenPreset) {
      actions.setDraft({ age: [] });
      return;
    }
    if (family?.primaryAdultPersonaId && showChildrenPreset) {
      family.setSelectedPersonaIds([]);
      actions.setDraft({ age: [] });
    } else {
      actions.setDraft({ age: [] });
      childrenScope.setSelectedChildrenIds([]);
    }
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

      // Любой другой клик - только закрываем панель
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
  const hasWhoSelection =
    hasAgeFilter ||
    childrenScope.selectedChildrenIds.length > 0 ||
    (primaryAdultPersonaId ? adultSelected : false);

  const showSecondaryFiltersInBar =
    !hideSecondaryFilters &&
    secondaryFiltersMounted &&
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
            void headerGeoFilters?.loadGeoFilters(citySlug);
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
              whoSummaryLine={whoPrimaryLine}
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
                <span className="text-xs text-gray-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>Где?</span>
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
                <span className="text-xs text-gray-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>Когда?</span>
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
                <span className="text-xs text-gray-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>Для кого?</span>
                <span className="text-sm text-gray-600 truncate w-full text-left" suppressHydrationWarning>
                  {whoPrimaryLine}
                </span>
              </div>
              {hasWhoSelection && (
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
                  citySlug={pendingCitySlug}
                  selectedCitySlug={pendingCitySlug}
                  onCityPick={(slug) => {
                    if (slug === pendingCitySlug) {
                      return;
                    }
                    setPendingCitySlug(slug);
                    actions.setDraft({ nearby: false, metro: null, district: null });
                    commitCitySelection(slug);
                  }}
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
                  actions={ageLinkedActions}
                  selectedChildIds={childrenScope.selectedChildrenIds}
                  selectedPersonaIds={family?.selectedPersonaIds ?? []}
                  availableChildren={showChildrenPreset ? profileChildren : []}
                  onToggleChild={showChildrenPreset ? toggleChild : undefined}
                  primaryAdult={
                    family?.personas?.[0]?.kind === "adult"
                      ? {
                          id: family.personas[0].id,
                          displayName: family.personas[0].displayName,
                          birthDate: family.personas[0].birthDate ?? undefined,
                          isProfileComplete: family.personas[0].isProfileComplete,
                        }
                      : null
                  }
                  adultSelected={adultSelected}
                  onToggleAdult={family ? toggleAdult : undefined}
                  ageMode={ageMode}
                  autoAgeValues={childrenScope.autoAgeValues}
                  personaPickAtLimit={
                    !!family && family.selectedPersonaIds.length >= MAX_ACTIVE_FAMILY_PERSONAS
                  }
                  whoFreeMode={ageMode === "free"}
                  onSelectEveryone={
                    family
                      ? handleSelectFreeMode
                      : undefined
                  }
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
  currentIntent,
  whoSummaryLine,
}: {
  citySlug: string;
  applied: DiscoveryFilters;
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
  currentIntent: string;
  /** Строка «Для кого» — та же, что в раскрытом хедере */
  whoSummaryLine?: string;
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

  const locationParts = [
    getCityLocativePhrase(citySlug),
    applied.nearby ? "Поблизости" : null,
    (() => {
      if (applied.metro) {
        const metro = safeApiOptions.metros.find((m) => m.value === applied.metro);
        return metro?.label || applied.metro;
      } else if (applied.district) {
        const district = safeApiOptions.districts.find((d) => d.value === applied.district);
        return district?.label || applied.district;
      }
      return null;
    })(),
  ].filter((p): p is string => p != null);
  const locationLine = locationParts.join(" • ");

  const dateLine = (() => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") return "На выходных";
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

  const ageLine =
    whoSummaryLine ??
    (() => {
      if (applied.age.length === 0) return null;
      const ageLabels = applied.age.map((ageValue: string) => {
        const group = AGE_GROUPS.find((g) => g.value === ageValue);
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
      <span className="text-sm text-gray-700 truncate flex-1" suppressHydrationWarning>
        {summaryText}
      </span>
    </>
  );
}
