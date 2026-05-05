"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { EventLocationSearchInput } from "./EventLocationSearchInput";
import { EventLocationMapPreview } from "./EventLocationMapPreview";
import { EventLocationMapModal } from "./EventLocationMapModal";
import { formatDistance } from "@/lib/formatDistance";
import { FilterSelect } from "@/components/ui/filter-select";
import { loadDistricts, loadMetroStations, enrichEventLocation } from "./eventLocationUtils";
import type { EventFormData } from "../../types";

interface EventLocationPickerProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  disabled?: boolean;
}

export function EventLocationPicker({
  data,
  onChange,
  disabled = false,
}: EventLocationPickerProps) {
  
  // State
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if location is set
  const hasLocation = data.lat !== null && data.lng !== null;

  // Sync geo enrichment state
  const cityId = data.city;
  const districtAutoId = data.districtAutoId;
  const districtManualId = data.districtManualId;
  const metroAutoId = data.metroAutoId;
  const metroAutoDistanceM = data.metroAutoDistanceM;
  const metroManualId = data.metroManualId;
  const metroManualDistanceM = data.metroManualDistanceM;

  // Options for selects
  const [districts, setDistricts] = useState<Array<{ id: string; name: string }>>([]);
  const [metroStations, setMetroStations] = useState<Array<{ id: string; name: string }>>([]);



  // Modal state
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Load districts and metro stations when cityId is available
  const loadGeoOptions = useCallback(async () => {
    if (!cityId) return;

    console.log("[EventLocationPicker] Loading geo options for cityId:", cityId);

    try {
      const [districtsRes, metroRes] = await Promise.all([
        loadDistricts(cityId),
        loadMetroStations(cityId),
      ]);

      setDistricts(districtsRes);
      setMetroStations(metroRes);
      console.log("[EventLocationPicker] Loaded", districtsRes.length, "districts and", metroRes.length, "metro stations");
      
    } catch (err) {
      console.error("[EventLocationPicker] Load geo options error:", err);
    }
  }, [cityId]);

  useEffect(() => {
    if (cityId) {
      console.log("[EventLocationPicker] cityId changed, loading options:", cityId);
      loadGeoOptions();
    }
  }, [cityId, loadGeoOptions]);

  // Load single metro station by ID if we have metroAutoId but no stations loaded
  useEffect(() => {
    const loadMetroStation = async () => {
      if (metroAutoId && metroStations.length === 0 && cityId) {
        console.log("[EventLocationPicker] Loading single metro station:", metroAutoId);
        try {
          const stations = await loadMetroStations(cityId);
          setMetroStations(stations);
          console.log("[EventLocationPicker] Loaded", stations.length, "metro stations");
        } catch (err) {
          console.error("[EventLocationPicker] Load metro station error:", err);
        }
      }
    };
    loadMetroStation();
  }, [metroAutoId, metroStations.length, cityId]);

  const handlePlaceSelect = async (placeData: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: unknown[];
  }) => {
    setIsSaving(true);
    
    try {
      // Set location source to MANUAL for address input
      onChange({
        locationSource: "MANUAL",
        venueKind: "MANUAL",
        placeId: null,
        venueName: placeData.formattedAddr.split(',')[0] || "Выбранное место",
        address: placeData.formattedAddr,
        lat: placeData.lat,
        lng: placeData.lng,
        source: "ADDRESS_INPUT",
      });

      // Only enrich with district/metro if locationSource is MANUAL
      // Do NOT overwrite place-derived data
      console.log("[EventLocationPicker] Calling enrichEventLocation (place)", {
        lat: placeData.lat,
        lng: placeData.lng,
        hasAddressJson: Array.isArray(placeData.addressJson) ? placeData.addressJson.length : null,
        formattedAddr: placeData.formattedAddr?.slice?.(0, 80) ?? placeData.formattedAddr,
      });
      const enrichment = await enrichEventLocation({
        lat: placeData.lat,
        lng: placeData.lng,
        cityId: undefined, // Let API resolve cityId
        formattedAddr: placeData.formattedAddr,
        addressJson: placeData.addressJson,
      });

      // Update enrichment data and city
      console.log(
        "[EventLocationPicker] enrichEventLocation result (place)",
        JSON.stringify(enrichment, null, 2)
      );
      if (enrichment) {
        onChange({
          city: enrichment.cityId || "minsk", // Store UUID or fallback to slug
          districtAutoId: enrichment.districtAutoId,
          metroAutoId: enrichment.metroAutoId,
          metroAutoDistanceM: enrichment.metroAutoDistanceM,
          districtName: enrichment.districtName,
          metroName: enrichment.metroName,
        });
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("[EventLocationPicker] Place select error:", err);
      setError(err instanceof Error ? err.message : "Ошибка выбора места");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapConfirm = async (mapData: {
    lat: number;
    lng: number;
  }) => {
    setIsSaving(true);
    
    try {
      // Set location source to MANUAL for map picker
      onChange({
        locationSource: "MANUAL",
        venueKind: "MANUAL",
        placeId: null,
        venueName: "Выбранная точка на карте",
        address: `Координаты: ${mapData.lat.toFixed(6)}, ${mapData.lng.toFixed(6)}`,
        lat: mapData.lat,
        lng: mapData.lng,
        source: "MAP_PICKER",
      });

      // Only enrich with district/metro if locationSource is MANUAL
      console.log("[EventLocationPicker] Calling enrichEventLocation (map)", {
        lat: mapData.lat,
        lng: mapData.lng,
      });
      const enrichment = await enrichEventLocation({
        lat: mapData.lat,
        lng: mapData.lng,
        cityId: undefined, // Let API resolve cityId
      });

      // Update enrichment data and city
      console.log(
        "[EventLocationPicker] enrichEventLocation result (map)",
        JSON.stringify(enrichment, null, 2)
      );
      if (enrichment) {
        onChange({
          city: enrichment.cityId || "minsk", // Store UUID or fallback to slug
          districtAutoId: enrichment.districtAutoId,
          metroAutoId: enrichment.metroAutoId,
          metroAutoDistanceM: enrichment.metroAutoDistanceM,
          districtName: enrichment.districtName,
          metroName: enrichment.metroName,
        });
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("[EventLocationPicker] Map confirm error:", err);
      setError(err instanceof Error ? err.message : "Ошибка выбора места на карте");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDistrictChange = (value: string) => {
    const newValue = value === "" ? null : value;
    onChange({ 
      districtManualId: newValue,
      // Update legacy field for backward compatibility
      district: newValue ? (districts.find(d => d.id === newValue)?.name || newValue) : "",
    });
  };

  const handleMetroChange = (value: string) => {
    const newValue = value === "" ? null : value;
    onChange({ 
      metroManualId: newValue,
      // Update legacy field for backward compatibility
      metro: newValue ? (metroStations.find(m => m.id === newValue)?.name || newValue) : "",
    });
  };

  const handleResetDistrict = () => {
    onChange({ 
      districtManualId: null,
      district: districtAutoId ? (data.districtName || districtAutoId) : "",
    });
  };

  const handleResetMetro = () => {
    onChange({ 
      metroManualId: null,
      metroManualDistanceM: null,
      metro: metroAutoId ? (data.metroName || metroAutoId) : "",
    });
  };

  // Computed values
  const districtShown = districtManualId ?? districtAutoId;
  const metroShown = metroManualId ?? metroAutoId;
  const metroDistanceShown = metroManualId ? metroManualDistanceM : metroAutoDistanceM;

  const metroFilterOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    if (metroShown && metroStations.length === 0 && data.metroName) {
      out.push({ value: metroShown, label: data.metroName });
    }
    for (const m of metroStations) {
      out.push({ value: m.id, label: m.name });
    }
    return out;
  }, [metroShown, metroStations, data.metroName]);

  return (
    <div className="space-y-6">
      {/* Status indicators */}
      {(isSaving || isSaved || error) && (
        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-2 text-[12px] text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Сохраняю...</span>
            </div>
          )}
          {isSaved && (
            <div className="flex items-center gap-2 text-[12px] text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>Сохранено</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Search Input */}
      <div>
        <Label>Адрес или название места</Label>
        <div className="mt-2 space-y-2">
          <EventLocationSearchInput
            onPlaceSelect={handlePlaceSelect}
            disabled={isSaving || disabled}
            initialValue={data.address || ""}
            placeholder="Детский центр Песочница или Притыцкого 12"
          />
          <button
            type="button"
            onClick={() => setIsMapModalOpen(true)}
            disabled={disabled}
            className="text-[12px] text-muted-foreground underline decoration-dashed decoration-primary underline-offset-4 hover:text-muted-foreground hover:decoration-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Выбрать точку на карте
          </button>
        </div>
      </div>

      {/* Map Preview (only show if location is set) */}
      {hasLocation && (
        <div>
          <Label>Выбранное местоположение</Label>
          <div className="mt-2 space-y-2">
            <EventLocationMapPreview
              lat={data.lat!}
              lng={data.lng!}
              onOpenMap={() => setIsMapModalOpen(true)}
            />
            <p className="text-sm text-gray-600">
              Выбрано: {data.address || `${data.lat!.toFixed(6)}, ${data.lng!.toFixed(6)}`}
            </p>
          </div>
        </div>
      )}

      {/* District & Metro (only show if location is set and cityId available) */}
      {hasLocation && cityId && (
        <div className="space-y-4">
          {/* District Select */}
          <div>
            <Label htmlFor="district">Район</Label>
            <FilterSelect
              id="district"
              value={districtShown || ""}
              placeholder="Не выбрано"
              options={districts.map((d) => ({ value: d.id, label: d.name }))}
              onChange={handleDistrictChange}
              disabled={districts.length === 0 || disabled}
            />
            
            {/* Helper text */}
            <div className="mt-1 text-[12px] text-muted-foreground">
              {districtManualId ? (
                <div className="flex items-center justify-between">
                  <span>Вы выбрали вручную</span>
                  <button
                    type="button"
                    onClick={handleResetDistrict}
                    disabled={disabled}
                    className="text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Сбросить
                  </button>
                </div>
              ) : districtAutoId ? (
                <span>Определено автоматически</span>
              ) : (
                <span>Не удалось определить автоматически — выберите вручную</span>
              )}
            </div>
          </div>

          {/* Metro Select */}
          <div>
            <Label htmlFor="metro">Метро</Label>
            <FilterSelect
              id="metro"
              value={metroShown || ""}
              placeholder="Не выбрано"
              options={metroFilterOptions}
              onChange={handleMetroChange}
              disabled={disabled}
            />
            
            {/* Distance display */}
            {metroShown && metroDistanceShown !== null && (
              <p className="mt-1 text-[12px] text-gray-700">
                Расстояние: {formatDistance(metroDistanceShown)}
              </p>
            )}
            
            {/* Helper text */}
            <div className="mt-1 text-[12px] text-muted-foreground">
              {metroManualId ? (
                <div className="flex items-center justify-between">
                  <span>Вы выбрали вручную</span>
                  <button
                    type="button"
                    onClick={handleResetMetro}
                    disabled={disabled}
                    className="text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Сбросить
                  </button>
                </div>
              ) : metroAutoId ? (
                <span>Определено автоматически</span>
              ) : (
                <span>Не удалось определить автоматически — выберите вручную</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Read-only display when location exists but cityId is missing */}
      {hasLocation && !cityId && (districtAutoId || districtManualId || metroAutoId || metroManualId) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Район и метро</h4>
          <p className="text-[12px] text-gray-600 mb-3">
            Данные сохранены, но редактирование недоступно (отсутствует cityId)
          </p>
          
          {(districtAutoId || districtManualId) && (
            <div className="text-[12px]">
              <span className="text-gray-600">Район:</span>{" "}
              <span className="text-gray-900">
                {districtManualId || districtAutoId}
                {districtManualId && " (выбрано вручную)"}
                {!districtManualId && districtAutoId && " (автоматически)"}
              </span>
            </div>
          )}
          
          {(metroAutoId || metroManualId) && (
            <div className="text-[12px]">
              <span className="text-gray-600">Метро:</span>{" "}
              <span className="text-gray-900">
                {metroStations.find(m => m.id === (metroManualId || metroAutoId))?.name || (metroManualId || metroAutoId)}
                {metroDistanceShown !== null && ` · ${formatDistance(metroDistanceShown)}`}
                {metroManualId && " (выбрано вручную)"}
                {!metroManualId && metroAutoId && " (автоматически)"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Read-only display for enriched data (always show when available) */}
      {hasLocation && (districtAutoId || metroAutoId) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <h4 className="text-sm font-medium text-blue-900">📍 Определено автоматически</h4>
          
          {districtAutoId && (
            <div className="text-[12px]">
              <span className="text-blue-700">Район:</span>{" "}
              <span className="text-blue-900 font-medium">
                {data.districtName || 
                 (districts.find(d => d.id === districtAutoId)?.name) || 
                 districtAutoId}
              </span>
            </div>
          )}
          
          {metroAutoId && (
            <div className="text-[12px]">
              <span className="text-blue-700">Метро:</span>{" "}
              <span className="text-blue-900 font-medium">
                {data.metroName || 
                 (metroStations.length > 0 
                   ? (metroStations.find(m => m.id === metroAutoId)?.name || metroAutoId)
                   : metroAutoId)}
                {metroAutoDistanceM !== null && ` · ${formatDistance(metroAutoDistanceM)}`}
              </span>
            </div>
          )}
          
          {!districtAutoId && !metroAutoId && (
            <p className="text-[12px] text-blue-700">
              Метро/район определим после выбора точки
            </p>
          )}
        </div>
      )}

      {/* Map Modal */}
      <EventLocationMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialLat={data.lat}
        initialLng={data.lng}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}
