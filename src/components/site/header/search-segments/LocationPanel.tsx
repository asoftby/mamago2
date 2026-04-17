"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Zap, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCity } from "@/contexts/CityContext";
import { VALID_CITY_SLUGS } from "@/lib/intent";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";

type FilterOption = { value: string; label: string };
type FilterPatch = Partial<DiscoveryFilters>;

interface LocationPanelProps {
  variant?: "default" | "cityHub";
  allowCitySelection?: boolean;
  citySlug: string;
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
  searchText,
  onSearchTextChange,
  onClose,
  applied,
  actions,
  apiOptions,
}: LocationPanelProps) {
  const router = useRouter();
  const cityCtx = useOptionalCity();
  const [showMetroList, setShowMetroList] = useState(false);
  const [showDistrictList, setShowDistrictList] = useState(false);

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

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          {variant === "cityHub" || allowCitySelection ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 px-1 pb-1">Город</p>
              {VALID_CITY_SLUGS.map((slug) => {
                const name = getCityDisplayName(slug);
                const selected = slug === citySlug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => {
                      if (cityCtx?.setCity) {
                        cityCtx.setCity(slug);
                      } else {
                        router.push(`/${slug}`);
                      }
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left border transition-colors",
                      selected
                        ? "bg-gray-100 border-gray-200"
                        : "border-transparent hover:bg-gray-50",
                    )}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full shrink-0">
                        <MapPin className="h-5 w-5 text-gray-600" />
                      </div>
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900 block">{name}</span>
                        <span className="text-sm text-gray-500">Весь город</span>
                      </span>
                    </span>
                    {selected ? (
                      <Check className="h-5 w-5 text-primary shrink-0" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 opacity-50 cursor-not-allowed">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
                <MapPin className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{getCityDisplayName(citySlug)}</div>
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

          {/* Metro */}
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

          {/* District */}
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}