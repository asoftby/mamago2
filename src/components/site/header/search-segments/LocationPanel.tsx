"use client";

import { useState } from "react";
import { MapPin, Navigation, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilterUpdater } from "./filterUtils";

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
  const { updateFilters } = useFilterUpdater();

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
    // Clear other location filters and set nearby mode
    updateFilters({ metro: null, district: null });
    onSearchTextChange("Поблизости");
    onClose();
  };

  const handleMetroSelect = (metroValue: string) => {
    updateFilters({ metro: metroValue, district: null });
    onSearchTextChange("");
    setShowMetroList(false);
    onClose();
  };

  const handleDistrictSelect = (districtValue: string) => {
    updateFilters({ district: districtValue, metro: null });
    onSearchTextChange("");
    setShowDistrictList(false);
    onClose();
  };

  const selectedMetro = apiOptions.metros.find((m: any) => m.value === applied.metro);
  const selectedDistrict = apiOptions.districts.find((d: any) => d.value === applied.district);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Search Input */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Поиск места или события"
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EF8759]/20 focus:border-[#EF8759] transition-colors"
            autoFocus
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          {/* Nearby */}
          <button
            onClick={handleNearbyClick}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-full">
              <Navigation className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">Поблизости</div>
              <div className="text-sm text-gray-500">Найти рядом со мной</div>
            </div>
          </button>

          {/* City */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
            <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">{getCityDisplayName(citySlug)}</div>
              <div className="text-sm text-gray-500">Весь город</div>
            </div>
          </div>

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
                  {selectedMetro ? "Выбрано" : "Выбрать станцию"}
                </div>
              </div>
            </button>

            {showMetroList && (
              <div className="ml-14 space-y-1 max-h-40 overflow-y-auto">
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
                  {selectedDistrict ? "Выбран" : "Выбрать район"}
                </div>
              </div>
            </button>

            {showDistrictList && (
              <div className="ml-14 space-y-1 max-h-40 overflow-y-auto">
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