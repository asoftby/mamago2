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
}

type ExpandedSection = 'location' | 'date' | 'age' | null;

export function MobileSearchSheet({ isOpen, onClose, citySlug = "minsk", currentIntent }: MobileSearchSheetProps) {
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
  
  // Use local draft state instead of the one from useDiscoveryFilters
  // This prevents draft from being reset when switching between intent tabs
  const [localDraft, setLocalDraft] = useState(applied);
  
  // Track if sheet was just opened to initialize draft only once
  const wasOpenRef = useRef(false);
  
  const { options: apiOptions } = useDiscoveryFilterOptions(citySlug);
  
  // Helper function to update local draft with logging
  const updateLocalDraft = (patch: any) => {
    setLocalDraft(prev => ({ ...prev, ...patch }));
  };
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

  // Initialize draft when opening the sheet - only once when sheet opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Sheet just opened - initialize local draft from applied
      setLocalDraft(applied);
      wasOpenRef.current = true;
    } else if (!isOpen && wasOpenRef.current) {
      // Sheet closed - reset the flag
      wasOpenRef.current = false;
    }
  }, [isOpen]); // Remove applied from dependencies!

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

  const handleSearch = () => {
    // Apply current draft filters before navigating
    // Don't call actions.apply() as it uses the global draft, use our local draft
    
    // Navigate to the selected intent page WITH current filters
    const intentConfig = DISCOVERY_INTENT_ITEMS.find(item => item.id === selectedIntent);
    if (intentConfig) {
      // Build URL with current search params
      const currentParams = new URLSearchParams(searchParams.toString());
      
      // Apply local draft filters to URL params
      if (localDraft.dateFrom) currentParams.set("from", localDraft.dateFrom);
      else currentParams.delete("from");
      
      if (localDraft.dateTo) currentParams.set("to", localDraft.dateTo);
      else currentParams.delete("to");
      
      if (localDraft.whenPreset) currentParams.set("preset", localDraft.whenPreset);
      else currentParams.delete("preset");
      
      if (localDraft.age.length > 0) currentParams.set("age", localDraft.age.join(","));
      else currentParams.delete("age");
      
      if (localDraft.metro) currentParams.set("metro", localDraft.metro);
      else currentParams.delete("metro");
      
      if (localDraft.district) currentParams.set("district", localDraft.district);
      else currentParams.delete("district");
      
      if (localDraft.nearby) currentParams.set("nearby", "true");
      else currentParams.delete("nearby");
      
      const queryString = currentParams.toString();
      const targetUrl = intentConfig.href(citySlug) + (queryString ? `?${queryString}` : '');
      
      router.push(targetUrl);
    }
    onClose();
  };

  const handleIntentSelect = (intentId: string) => {
    // Just update the selected intent, don't navigate
    // Navigation will happen when user clicks "Показать" button
    setSelectedIntent(intentId);
  };

  const handleClearAll = () => {
    // Clear local draft
    const emptyDraft = {
      dateFrom: null,
      dateTo: null,
      whenPreset: null,
      age: [],
      metro: null,
      district: null,
      nearby: false,
    };
    setLocalDraft(emptyDraft);
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
    if (localDraft.nearby) {
      items.push("Поблизости");
    }
    
    // Add metro station if selected
    if (localDraft.metro) {
      const metro = safeApiOptions.metros.find(m => m.value === localDraft.metro);
      if (metro) items.push(metro.label);
    }
    
    // Add district if selected
    if (localDraft.district) {
      const district = safeApiOptions.districts.find(d => d.value === localDraft.district);
      if (district) items.push(district.label);
    }
    
    // Join with bullet separator
    return items.join(" • ");
  };

  // Build date display text
  const getDateText = () => {
    if (localDraft.whenPreset === "TODAY") return "Сегодня";
    if (localDraft.whenPreset === "TOMORROW") return "Завтра";
    if (localDraft.whenPreset === "WEEKEND") return "Выходные";
    
    if (localDraft.dateFrom) {
      const fromDate = new Date(localDraft.dateFrom);
      if (localDraft.dateTo && localDraft.dateFrom !== localDraft.dateTo) {
        const toDate = new Date(localDraft.dateTo);
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
    if (localDraft.age.length === 0) return "Добавить гостей";
    
    const ageLabels = localDraft.age.map(ageValue => {
      const group = AGE_GROUPS.find(g => g.value === ageValue);
      return group ? group.label : ageValue;
    });
    
    if (ageLabels.length === 1) return ageLabels[0];
    if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
    return `${ageLabels[0]} +${ageLabels.length - 1}`;
  };

  // Count active filters for "Показать" button
  const getActiveFiltersCount = () => {
    let count = 0;
    if (localDraft.district || localDraft.metro || localDraft.nearby) count++;
    if (localDraft.dateFrom || localDraft.whenPreset) count++;
    if (localDraft.age.length > 0) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

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
                  draft={localDraft}
                  setDraft={updateLocalDraft}
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
                  applied={localDraft}
                  actions={{ ...actions, setDraft: updateLocalDraft }}
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
                  applied={localDraft}
                  actions={{ ...actions, setDraft: updateLocalDraft }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          {/* Clear Button */}
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
          
          {/* Search Button */}
          <button
            onClick={handleSearch}
            className="flex-1 bg-[#EF8759] text-white font-semibold py-4 rounded-xl hover:bg-[#e67c4f] transition-colors active:scale-[0.98]"
          >
            {activeFiltersCount > 0 ? `Показать (${activeFiltersCount})` : 'Показать'}
          </button>
        </div>
      </div>
    </div>
  );
}