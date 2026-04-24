"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Zap, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCity } from "@/contexts/CityContext";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { usePublicCityOptions } from "@/lib/city/usePublicCityOptions";
import { DEFAULT_CITY_SLUG } from "@/lib/intent";

type FilterOption = { value: string; label: string };
type FilterPatch = Partial<DiscoveryFilters>;

interface LocationPanelProps {
  variant?: "default" | "cityHub";
  allowCitySelection?: boolean;
  citySlug: string;
  selectedCitySlug?: string;
  onCityPick?: (slug: string) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  applied: DiscoveryFilters;
  actions: { setDraft: (patch: FilterPatch) => void };
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
}

export function LocationPanel({
  variant = "default",
  allowCitySelection = false,
  citySlug,
  selectedCitySlug,
  onCityPick,
  searchText,
  onSearchTextChange,
  onClose,
  applied,
  actions,
  apiOptions,
}: LocationPanelProps) {
  const router = useRouter();
  const cityCtx = useOptionalCity();
  const { cities } = usePublicCityOptions();
  const [showCityList, setShowCityList] = useState(false);
  const [showMetroList, setShowMetroList] = useState(false);
  const [showDistrictList, setShowDistrictList] = useState(false);
  const handleNearbyClick = () => {
    // Toggle nearby state - if already selected, deselect it
    const newNearbyState = !applied.nearby;
    actions.setDraft({ nearby: newNearbyState, metro: null, district: null });
    onSearchTextChange("");
    // Don't close panel - let user continue selecting
  };

  const handleMetroSelect = (metroValue: string) => {
    // When selecting metro, clear district and nearby
    actions.setDraft({ metro: metroValue, district: null, nearby: false });
    onSearchTextChange("");
    setShowMetroList(false);
    // Don't close panel - let user continue selecting
  };

  const handleDistrictSelect = (districtValue: string) => {
    // When selecting district, clear metro and nearby
    actions.setDraft({ district: districtValue, metro: null, nearby: false });
    onSearchTextChange("");
    setShowDistrictList(false);
    // Don't close panel - let user continue selecting
  };

  const selectedMetro = apiOptions.metros.find((m) => m.value === applied.metro);
  const selectedDistrict = apiOptions.districts.find((d) => d.value === applied.district);
  const activeCitySlug = selectedCitySlug ?? citySlug;
  const cityOptions = useMemo(() => {
    const map = new Map(cities.map((city) => [city.slug, city]));
    if (!map.has(DEFAULT_CITY_SLUG)) {
      map.set(DEFAULT_CITY_SLUG, {
        id: DEFAULT_CITY_SLUG,
        slug: DEFAULT_CITY_SLUG,
        name: "Минск",
      });
    }
    if (!map.has(activeCitySlug)) {
      map.set(activeCitySlug, {
        id: activeCitySlug,
        slug: activeCitySlug,
        name: activeCitySlug,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.slug === DEFAULT_CITY_SLUG) return -1;
      if (b.slug === DEFAULT_CITY_SLUG) return 1;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [cities, activeCitySlug]);
  const selectedCityName =
    cityOptions.find((city) => city.slug === activeCitySlug)?.name ?? activeCitySlug;
  const showCitySelection = true;
  const hasMetroOptions = apiOptions.metros.length > 0;
  const hasDistrictOptions = apiOptions.districts.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          {showCitySelection ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCityList((value) => !value)}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left"
                aria-expanded={showCityList}
                aria-haspopup="listbox"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                  <MapPin className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">{selectedCityName}</div>
                  <div className="text-sm text-gray-500">Сменить город</div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-gray-400 transition-transform duration-200",
                    showCityList && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {showCityList ? (
                <div
                  className="ml-14 space-y-1 max-h-56 overflow-y-auto bg-white rounded-lg p-2"
                  role="listbox"
                  aria-label="Выбор города"
                >
                  {cityOptions.map((city) => {
                    const selected = city.slug === activeCitySlug;
                    return (
                      <button
                        key={city.slug}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          if (onCityPick) {
                            onCityPick(city.slug);
                            setShowCityList(false);
                            setShowMetroList(false);
                            setShowDistrictList(false);
                            return;
                          }
                          actions.setDraft({ nearby: false, metro: null, district: null });
                          if (cityCtx?.setCity) {
                            cityCtx.setCity(city.slug);
                          } else {
                            router.push(`/${city.slug}`);
                          }
                          setShowCityList(false);
                          onClose();
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                          selected
                            ? "bg-[#EF8759]/10 text-[#EF8759]"
                            : "hover:bg-gray-50 text-gray-700",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="font-medium block">{city.name}</span>
                          <span className="text-xs text-gray-500">Весь город</span>
                        </span>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-[#EF8759]" aria-hidden />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 opacity-50 cursor-not-allowed">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                <MapPin className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{selectedCityName}</div>
                <div className="text-sm text-gray-500">Весь город</div>
              </div>
            </div>
          )}

          {variant !== "cityHub" ? (
            <>
          {/* Nearby */}
          <button
            onClick={handleNearbyClick}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left border",
              applied.nearby 
                ? "bg-blue-50 border-blue-200" 
                : "border-transparent hover:bg-gray-50"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              applied.nearby ? "bg-blue-100" : "bg-blue-50"
            )}>
              <Navigation className={cn(
                "h-5 w-5",
                applied.nearby ? "text-blue-700" : "text-blue-600"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium",
                applied.nearby ? "text-blue-700" : "text-gray-900"
              )}>Поблизости</div>
              <div className="text-sm text-gray-500">Найти рядом со мной</div>
            </div>
          </button>

          {hasMetroOptions ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowMetroList(!showMetroList)}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-green-50 rounded-full">
                  <Zap className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {selectedMetro ? selectedMetro.label : "Метро"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedMetro ? "Метро" : "Выбрать станцию"}
                  </div>
                </div>
                <ChevronDown 
                  className={cn(
                    "h-5 w-5 text-gray-400 transition-transform duration-200",
                    showMetroList && "rotate-180"
                  )}
                />
              </button>

              {showMetroList && (
                <div className="ml-14 space-y-1 max-h-40 overflow-y-auto bg-white rounded-lg p-2">
                  {apiOptions.metros.map((metro) => (
                    <button
                      key={metro.value}
                      onClick={() => handleMetroSelect(metro.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        applied.metro === metro.value
                          ? "bg-[#EF8759]/10 text-[#EF8759] font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      {metro.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {hasDistrictOptions ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowDistrictList(!showDistrictList)}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-center w-10 h-10 bg-purple-50 rounded-full">
                <MapPin className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    {selectedDistrict ? selectedDistrict.label : "Район"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedDistrict ? "Район" : "Выбрать район"}
                  </div>
                </div>
                <ChevronDown 
                  className={cn(
                    "h-5 w-5 text-gray-400 transition-transform duration-200",
                    showDistrictList && "rotate-180"
                  )}
                />
              </button>

              {showDistrictList && (
                <div className="ml-14 space-y-1 max-h-40 overflow-y-auto bg-white rounded-lg p-2">
                  {apiOptions.districts.map((district) => (
                    <button
                      key={district.value}
                      onClick={() => handleDistrictSelect(district.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        applied.district === district.value
                          ? "bg-[#EF8759]/10 text-[#EF8759] font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      {district.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
