"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { WizardRichTextField } from "@/components/business/wizard/shared/WizardRichTextField";
import { MapPinIcon, TruckIcon, ClockIcon, Loader2, Search, Sparkles, PlusCircle } from "lucide-react";
import type { EventFormData } from "../types";
import type { PendingLocation } from "../types";
import { PlaceSearchAutocomplete } from "./location/PlaceSearchAutocomplete";
import { QuickPlaceCreate } from "./location/QuickPlaceCreate";
import { formatEventLocationAddress } from "./location/eventLocationUtils";

interface Step2LocationProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string | null;
}

interface UserPlace {
  id: string;
  title: string;
  address: string;
  displayAddress: string;
  fullAddress: string;
  lat: number | null;
  lng: number | null;
  cityId: string | null;
  cityName: string;
  citySlug: string;
  districtId: string | null;
  districtName: string | null;
  metroId: string | null;
  metroName: string | null;
  metroDistanceM: number | null;
}

type ImportLocationHint = {
  venueName: string;
  addressText: string;
  cityName: string;
};

function compactPlaceAddress(address?: string | null) {
  if (!address) return "";

  return address
    .replace(/,\s*Беларусь\s*$/i, "")
    .replace(/,\s*Республика Беларусь\s*$/i, "")
    .trim();
}

function formatMetroSummary(metroName?: string | null, metroDistanceM?: number | null) {
  if (!metroName) return null;

  if (metroDistanceM === null || metroDistanceM === undefined) {
    return `м. ${metroName}`;
  }

  if (metroDistanceM > 2000) {
    return `м. ${metroName}`;
  }

  if (metroDistanceM >= 1000) {
    return `м. ${metroName} · ${(metroDistanceM / 1000).toFixed(1)} км`;
  }

  return `м. ${metroName} · ${Math.round(metroDistanceM)} м`;
}

export function Step2Location({ data, onChange, isEditable, eventId }: Step2LocationProps) {
  const [userPlaces, setUserPlaces] = useState<UserPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [mobileConcreteSnapshot, setMobileConcreteSnapshot] = useState<Partial<EventFormData> | null>(null);
  const [importHint, setImportHint] = useState<ImportLocationHint | null>(null);
  const [isLoadingImportHint, setIsLoadingImportHint] = useState(false);
  
  // New state for quick place creation
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateInitialName, setQuickCreateInitialName] = useState("");
  const [quickCreateInitialAddress, setQuickCreateInitialAddress] = useState("");
  const didRepairImportedAddressRef = useRef(false);

  // Handle place selection from search
  const handleSearchPlaceSelect = (place: {
    id: string;
    title: string;
    address: string;
    fullAddress: string;
    cityId: string | null;
    citySlug: string | null;
    lat: number | null;
    lng: number | null;
    districtId: string | null;
    districtName: string | null;
    metroId: string | null;
    metroName: string | null;
    metroDistanceM: number | null;
  }) => {
    const pending: PendingLocation = {
      mode: "EXISTING_PLACE",
      placeId: place.id,
      title: place.title,
      address: place.fullAddress || place.address,
      city: place.cityId || place.citySlug || undefined,
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
      source: "manual",
    };

    onChange({
      pendingLocation: pending,
      locationSource: "PLACE",
      venueKind: "PLACE",
      placeId: place.id,
      venueName: place.title,
      address: place.fullAddress || place.address,
      city: place.cityId || place.citySlug || "",
      lat: place.lat,
      lng: place.lng,
      source: "PLACE",
      districtAutoId: place.districtId,
      districtManualId: null,
      districtName: place.districtName,
      metroAutoId: place.metroId,
      metroAutoDistanceM: place.metroDistanceM,
      metroManualId: null,
      metroManualDistanceM: null,
      metroName: place.metroName,
      district: place.districtName || "",
      metro: place.metroName || "",
    });
    
    setShowQuickCreate(false);
  };

  // Handle quick place creation - stores pending location until publish
  const handleQuickPlaceCreated = (location: {
    id?: string;
    title: string;
    address: string;
    fullAddress: string;
    cityId: string | null;
    citySlug: string | null;
    lat: number | null;
    lng: number | null;
    districtId: string | null;
    districtName: string | null;
    metroId: string | null;
    metroName: string | null;
    metroDistanceM: number | null;
  }) => {
    const pending: PendingLocation = {
      mode: "NEW_PLACE",
      title: location.title,
      address: location.fullAddress || location.address,
      city:
        location.cityId ||
        location.citySlug ||
        importHint?.cityName ||
        data.city ||
        undefined,
      lat: location.lat ?? undefined,
      lng: location.lng ?? undefined,
      source: "manual",
    };

    onChange({
      pendingLocation: pending,
      locationSource: "MANUAL",
      venueKind: "MANUAL",
      placeId: null,
      venueName: location.title,
      address: location.fullAddress || location.address,
      city:
        location.cityId ||
        location.citySlug ||
        importHint?.cityName ||
        data.city ||
        "",
      lat: location.lat,
      lng: location.lng,
      source: "ADDRESS_INPUT",
      districtAutoId: location.districtId,
      districtManualId: null,
      districtName: location.districtName,
      metroAutoId: location.metroId,
      metroAutoDistanceM: location.metroDistanceM,
      metroManualId: null,
      metroManualDistanceM: null,
      metroName: location.metroName,
      district: location.districtName || "",
      metro: location.metroName || "",
    });
    
    handleCloseQuickCreate();
  };

  // Handle opening quick create with initial name from search
  const handleOpenQuickCreate = (initialName: string) => {
    setQuickCreateInitialName(initialName);
    setQuickCreateInitialAddress(importHint?.addressText ?? data.address ?? "");
    setShowQuickCreate(true);
  };

  const handleCreatePlaceFromSearch = (initialName: string) => {
    if (importHint && (importHint.venueName || importHint.addressText || importHint.cityName)) {
      const pending: PendingLocation = {
        mode: "PARSED_LOCATION",
        title: importHint.venueName || initialName || undefined,
        address: importHint.addressText || undefined,
        city: importHint.cityName || undefined,
        source: "parser",
      };

      onChange({
        pendingLocation: pending,
        locationSource: "MANUAL",
        venueKind: "MANUAL",
        placeId: null,
        venueName: importHint.venueName || initialName || "",
        address: importHint.addressText || "",
        city: importHint.cityName || "",
        lat: null,
        lng: null,
        source: "ADDRESS_INPUT",
        districtAutoId: null,
        districtManualId: null,
        districtName: null,
        metroAutoId: null,
        metroAutoDistanceM: null,
        metroManualId: null,
        metroManualDistanceM: null,
        metroName: null,
        district: "",
        metro: "",
      });
      setShowQuickCreate(false);
      return;
    }

    handleOpenQuickCreate(initialName);
  };

  // Handle closing quick create
  const handleCloseQuickCreate = () => {
    setShowQuickCreate(false);
    setQuickCreateInitialName(""); // Clear initial name
    setQuickCreateInitialAddress("");
  };

  const handleResetPendingPlace = () => {
    onChange({
      pendingLocation: null,
      locationSource: null,
      venueKind: null,
      placeId: null,
      venueName: "",
      address: "",
      city: "",
      lat: null,
      lng: null,
      source: null,
      districtAutoId: null,
      districtManualId: null,
      districtName: null,
      metroAutoId: null,
      metroAutoDistanceM: null,
      metroManualId: null,
      metroManualDistanceM: null,
      metroName: null,
      district: "",
      metro: "",
    });
    setShowQuickCreate(false);
    setQuickCreateInitialName("");
    setQuickCreateInitialAddress("");
  };

  const fetchUserPlaces = async () => {
    try {
      setIsLoadingPlaces(true);
      const response = await fetch('/api/business/places/for-events');
      
      if (!response.ok) {
        throw new Error('Failed to fetch places');
      }
      
      const result = await response.json();
      setUserPlaces(result.places || []);
    } catch (error) {
      console.error('Error fetching user places:', error);
      setPlacesError('Не удалось загрузить места');
    } finally {
      setIsLoadingPlaces(false);
    }
  };

  // Fetch user places on mount
  useEffect(() => {
    fetchUserPlaces();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let isActive = true;

    async function loadLocationHint() {
      setIsLoadingImportHint(true);
      try {
        const response = await fetch(`/api/business/events/${eventId}/location-source`);
        if (!response.ok) return;
        const payload = (await response.json()) as Partial<ImportLocationHint>;
        if (!isActive) return;

        const venueName = typeof payload.venueName === "string" ? payload.venueName.trim() : "";
        const addressText = typeof payload.addressText === "string" ? payload.addressText.trim() : "";
        const cityName = typeof payload.cityName === "string" ? payload.cityName.trim() : "";
        if (!venueName && !addressText && !cityName) {
          setImportHint(null);
          return;
        }

        setImportHint({
          venueName,
          addressText,
          cityName,
        });
      } catch (error) {
        console.error("[Step2Location] Failed to load location import hint:", error);
      } finally {
        if (isActive) setIsLoadingImportHint(false);
      }
    }

    void loadLocationHint();
    return () => {
      isActive = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (didRepairImportedAddressRef.current) return;
    if (!importHint?.addressText) return;
    if (data.placeId) return;
    if (data.venueKind !== "MANUAL") return;
    if (!data.address) return;

    const currentAddress = data.address.trim();
    const importedAddress = importHint.addressText.trim();

    if (!currentAddress.startsWith(importedAddress)) return;
    if (currentAddress === importedAddress) return;
    if (currentAddress.length < importedAddress.length + 24) return;

    didRepairImportedAddressRef.current = true;

    onChange({
      address: importedAddress,
      pendingLocation:
        data.pendingLocation &&
        (data.pendingLocation.mode === "NEW_PLACE" || data.pendingLocation.mode === "PARSED_LOCATION")
          ? {
              ...data.pendingLocation,
              address: importedAddress,
            }
          : data.pendingLocation,
    });
  }, [
    data.address,
    data.pendingLocation,
    data.placeId,
    data.venueKind,
    importHint,
    onChange,
  ]);

  // Check if any concrete location is defined (for TBD restriction)
  const hasConcreteLocation = Boolean(
    data.placeId || 
    data.address || 
    (data.lat && data.lng) ||
    data.venueKind === "PLACE" ||
    data.venueKind === "MANUAL"
  );

  // Check if location is set for showing location picker
  const hasLocation = data.lat !== null && data.lng !== null;

  // Handle place selection from user's places
  const handlePlaceSelect = (place: UserPlace) => {
    const pending: PendingLocation = {
      mode: "EXISTING_PLACE",
      placeId: place.id,
      title: place.title,
      address: place.fullAddress || place.address,
      city: place.cityId || place.citySlug || undefined,
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
      source: "manual",
    };

    onChange({
      pendingLocation: pending,
      locationSource: "PLACE",
      venueKind: "PLACE",
      placeId: place.id,
      venueName: place.title,
      address: place.fullAddress || place.address,
      city: place.cityId || place.citySlug,
      lat: place.lat,
      lng: place.lng,
      source: "PLACE",
      districtAutoId: place.districtId,
      districtManualId: null,
      districtName: place.districtName,
      metroAutoId: place.metroId,
      metroAutoDistanceM: place.metroDistanceM,
      metroManualId: null,
      metroManualDistanceM: null,
      metroName: place.metroName,
      district: place.districtName || "",
      metro: place.metroName || "",
    });
    setShowQuickCreate(false);
  };

  const pendingNewPlace =
    data.pendingLocation?.mode === "NEW_PLACE" || data.pendingLocation?.mode === "PARSED_LOCATION"
      ? data.pendingLocation
      : null;

  // Handle special cases
  const handleSpecialCase = (venueKind: "MOBILE" | "TBD") => {
    const pending: PendingLocation = {
      mode: venueKind === "MOBILE" ? "OFFSITE" : "TBA",
    };

    onChange({
      pendingLocation: pending,
      locationSource: null,
      venueKind,
      placeId: null,
      venueName: "",
      address: "",
      city: "",
      lat: null,
      lng: null,
      source: venueKind,
      districtAutoId: null,
      districtManualId: null,
      metroAutoId: null,
      metroManualId: null,
      district: "",
      metro: "",
      venueNote: data.venueNote,
    });
  };

  const toggleMobile = () => {
    if (!isEditable) return;

    if (data.venueKind === "MOBILE") {
      // Un-toggle: restore previous concrete location state
      if (mobileConcreteSnapshot) {
        onChange({
          ...mobileConcreteSnapshot,
          venueKind: mobileConcreteSnapshot.venueKind ?? null,
        });
      } else {
        onChange({
          pendingLocation: null,
          locationSource: null,
          venueKind: null,
          placeId: null,
          venueName: "",
          address: "",
          city: "",
          lat: null,
          lng: null,
          source: null,
          districtAutoId: null,
          districtManualId: null,
          metroAutoId: null,
          metroManualId: null,
          district: "",
          metro: "",
        });
      }
      return;
    }

    // Toggle ON: save current state and switch to MOBILE
    setMobileConcreteSnapshot({
      pendingLocation: data.pendingLocation,
      locationSource: data.locationSource,
      venueKind: data.venueKind,
      placeId: data.placeId,
      venueName: data.venueName,
      address: data.address,
      city: data.city,
      lat: data.lat,
      lng: data.lng,
      source: data.source,
      districtAutoId: data.districtAutoId,
      districtManualId: data.districtManualId,
      districtName: data.districtName,
      district: data.district,
      metroAutoId: data.metroAutoId,
      metroManualId: data.metroManualId,
      metroAutoDistanceM: data.metroAutoDistanceM,
      metroManualDistanceM: data.metroManualDistanceM,
      metroName: data.metroName,
      metro: data.metro,
    });

    handleSpecialCase("MOBILE");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Локация</h2>
        <p className="text-[12px] text-muted-foreground">
          Где проходит событие?
        </p>
      </div>

      {/* Main: Quick Place Search & Create */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Найти или создать место
        </Label>

        {isLoadingImportHint && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Ищем подсказку локации из источника парсинга...
          </div>
        )}

        {importHint && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Из источника парсинга
                </div>
                {importHint.venueName ? (
                  <div className="mt-1 text-sm font-medium text-amber-950">{importHint.venueName}</div>
                ) : null}
                {importHint.addressText ? (
                  <div className="mt-1 text-sm text-amber-900">{importHint.addressText}</div>
                ) : null}
                {importHint.cityName ? (
                  <div className="mt-1 text-[12px] text-amber-700">{importHint.cityName}</div>
                ) : null}
                <div className="mt-2 text-[11px] text-amber-700">
                  Используйте поиск ниже, чтобы выбрать существующее место или создать новое на основе данных источника.
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!showQuickCreate ? (
          <>
            <PlaceSearchAutocomplete
              onPlaceSelect={handleSearchPlaceSelect}
              onCreatePlace={handleCreatePlaceFromSearch}
              disabled={!isEditable}
              selectedPlaceId={data.placeId}
              placeholder="Начни вводить название места или адрес"
              initialQuery={!data.placeId && !pendingNewPlace ? importHint?.venueName ?? null : null}
              createPlaceName={importHint?.venueName ?? null}
              createPlaceHint={
                importHint
                  ? "Создать место на основе данных из источника"
                  : null
              }
            />
            
            {data.placeId && data.venueKind === "PLACE" && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-green-900">{data.venueName}</div>
                    <div className="mt-1 text-sm text-green-700">{data.address}</div>
                    {(data.districtName || data.metroName) && (
                      <div className="mt-1 text-xs text-green-600">
                        {data.districtName && data.districtName}
                        {data.districtName && data.metroName && " • "}
                        {data.metroName && `м. ${data.metroName}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!data.placeId && pendingNewPlace && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <PlusCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-amber-950">Новое место</div>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Будет создано при публикации
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-amber-900">{pendingNewPlace.title || data.venueName}</div>
                    {(pendingNewPlace.address || data.address || pendingNewPlace.city || data.city) && (
                      <div className="mt-1 text-sm text-amber-800">
                        {formatEventLocationAddress({
                          address: pendingNewPlace.address || data.address,
                          city: pendingNewPlace.city || data.city,
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuickCreateInitialName(pendingNewPlace.title || data.venueName || "");
                          setQuickCreateInitialAddress(
                            pendingNewPlace.address || data.address || importHint?.addressText || ""
                          );
                          setShowQuickCreate(true);
                        }}
                        disabled={!isEditable}
                      >
                        Изменить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetPendingPlace}
                        disabled={!isEditable}
                      >
                        Выбрать другое
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <QuickPlaceCreate
            onPlaceCreated={handleQuickPlaceCreated}
            onCancel={handleCloseQuickCreate}
            initialName={quickCreateInitialName}
            initialAddress={quickCreateInitialAddress}
            deferPlaceCreation
          />
        )}
      </div>

      {/* Block 1: My Places */}
      <div className="space-y-3">
        <Label>Мои места</Label>
        {isLoadingPlaces && (
          <div className="flex items-center gap-2 p-4 text-[12px] text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загружаем ваши места...
          </div>
        )}
        
        {placesError && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {placesError}
          </div>
        )}
        
        {!isLoadingPlaces && !placesError && userPlaces.length === 0 && (
          <div className="p-4 text-[12px] text-muted-foreground bg-gray-50 border border-gray-200 rounded-lg">
            У вас пока нет добавленных мест. Создайте место в разделе «Места», чтобы использовать его для событий.
          </div>
        )}
        
        {!isLoadingPlaces && !placesError && userPlaces.length > 0 && (
          <div className="space-y-2">
            {userPlaces.map((place) => {
              const addressLine = compactPlaceAddress(
                place.displayAddress || place.fullAddress || place.address
              );
              const metroSummary = formatMetroSummary(place.metroName, place.metroDistanceM);

              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handlePlaceSelect(place)}
                  disabled={!isEditable}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    data.placeId === place.id && data.venueKind === "PLACE"
                      ? "bg-primary/5 border-primary"
                      : "bg-white border-gray-300 hover:border-gray-400"
                  } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="font-medium">{place.title}</div>
                  {addressLine ? (
                    <div className="text-[12px] text-muted-foreground">
                      {addressLine}
                    </div>
                  ) : null}
                  {(place.districtName || metroSummary) && (
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {place.districtName && `${place.districtName}`}
                      {place.districtName && metroSummary && " • "}
                      {metroSummary}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Block 3: Special cases */}
      <div className="space-y-3">
        <Label>Особые случаи</Label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={toggleMobile}
            disabled={!isEditable}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              data.venueKind === "MOBILE"
                ? "bg-primary/5 border-primary"
                : "bg-white border-gray-300 hover:border-gray-400"
            } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center gap-3">
              <TruckIcon className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Выездное событие</div>
                <div className="text-[12px] text-muted-foreground">
                  Событие проходит на локации клиента или в разных местах
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSpecialCase("TBD")}
            disabled={!isEditable || hasConcreteLocation}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              data.venueKind === "TBD"
                ? "bg-primary/5 border-primary"
                : hasConcreteLocation
                ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                : "bg-white border-gray-300 hover:border-gray-400"
            } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Адрес уточняется</div>
                <div className="text-[12px] text-muted-foreground">
                  {hasConcreteLocation
                    ? "Недоступно: уже выбрана конкретная локация"
                    : "Место проведения будет объявлено позже"}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Active state badges */}
        {data.venueKind === "MOBILE" && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
            <TruckIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Выездное событие — конкретный адрес не указывается</span>
          </div>
        )}
        {data.venueKind === "TBD" && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] text-orange-800">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Адрес уточняется — будет объявлен позже</span>
          </div>
        )}
      </div>

      {/* Optional Note for MOBILE/TBD */}
      {(data.venueKind === "MOBILE" || data.venueKind === "TBD") && (
        <div className="space-y-2">
          <WizardRichTextField
            label="Дополнительная информация"
            helperText="Короткое пояснение для родителей и участников о формате локации."
            value={data.venueNote}
            onChange={(value) => onChange({ venueNote: value })}
            placeholder={
              data.venueKind === "MOBILE" 
                ? "Например: Выезд в пределах Минска" 
                : "Например: Локация будет объявлена за неделю до события"
            }
            disabled={!isEditable}
            minHeight={140}
          />
        </div>
      )}

      {/* (Summary block removed as requested) */}
    </div>
  );
}
