"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { PlaceSearchInput } from "./PlaceSearchInput";
import { PlaceMapPreview } from "./PlaceMapPreview";
import { PlaceMapModal } from "./PlaceMapModal";
import { PlaceDuplicateBlock } from "./PlaceDuplicateBlock";
import { formatDistance } from "@/lib/formatDistance";
import { FilterSelect } from "@/components/ui/filter-select";

interface PlaceLocationPickerProps {
  placeId: string;
  placeTitle?: string;
  initialLocation?: {
    lat: number;
    lng: number;
    formattedAddr?: string;
    cityId?: string;
    districtAutoId?: string | null;
    districtManualId?: string | null;
    metroAutoId?: string | null;
    metroAutoDistanceM?: number | null;
    metroManualId?: string | null;
    metroManualDistanceM?: number | null;
    // Names from enrichment API (for display before stations are loaded)
    districtName?: string | null;
    metroName?: string | null;
  } | null;
  onUpdate?: (updates: Record<string, unknown>) => void;
  disabled?: boolean;
}

type DuplicatePlace = {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
};

type GeoOptionsDebugState = {
  cityId: string;
  districtsUrl: string;
  metroUrl: string;
  districtsStatus: number | null;
  metroStatus: number | null;
  districtsCount: number;
  metroCount: number;
};

// Single source of truth for location
type LocationState = {
  lat: number;
  lng: number;
  address: string | null;
  placeId: string | null;
  source: "google" | "manual";
};

export function PlaceLocationPicker({
  placeId,
  placeTitle,
  initialLocation,
  onUpdate,
  disabled = false,
}: PlaceLocationPickerProps) {
  
  // State
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Single source of truth for location
  const [location, setLocation] = useState<LocationState | null>(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      return {
        lat: initialLocation.lat,
        lng: initialLocation.lng,
        address: initialLocation.formattedAddr || null,
        placeId: null,
        source: "manual",
      };
    }
    return null;
  });

  // Geo enrichment state
  const [cityId, setCityId] = useState<string | null>(initialLocation?.cityId || null);
  const [districtAutoId, setDistrictAutoId] = useState<string | null>(initialLocation?.districtAutoId || null);
  const [districtManualId, setDistrictManualId] = useState<string | null>(initialLocation?.districtManualId || null);
  const [metroAutoId, setMetroAutoId] = useState<string | null>(initialLocation?.metroAutoId || null);
  const [metroAutoDistanceM, setMetroAutoDistanceM] = useState<number | null>(initialLocation?.metroAutoDistanceM || null);
  const [metroManualId, setMetroManualId] = useState<string | null>(initialLocation?.metroManualId || null);
  const [metroManualDistanceM, setMetroManualDistanceM] = useState<number | null>(initialLocation?.metroManualDistanceM || null);

  // Sync geo enrichment state when initialLocation changes (e.g., after enrichment API call)
  useEffect(() => {
    if (initialLocation) {
      if (initialLocation.cityId !== undefined) setCityId(initialLocation.cityId);
      if (initialLocation.districtAutoId !== undefined) setDistrictAutoId(initialLocation.districtAutoId);
      if (initialLocation.districtManualId !== undefined) setDistrictManualId(initialLocation.districtManualId);
      if (initialLocation.metroAutoId !== undefined) setMetroAutoId(initialLocation.metroAutoId);
      if (initialLocation.metroAutoDistanceM !== undefined) setMetroAutoDistanceM(initialLocation.metroAutoDistanceM);
      if (initialLocation.metroManualId !== undefined) setMetroManualId(initialLocation.metroManualId);
      if (initialLocation.metroManualDistanceM !== undefined) setMetroManualDistanceM(initialLocation.metroManualDistanceM);
    }
  }, [
    initialLocation?.cityId,
    initialLocation?.districtAutoId,
    initialLocation?.districtManualId,
    initialLocation?.metroAutoId,
    initialLocation?.metroAutoDistanceM,
    initialLocation?.metroManualId,
    initialLocation?.metroManualDistanceM,
  ]);

  // Options for selects
  const [districts, setDistricts] = useState<Array<{ id: string; name: string }>>([]);
  const [metroStations, setMetroStations] = useState<Array<{ id: string; name: string }>>([]);
  const [geoOptionsDebug, setGeoOptionsDebug] = useState<GeoOptionsDebugState | null>(null);
  const [geoOptionsWarning, setGeoOptionsWarning] = useState<string | null>(null);

  // Duplicate detection
  const [duplicatePlace, setDuplicatePlace] = useState<DuplicatePlace | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Details state
  const [isInsideComplex, setIsInsideComplex] = useState(false);
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");
  const [howToFind, setHowToFind] = useState("");

  // Modal state
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Load districts and metro stations when cityId is available
  const loadGeoOptions = useCallback(async () => {
    if (!cityId) return;

    const districtsUrl = `/api/geo/districts?cityId=${encodeURIComponent(cityId)}`;
    const metroUrl = `/api/geo/metro-stations?cityId=${encodeURIComponent(cityId)}`;

    console.log("[PlaceLocationPicker] Loading geo options for cityId:", cityId);
    setGeoOptionsWarning(null);

    try {
      const [districtsRes, metroRes] = await Promise.all([
        fetch(districtsUrl),
        fetch(metroUrl),
      ]);

      let nextDistricts: Array<{ id: string; name: string }> = [];
      let nextMetroStations: Array<{ id: string; name: string }> = [];

      if (districtsRes.ok) {
        const data = await districtsRes.json();
        nextDistricts = Array.isArray(data.districts) ? data.districts : [];
        setDistricts(nextDistricts);
      } else {
        setDistricts([]);
      }

      if (metroRes.ok) {
        const data = await metroRes.json();
        nextMetroStations = Array.isArray(data.metroStations) ? data.metroStations : [];
        setMetroStations(nextMetroStations);
      } else {
        setMetroStations([]);
      }

      setGeoOptionsDebug({
        cityId,
        districtsUrl,
        metroUrl,
        districtsStatus: districtsRes.status,
        metroStatus: metroRes.status,
        districtsCount: nextDistricts.length,
        metroCount: nextMetroStations.length,
      });

      console.log("[PlaceLocationPicker] districts request:", {
        cityId,
        url: districtsUrl,
        status: districtsRes.status,
        count: nextDistricts.length,
      });
      console.log("[PlaceLocationPicker] metro request:", {
        cityId,
        url: metroUrl,
        status: metroRes.status,
        count: nextMetroStations.length,
      });

      const warnings: string[] = [];
      if (nextDistricts.length === 0) {
        console.warn(`[PlaceLocationPicker] No districts found for cityId: ${cityId}`);
        warnings.push("Для этого города не загружены районы.");
      }
      if (nextMetroStations.length === 0) {
        console.warn(`[PlaceLocationPicker] No metro stations found for cityId: ${cityId}`);
        warnings.push("Для этого города не загружены станции метро.");
      }
      if (warnings.length > 0) {
        setGeoOptionsWarning(`${warnings.join(" ")} Можно выбрать вручную после настройки справочника.`);
      }
    } catch (err) {
      console.error("[PlaceLocationPicker] Load geo options error:", err);
      setDistricts([]);
      setMetroStations([]);
      setGeoOptionsWarning("Не удалось загрузить справочники районов и метро. Проверьте geo API и данные города.");
      setGeoOptionsDebug({
        cityId,
        districtsUrl,
        metroUrl,
        districtsStatus: null,
        metroStatus: null,
        districtsCount: 0,
        metroCount: 0,
      });
    }
  }, [cityId]);

  useEffect(() => {
    if (cityId) {
      console.log("[PlaceLocationPicker] cityId changed, loading options:", cityId);
      loadGeoOptions();
    }
  }, [cityId, loadGeoOptions]);

  // Load single metro station by ID if we have metroAutoId but no stations loaded
  useEffect(() => {
    const loadMetroStation = async () => {
      if (metroAutoId && metroStations.length === 0 && cityId) {
        console.log("[PlaceLocationPicker] Loading single metro station:", metroAutoId);
        try {
          const res = await fetch(`/api/geo/metro-stations?cityId=${cityId}`);
          if (res.ok) {
            const data = await res.json();
            setMetroStations(data.metroStations || []);
            console.log("[PlaceLocationPicker] Loaded", data.metroStations?.length || 0, "metro stations");
          }
        } catch (err) {
          console.error("[PlaceLocationPicker] Load metro station error:", err);
        }
      }
    };
    loadMetroStation();
  }, [metroAutoId, metroStations.length, cityId]);

  // Check duplicates whenever location changes
  useEffect(() => {
    if (location) {
      checkForDuplicates();
    }
  }, [location]);

  const handlePlaceSelect = async (data: {
    googlePlaceId: string;
    placeName: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: google.maps.GeocoderAddressComponent[];
  }) => {
    // Update location state
    setLocation({
      lat: data.lat,
      lng: data.lng,
      address: data.formattedAddr,
      placeId: data.googlePlaceId,
      source: "google",
    });

    // Trigger geo enrichment
    await enrichLocation(data.lat, data.lng, data.addressJson);

    // Pass to parent for manual save
    onUpdate?.({
      lat: data.lat,
      lng: data.lng,
      googlePlaceId: data.googlePlaceId,
      formattedAddr: data.formattedAddr,
      addressJson: data.addressJson,
      googleReviewsJson: {
        meta: {
          enabled: false,
          matchStatus: "ADDRESS_ONLY",
          disabledReason: "pending_verification",
          googlePlaceName: data.placeName || placeTitle || null,
          googlePlaceAddress: data.formattedAddr || null,
        },
      },
    });
  };

  const handleMapConfirm = async (data: {
    lat: number;
    lng: number;
  }) => {
    // Update location state
    setLocation({
      lat: data.lat,
      lng: data.lng,
      address: null,
      placeId: null,
      source: "manual",
    });

    // Trigger geo enrichment (without addressJson)
    await enrichLocation(data.lat, data.lng, null);

    // Pass to parent for manual save
    onUpdate?.({
      lat: data.lat,
      lng: data.lng,
    });
  };

  /**
   * Call geo enrichment API and update state
   */
  const enrichLocation = async (
    lat: number,
    lng: number,
    addressJson: google.maps.GeocoderAddressComponent[] | null
  ) => {
    console.log("[PlaceLocationPicker] Starting geo enrichment...", { lat, lng });

    try {
      const response = await fetch("/api/geo/enrich-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, addressJson }),
      });

      if (!response.ok) {
        console.error("[PlaceLocationPicker] Geo enrichment failed:", response.status);
        return;
      }

      const result = await response.json();
      console.log("[PlaceLocationPicker] Geo enrichment result:", result);

      // Update state with enriched data
      if (result.cityId) {
        setCityId(result.cityId);
      }

      if (result.districtAutoId) {
        setDistrictAutoId(result.districtAutoId);
      }

      if (result.metroAutoId) {
        setMetroAutoId(result.metroAutoId);
        setMetroAutoDistanceM(result.metroAutoDistanceM);
      } else {
        // Clear metro if not found
        setMetroAutoId(null);
        setMetroAutoDistanceM(null);
      }

      // Pass enriched data to parent
      onUpdate?.({
        cityId: result.cityId,
        districtAutoId: result.districtAutoId,
        metroAutoId: result.metroAutoId,
        metroAutoDistanceM: result.metroAutoDistanceM,
      });
    } catch (err) {
      console.error("[PlaceLocationPicker] Geo enrichment error:", err);
    }
  };

  const checkForDuplicates = async () => {
    if (!location) return;

    try {
      const params = new URLSearchParams({
        placeId,
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        formattedAddr: location.address || "",
        ...(location.placeId && { googlePlaceId: location.placeId }),
      });

      const response = await fetch(`/api/business/places/location/matches?${params.toString()}`);

      if (!response.ok) {
        // Only log error for unexpected status codes (not 400 for validation)
        if (response.status !== 400) {
          const errorText = await response.text();
          console.error("[PlaceLocationPicker] Failed to check duplicates:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        }
        return;
      }

      const result = await response.json();

      if (result.exactDuplicate) {
        setDuplicatePlace(result.exactDuplicate);
      } else if (result.matches && result.matches.length > 0) {
        setDuplicatePlace(result.matches[0]);
      } else {
        setDuplicatePlace(null);
      }
    } catch (err) {
      console.error("[PlaceLocationPicker] Check duplicates error:", err);
    }
  };

  // DISABLED: saveLocation is no longer used - manual save is handled by parent PlaceWizard
  // Keeping this code commented for reference in case we need to restore autosave functionality
  /*
  const saveLocation = async (data: {
    lat: number;
    lng: number;
    googlePlaceId?: string;
    formattedAddr?: string;
    addressJson?: any[];
  }) => {
    setIsSaving(true);
    setError(null);

    try {
      const endpoint = data.googlePlaceId
        ? `/api/business/places/${placeId}/location/google`
        : `/api/business/places/${placeId}/location/manual`;

      const payload = data.googlePlaceId
        ? {
            googlePlaceId: data.googlePlaceId,
            lat: data.lat,
            lng: data.lng,
            formattedAddr: data.formattedAddr || "",
            addressJson: data.addressJson || [],
            cityId: cityId || null,
          }
        : {
            lat: data.lat,
            lng: data.lng,
            customAddress: data.formattedAddr || null,
            cityId: cityId || null,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData: { error?: string; message?: string } = {};
        
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error("[PlaceLocationPicker] Failed to parse JSON error response:", parseError);
          
          try {
            const textResponse = await response.text();
            console.error("[PlaceLocationPicker] Raw error response (first 300 chars):", textResponse.substring(0, 300));
            
            errorData = {
              error: "PARSE_ERROR",
              message: `Server returned non-JSON response: ${textResponse.substring(0, 100)}...`,
            };
          } catch (textError) {
            console.error("[PlaceLocationPicker] Failed to read response text:", textError);
            errorData = {
              error: "UNKNOWN_ERROR",
              message: "Failed to read server response",
            };
          }
        }
        
        console.error("[PlaceLocationPicker] Save location failed:", {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type"),
          errorData,
          endpoint,
          payload,
        });
        
        if (response.status === 409 && errorData.error === "DUPLICATE_GOOGLE_PLACE_ID") {
          console.error("Это место уже существует в системе");
          throw new Error(errorData.message || "Место уже существует");
        }
        
        const errorMessage = errorData.message || errorData.error || "Failed to save";
        console.error(`Ошибка: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.place) {
        if (result.place.cityId) setCityId(result.place.cityId);
        if (result.place.districtAutoId !== undefined) setDistrictAutoId(result.place.districtAutoId);
        if (result.place.metroAutoId !== undefined) setMetroAutoId(result.place.metroAutoId);
        if (result.place.metroAutoDistanceM !== undefined) setMetroAutoDistanceM(result.place.metroAutoDistanceM);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("[PlaceLocationPicker] Save error:", err);
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };
  */

  const handleClaimAccess = async () => {
    if (!duplicatePlace) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/business/places/${duplicatePlace.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Запрос доступа к месту",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim");
      }

      setIsSaved(true);
      setError(null);
      
      console.log("Запрос отправлен. Мы свяжемся после проверки.");
      
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("[PlaceLocationPicker] Claim error:", err);
      setError(err instanceof Error ? err.message : "Ошибка отправки запроса");
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinueAsNew = () => {
    // User confirms this is a different place
    setDuplicatePlace(null);
    setShowDetails(true);
  };

  const handleSaveDetails = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        placeKind: isInsideComplex ? "UNIT" : "STANDALONE",
        floor: isInsideComplex ? (floor || null) : null,
        unit: isInsideComplex ? (unit || null) : null,
        customAddress: howToFind || null,
      };

      const response = await fetch(`/api/business/places/${placeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error("[PlaceLocationPicker] Save details error:", err);
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDistrictChange = (value: string) => {
    const newValue = value === "" ? null : value;
    setDistrictManualId(newValue);

    // Pass to parent for manual save
    onUpdate?.({ districtManualId: newValue });
    
    // Silent update - no toast notifications
  };

  const handleMetroChange = (value: string) => {
    const newValue = value === "" ? null : value;
    setMetroManualId(newValue);

    // Pass to parent for manual save
    onUpdate?.({ metroManualId: newValue });
    
    // Silent update - no toast notifications
  };

  const handleResetDistrict = () => {
    setDistrictManualId(null);
    
    // Pass to parent for manual save
    onUpdate?.({ districtManualId: null });
    
    // Silent update - no toast notifications
  };

  const handleResetMetro = () => {
    setMetroManualId(null);
    setMetroManualDistanceM(null);

    // Pass to parent for manual save
    onUpdate?.({ metroManualId: null });
    
    // Silent update - no toast notifications
  };

  // Computed values
  const districtShown = districtManualId ?? districtAutoId;
  const metroShown = metroManualId ?? metroAutoId;
  const metroDistanceShown = metroManualId ? metroManualDistanceM : metroAutoDistanceM;

  // UI visibility logic
  const hasAutoEnrichment = !!(districtAutoId || metroAutoId);
  const showSelects = !!(location && cityId);
  const showReadOnlyEnrichment = !!(location && hasAutoEnrichment);

  const metroFilterOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    if (
      metroShown &&
      metroStations.length === 0 &&
      initialLocation?.metroName
    ) {
      out.push({ value: metroShown, label: initialLocation.metroName });
    }
    for (const m of metroStations) {
      out.push({ value: m.id, label: m.name });
    }
    return out;
  }, [metroShown, metroStations, initialLocation?.metroName]);

  return (
    <div className="space-y-6">
      {/* Status indicators */}
      {(isSaving || isSaved || error) && (
        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Сохраняю...</span>
            </div>
          )}
          {isSaved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>Сохранено</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
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
          <PlaceSearchInput
            onPlaceSelect={handlePlaceSelect}
            disabled={isSaving || disabled}
            initialValue={location?.address || initialLocation?.formattedAddr || ""}
          />
          <button
            type="button"
            onClick={() => setIsMapModalOpen(true)}
            disabled={disabled}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Выбрать точку на карте
          </button>
        </div>
      </div>

      {/* Map Preview (only show if location is set) */}
      {location && (
        <div>
          <Label>Выбранное местоположение</Label>
          <div className="mt-2 space-y-2">
            <PlaceMapPreview
              lat={location.lat}
              lng={location.lng}
              onOpenMap={() => setIsMapModalOpen(true)}
            />
            <p className="text-sm text-gray-600">
              Выбрано: {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
            </p>
          </div>
        </div>
      )}

      {/* District & Metro Selects (only show if location is set and cityId available) */}
      {showSelects && (
        <div id="geo-selects" className="space-y-4">
          {geoOptionsWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {geoOptionsWarning}
            </div>
          )}

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
            <div className="mt-1 text-xs text-muted-foreground">
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
              ) : districts.length === 0 ? (
                <span>Для этого города не загружены районы. Выбор станет доступен после настройки справочника.</span>
              ) : (
                <span>Не удалось определить район автоматически — выберите вручную</span>
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
              disabled={metroFilterOptions.length === 0 || disabled}
            />
            
            {/* Distance display */}
            {metroShown && metroDistanceShown !== null && (
              <p className="mt-1 text-sm text-gray-700">
                Расстояние: {formatDistance(metroDistanceShown)}
              </p>
            )}
            
            {/* Helper text */}
            <div className="mt-1 text-xs text-muted-foreground">
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
              ) : metroFilterOptions.length === 0 ? (
                <span>Для этого города не загружены станции метро. Выбор станет доступен после настройки справочника.</span>
              ) : (
                <span>Не удалось определить метро автоматически — выберите вручную</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Read-only display when location exists but cityId is missing */}
      {location && !cityId && (districtAutoId || districtManualId || metroAutoId || metroManualId) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Район и метро</h4>
          <p className="text-xs text-gray-600 mb-3">
            Данные сохранены, но редактирование недоступно (отсутствует cityId)
          </p>
          
          {(districtAutoId || districtManualId) && (
            <div className="text-sm">
              <span className="text-gray-600">Район:</span>{" "}
              <span className="text-gray-900">
                {districtManualId || districtAutoId}
                {districtManualId && " (выбрано вручную)"}
                {!districtManualId && districtAutoId && " (автоматически)"}
              </span>
            </div>
          )}
          
          {(metroAutoId || metroManualId) && (
            <div className="text-sm">
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

      {/* Read-only display for enriched data */}
      {showReadOnlyEnrichment && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-blue-900">📍 Определено автоматически</h4>
            {cityId && (
              <button
                type="button"
                onClick={() => {
                  // Scroll to selects section
                  const selectsSection = document.getElementById("geo-selects");
                  selectsSection?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                className="text-xs text-blue-700 hover:text-blue-800 hover:underline"
              >
                Изменить вручную
              </button>
            )}
          </div>
          
          {districtAutoId && (
            <div className="text-sm">
              <span className="text-blue-700">Район:</span>{" "}
              <span className="text-blue-900 font-medium">
                {districts.find(d => d.id === districtAutoId)?.name || 
                 initialLocation?.districtName || 
                 districtAutoId}
              </span>
            </div>
          )}
          
          {metroAutoId && (
            <div className="text-sm">
              <span className="text-blue-700">Метро:</span>{" "}
              <span className="text-blue-900 font-medium">
                {metroStations.find(m => m.id === metroAutoId)?.name || 
                 initialLocation?.metroName || 
                 metroAutoId}
                {metroAutoDistanceM !== null && ` · ${formatDistance(metroAutoDistanceM)}`}
              </span>
            </div>
          )}
          
          {!districtAutoId && !metroAutoId && (
            <p className="text-xs text-blue-700">
              Не удалось определить район и метро автоматически
            </p>
          )}
        </div>
      )}

      {/* Duplicate Detection */}
      {duplicatePlace && (
        <PlaceDuplicateBlock
          place={duplicatePlace}
          onClaimAccess={handleClaimAccess}
          onContinueAsNew={handleContinueAsNew}
          isLoading={isSaving}
        />
      )}

      {/* Details Section (only show if user chose "continue as new") */}
      {showDetails && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900">
            Уточнение (необязательно)
          </h3>

          {/* Inside Complex Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="inside-complex"
              checked={isInsideComplex}
              onCheckedChange={(checked) => setIsInsideComplex(checked === true)}
              disabled={disabled}
            />
            <label
              htmlFor="inside-complex"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Внутри ТЦ/комплекса
            </label>
          </div>

          {/* Complex Details (conditional) */}
          {isInsideComplex && (
            <div className="space-y-3 pl-6">
              <div>
                <Label htmlFor="floor">Этаж</Label>
                <Input
                  id="floor"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="Например: 2"
                  disabled={disabled}
                />
              </div>

              <div>
                <Label htmlFor="unit">Павильон / офис</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Например: A12"
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {/* How to Find (always visible) */}
          <div>
            <Label htmlFor="how-to-find">Как найти</Label>
            <Textarea
              id="how-to-find"
              value={howToFind}
              onChange={(e) => setHowToFind(e.target.value)}
              placeholder="Дополнительные указания для посетителей"
              rows={3}
              disabled={disabled}
            />
          </div>

          {/* Save Details Button */}
          <Button
            onClick={handleSaveDetails}
            disabled={isSaving || disabled}
            variant="outline"
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить уточнения
          </Button>
        </div>
      )}

      {/* Map Modal */}
      <PlaceMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialLat={location?.lat}
        initialLng={location?.lng}
        onConfirm={handleMapConfirm}
      />
    </div>
  );
}
