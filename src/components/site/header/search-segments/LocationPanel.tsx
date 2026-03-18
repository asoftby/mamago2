"use client";

import { useState } from "react";
import { MapPin, Navigation, Zap, ChevronDown } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cn } from "@/lib/utils";

interface LocationPanelProps {
  citySlug: string;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  applied: any;
  actions: any;
  apiOptions: any;
}

export function LocationPanel({
  citySlug,
  searchText,
  onSearchTextChange,
  onClose,
  applied,
  actions,
  apiOptions
}: LocationPanelProps) {
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

  const selectedMetro = apiOptions.metros.find((m: any) => m.value === applied.metro);
  const selectedDistrict = apiOptions.districts.find((d: any) => d.value === applied.district);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          {/* City - First position - Disabled until multiple cities available */}
          <div className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 opacity-50 cursor-not-allowed">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">{getCityDisplayName(citySlug)}</div>
              <div className="text-sm text-gray-500">Весь город</div>
            </div>
          </div>

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
                {apiOptions.metros.map((metro: any) => (
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
                {apiOptions.districts.map((district: any) => (
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
        </div>
      </div>
    </div>
  );
}