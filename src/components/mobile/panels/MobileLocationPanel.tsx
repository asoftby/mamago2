"use client";

import { useState } from "react";
import { MapPin, Navigation, Zap, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCity } from "@/contexts/CityContext";
import { VALID_CITY_SLUGS } from "@/lib/intent";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";

type FilterOption = { value: string; label: string };
type FilterPatch = Partial<DiscoveryFilters>;

interface MobileLocationPanelProps {
  variant?: "default" | "cityHub";
  citySlug: string;
  selectedCitySlug?: string;
  onCityPick?: (slug: string) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  draft: DiscoveryFilters;
  setDraft: (patch: FilterPatch) => void;
  actions: { setDraft: (patch: FilterPatch) => void };
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
}

export function MobileLocationPanel({
  variant = "default",
  citySlug,
  selectedCitySlug,
  onCityPick,
  searchText,
  onSearchTextChange,
  onClose,
  draft,
  setDraft,
  actions,
  apiOptions,
}: MobileLocationPanelProps) {
  const { setCity } = useCity();
  const [showMetroList, setShowMetroList] = useState(false);
  const [showDistrictList, setShowDistrictList] = useState(false);
  /** cityHub: свёрнутая строка «Где?» — по тапу открывается список городов */
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

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

  const handleNearbyClick = () => {
    // Toggle nearby state
    const newNearbyState = !draft.nearby;
    setDraft({ nearby: newNearbyState, metro: null, district: null });
    // Don't close - let user see the selection
  };

  const handleMetroSelect = (metroValue: string) => {
    // When selecting metro, clear district and nearby
    setDraft({ metro: metroValue, district: null, nearby: false });
    setShowMetroList(false);
    // Don't close the panel - let user continue selecting
  };

  const handleDistrictSelect = (districtValue: string) => {
    // When selecting district, clear metro and nearby
    setDraft({ district: districtValue, metro: null, nearby: false });
    setShowDistrictList(false);
    // Don't close the panel - let user continue selecting
  };

  const selectedMetro = apiOptions.metros.find((m) => m.value === draft.metro);
  const selectedDistrict = apiOptions.districts.find((d) => d.value === draft.district);

  return (
    <div className="min-w-0">
      {/* Quick Actions */}
      <div className="space-y-0">
          {variant === "cityHub" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setCityPickerOpen((o) => !o)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors",
                  "border-[#EF8759]/25 hover:border-[#EF8759]/40",
                  cityPickerOpen && "border-[#EF8759]/35",
                )}
                aria-expanded={cityPickerOpen}
                aria-haspopup="listbox"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <MapPin className="h-4 w-4 text-gray-500" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-gray-500">Где?</div>
                  <div className="mt-0.5 text-sm font-normal leading-normal text-gray-700">
                    {getCityLocativePhrase(selectedCitySlug ?? citySlug)}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200",
                    cityPickerOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {cityPickerOpen ? (
                <div
                  className="rounded-xl border border-gray-100 bg-gray-50/90 p-3"
                  role="listbox"
                  aria-label="Выбор города"
                >
                  <p className="mb-2 px-0.5 text-[11px] font-medium text-gray-500">
                    Город
                  </p>
                  <div className="space-y-1">
                    {VALID_CITY_SLUGS.map((slug) => {
                      const selected =
                        slug === (selectedCitySlug ?? citySlug);
                      const name = getCityDisplayName(slug);
                      return (
                        <button
                          key={slug}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            if (onCityPick) {
                              onCityPick(slug);
                            } else {
                              setCity(slug);
                              onClose();
                            }
                            setCityPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left transition-colors",
                            selected
                              ? "bg-white ring-1 ring-gray-200"
                              : "hover:bg-white",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <MapPin className="h-3.5 w-3.5 text-gray-600" />
                            </div>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-gray-900">
                                {name}
                              </span>
                              <span className="text-xs text-gray-500">
                                Весь город
                              </span>
                            </span>
                          </span>
                          {selected ? (
                            <Check
                              className="h-4 w-4 shrink-0 text-primary"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left opacity-50 cursor-not-allowed">
              <div className="flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full">
                <MapPin className="h-3.5 w-3.5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">{getCityDisplayName(citySlug)}</div>
                <div className="text-xs text-gray-500">Весь город</div>
              </div>
            </div>
          )}

          {variant !== "cityHub" ? (
            <>
          {/* Nearby */}
          <button
            onClick={handleNearbyClick}
            className={cn(
              "w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors text-left",
              draft.nearby 
                ? "bg-blue-50 border border-blue-200" 
                : "hover:bg-white"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-full",
              draft.nearby ? "bg-blue-100" : "bg-blue-50"
            )}>
              <Navigation className={cn(
                "h-3.5 w-3.5",
                draft.nearby ? "text-blue-700" : "text-blue-600"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium text-sm",
                draft.nearby ? "text-blue-700" : "text-gray-900"
              )}>Поблизости</div>
              <div className="text-xs text-gray-500">Найти рядом со мной</div>
            </div>
          </button>

          {/* Metro */}
          <div className="space-y-1">
            <button
              onClick={() => setShowMetroList(!showMetroList)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white transition-colors text-left"
            >
              <div className="flex items-center justify-center w-7 h-7 bg-green-50 rounded-full">
                <Zap className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">
                  {selectedMetro ? selectedMetro.label : "Метро"}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedMetro ? "Метро" : "Выбрать станцию"}
                </div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-gray-400 transition-transform duration-200",
                  showMetroList && "rotate-180"
                )}
              />
            </button>

            {showMetroList && (
              <div className="ml-10 space-y-1 max-h-32 overflow-y-auto bg-white rounded-lg p-2">
                {apiOptions.metros.map((metro) => (
                  <button
                    key={metro.value}
                    onClick={() => handleMetroSelect(metro.value)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors",
                      draft.metro === metro.value
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

          {/* District */}
          <div className="space-y-1">
            <button
              onClick={() => setShowDistrictList(!showDistrictList)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white transition-colors text-left"
            >
              <div className="flex items-center justify-center w-7 h-7 bg-purple-50 rounded-full">
                <MapPin className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm">
                  {selectedDistrict ? selectedDistrict.label : "Район"}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedDistrict ? "Район" : "Выбрать район"}
                </div>
              </div>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-gray-400 transition-transform duration-200",
                  showDistrictList && "rotate-180"
                )}
              />
            </button>

            {showDistrictList && (
              <div className="ml-10 space-y-1 max-h-32 overflow-y-auto bg-white rounded-lg p-2">
                {apiOptions.districts.map((district) => (
                  <button
                    key={district.value}
                    onClick={() => handleDistrictSelect(district.value)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors",
                      draft.district === district.value
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
            </>
          ) : null}
      </div>
    </div>
  );
}