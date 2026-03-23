"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { DatePanel, AgePanel } from "@/components/site/header/search-segments";
import { MobileLocationPanel } from "@/components/mobile/panels/MobileLocationPanel";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useSearchParams } from "next/navigation";

interface MobileSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  citySlug?: string;
  currentIntent?: string; // Add current intent prop
  /** Городской хаб: поиск + город, как на десктопе */
  cityHubOnly?: boolean;
}

type ExpandedSection = 'location' | 'date' | 'age' | null;

export function MobileSearchSheet({
  isOpen,
  onClose,
  citySlug = "minsk",
  currentIntent,
  cityHubOnly = false,
}: MobileSearchSheetProps) {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [searchText, setSearchText] = useState("");
  // Default to "kuda" if no currentIntent is provided
  const [selectedIntent, setSelectedIntent] = useState(currentIntent || "kuda");
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const { applied, actions, derived } = useDiscoveryFilters();

  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);
  const safeApiOptions = apiOptions || {
    districts: [],
    metros: [],
    categories: []
  };

  // Update selected intent when currentIntent changes or when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Set to currentIntent if provided, otherwise default to "kuda"
      setSelectedIntent(currentIntent || "kuda");
    }
  }, [currentIntent, isOpen]);

  // Update indicator position when selected intent changes
  useEffect(() => {
    const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(item => item.id === selectedIntent);
    const currentTab = tabsRef.current[activeIndex];
    if (currentTab && containerRef.current) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.clientWidth
      });
    }
  }, [selectedIntent]);

  // Initialize indicator position when sheet opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        const activeIndex = DISCOVERY_INTENT_ITEMS.findIndex(item => item.id === selectedIntent);
        const currentTab = tabsRef.current[activeIndex];
        if (currentTab && containerRef.current) {
          setIndicatorStyle({
            left: currentTab.offsetLeft,
            width: currentTab.clientWidth
          });
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedIntent]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (cityHubOnly) {
    const handleClearLocationHub = () => {
      actions.setDraft({ nearby: false, metro: null, district: null });
    };
    const hasLocationDirty =
      !!applied.nearby || !!applied.metro || !!applied.district;

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="-ml-2 rounded-full p-2 transition-colors hover:bg-gray-100"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Поиск</h2>
            <div className="w-10" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Как в разделах: глобальный поиск сверху, ниже — город */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <input
                type="search"
                enterKeyHint="search"
                placeholder="Поиск мест, событий, активностей..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#EF8759]"
              />
              {searchText ? (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-gray-100"
                  aria-label="Очистить поле"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="px-4 pb-4">
            <MobileLocationPanel
              variant="cityHub"
              citySlug={citySlug}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              onClose={onClose}
              draft={applied}
              setDraft={actions.setDraft}
              actions={actions}
              apiOptions={safeApiOptions}
            />
          </div>
        </div>
        <div className="sticky bottom-0 border-t border-gray-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearLocationHub}
              disabled={!hasLocationDirty}
              className={cn(
                "rounded-xl px-4 py-3 font-medium transition-colors",
                hasLocationDirty
                  ? "cursor-pointer text-gray-900 hover:bg-gray-100 active:bg-gray-200"
                  : "cursor-not-allowed text-gray-400",
              )}
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-[#EF8759] py-4 font-semibold text-white transition-colors hover:bg-[#e67c4f] active:scale-[0.98]"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleIntentSelect = (intentId: string) => {
    setSelectedIntent(intentId);
    const intentConfig = DISCOVERY_INTENT_ITEMS.find((item) => item.id === intentId);
    if (!intentConfig) return;
    const qs = searchParams.toString();
    const targetUrl =
      intentConfig.href(citySlug) + (qs ? `?${qs}` : "");
    router.replace(targetUrl);
  };

  const handleClearAll = () => {
    actions.resetAll();
    setSearchText("");
    setExpandedSection(null);
  };

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

  // Build location display text as a list of selected items
  const getLocationText = () => {
    const items: string[] = [];
    
    // Always show city first
    items.push(getCityDisplayName(citySlug));
    
    // Add "Поблизости" if selected
    if (applied.nearby) {
      items.push("Поблизости");
    }
    
    // Add metro station if selected
    if (applied.metro) {
      const metro = safeApiOptions.metros.find(m => m.value === applied.metro);
      if (metro) items.push(metro.label);
    }
    
    // Add district if selected
    if (applied.district) {
      const district = safeApiOptions.districts.find(d => d.value === applied.district);
      if (district) items.push(district.label);
    }
    
    // Join with bullet separator
    return items.join(" • ");
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
    
    return "Выберите даты";
  };

  // Build age display text
  const getAgeText = () => {
    if (applied.age.length === 0) return "Добавить гостей";
    
    const ageLabels = applied.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };


  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            Поиск
          </h2>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Global Search Input */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск мест, событий, активностей..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full px-4 py-3 pr-10 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus:border-transparent"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Intent Categories */}
        <div className="border-b border-gray-100 py-4">
          <div 
            ref={containerRef}
            className="flex gap-4 overflow-x-auto no-scrollbar px-4 relative"
          >
            {DISCOVERY_INTENT_ITEMS.map((intentConfig, index) => {
              const isActive = intentConfig.id === selectedIntent;
              
              return (
                <button
                  key={intentConfig.id}
                  ref={(el) => { tabsRef.current[index] = el; }}
                  onClick={() => handleIntentSelect(intentConfig.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 min-w-[80px] p-3 rounded-xl transition-all duration-200",
                    isActive 
                      ? "text-gray-900" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:scale-95"
                  )}
                >
                  {intentConfig.image ? (
                    <div className="relative h-[32px] w-[32px] flex items-center justify-center">
                      <Image 
                        src={intentConfig.image}
                        alt={intentConfig.label}
                        width={32} 
                        height={32} 
                        className={cn(
                          "object-contain transition-all duration-200",
                          isActive ? "scale-100" : "scale-90 opacity-80"
                        )}
                      />
                    </div>
                  ) : (
                    <div className="h-[32px] w-[32px] bg-gray-200 rounded-full" />
                  )}
                  <span className={cn(
                    "text-xs font-medium text-center leading-tight transition-all duration-200",
                    isActive ? "font-semibold text-gray-900" : "text-gray-500"
                  )}>
                    {intentConfig.label}
                  </span>
                </button>
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

        <div className="p-4 space-y-4">
          {/* Location Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => {
                if (expandedSection === 'location') {
                  setExpandedSection(null);
                } else {
                  // Don't call beginDraft here - draft is already initialized when sheet opens
                  setExpandedSection('location');
                }
              }}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-1">Где?</div>
                <div className="text-sm text-gray-500">{getLocationText()}</div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform duration-200",
                  expandedSection === 'location' && "rotate-180"
                )}
              />
            </button>
            
            {expandedSection === 'location' && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <MobileLocationPanel
                  citySlug={citySlug}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onClose={() => setExpandedSection(null)}
                  draft={applied}
                  setDraft={actions.setDraft}
                  actions={actions}
                  apiOptions={safeApiOptions}
                />
              </div>
            )}
          </div>
          
          {/* Date Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => {
                if (expandedSection === 'date') {
                  setExpandedSection(null);
                } else {
                  // Don't call beginDraft here - draft is already initialized when sheet opens
                  setExpandedSection('date');
                }
              }}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-1">Когда</div>
                <div className="text-sm text-gray-500">{getDateText()}</div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform duration-200",
                  expandedSection === 'date' && "rotate-180"
                )}
              />
            </button>
            
            {expandedSection === 'date' && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <DatePanel
                  onClose={() => setExpandedSection(null)}
                  applied={applied}
                  actions={actions}
                />
              </div>
            )}
          </div>
          
          {/* Age Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => {
                if (expandedSection === 'age') {
                  setExpandedSection(null);
                } else {
                  // Don't call beginDraft here - draft is already initialized when sheet opens
                  setExpandedSection('age');
                }
              }}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-1">Кто</div>
                <div className="text-sm text-gray-500">{getAgeText()}</div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform duration-200",
                  expandedSection === 'age' && "rotate-180"
                )}
              />
            </button>
            
            {expandedSection === 'age' && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <AgePanel
                  onClose={() => setExpandedSection(null)}
                  applied={applied}
                  actions={actions}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearAll}
            disabled={!derived.isDirty}
            className={cn(
              "px-4 py-3 rounded-xl font-medium transition-colors",
              derived.isDirty 
                ? "text-gray-900 hover:bg-gray-100 active:bg-gray-200" 
                : "text-gray-400 cursor-not-allowed"
            )}
          >
            Сбросить
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[#EF8759] text-white font-semibold py-4 rounded-xl hover:bg-[#e67c4f] transition-colors active:scale-[0.98]"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}