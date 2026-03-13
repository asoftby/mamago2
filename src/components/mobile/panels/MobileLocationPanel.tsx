"use client";

import { useState } from "react";
import { MapPin, Navigation, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLocationPanelProps {
  citySlug: string;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  draft: any;
  setDraft: (patch: any) => void;
  actions: any;
  apiOptions: any;
}

export function MobileLocationPanel({
  citySlug,
  searchText,
  onSearchTextChange,
  onClose,
  draft,
  setDraft,
  actions,
  apiOptions
}: MobileLocationPanelProps) {
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

  const selectedMetro = apiOptions.metros.find((m: any) => m.value === draft.metro);
  const selectedDistrict = apiOptions.districts.find((d: any) => d.value === draft.district);

  return (
    <div className="bg-gray-50 rounded-xl">
      <div className="p-3">
        {/* Quick Actions */}
        <div className="space-y-1.5">
          {/* City - First position - Disabled until multiple cities available */}
          <div className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full">
              <MapPin className="h-3.5 w-3.5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm">{getCityDisplayName(citySlug)}</div>
              <div className="text-xs text-gray-500">Весь город</div>
            </div>
          </div>

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
                {apiOptions.metros.map((metro: any) => (
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
                {apiOptions.districts.map((district: any) => (
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
        </div>
      </div>
    </div>
  );
}