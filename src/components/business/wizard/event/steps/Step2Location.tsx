"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPinIcon, TruckIcon, ClockIcon, Loader2 } from "lucide-react";
import type { EventFormData } from "../types";
import { EventLocationPicker } from "./location/EventLocationPicker";
import { formatEventLocationAddress } from "./location/eventLocationUtils";

interface Step2LocationProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

interface UserPlace {
  id: string;
  title: string;
  address: string;
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

export function Step2Location({ data, onChange, isEditable }: Step2LocationProps) {
  const [userPlaces, setUserPlaces] = useState<UserPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [placesError, setPlacesError] = useState<string | null>(null);

  // Fetch user places on mount
  useEffect(() => {
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

    fetchUserPlaces();
  }, []);

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
    console.log('[Step2Location] Selecting place:', place);
    
    onChange({
      // Set location source to PLACE
      locationSource: "PLACE",
      venueKind: "PLACE",
      placeId: place.id,
      venueName: place.title,
      address: place.fullAddress || place.address,
      city: place.cityId || place.citySlug, // Prefer cityId, fallback to slug
      lat: place.lat,
      lng: place.lng,
      source: "PLACE",
      
      // Use place's district and metro data directly (priority over auto-detection)
      districtAutoId: place.districtId, // Store as auto since it comes from place
      districtManualId: null, // Clear manual override
      districtName: place.districtName,
      
      metroAutoId: place.metroId, // Store as auto since it comes from place
      metroAutoDistanceM: place.metroDistanceM,
      metroManualId: null, // Clear manual override
      metroManualDistanceM: null,
      metroName: place.metroName,
      
      // Clear legacy fields
      district: place.districtName || "",
      metro: place.metroName || "",
    });
  };

  // Handle special cases
  const handleSpecialCase = (venueKind: "MOBILE" | "TBD") => {
    onChange({
      locationSource: null,
      venueKind,
      placeId: null,
      venueName: "",
      address: "",
      city: "",
      lat: null,
      lng: null,
      source: venueKind,
      // Reset all geo fields
      districtAutoId: null,
      districtManualId: null,
      metroAutoId: null,
      metroManualId: null,
      district: "",
      metro: "",
      venueNote: "",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Локация</h2>
        <p className="text-sm text-muted-foreground">
          Где проходит событие?
        </p>
      </div>

      {/* Block 1: My Places */}
      <div className="space-y-3">
        <Label>Мои места</Label>
        
        {isLoadingPlaces && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
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
          <div className="p-4 text-sm text-muted-foreground bg-gray-50 border border-gray-200 rounded-lg">
            У вас пока нет добавленных мест. Создайте место в разделе "Места", чтобы использовать его для событий.
          </div>
        )}
        
        {!isLoadingPlaces && !placesError && userPlaces.length > 0 && (
          <div className="space-y-2">
            {userPlaces.map((place) => (
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
                <div className="text-sm text-muted-foreground">
                  {place.cityName} • {place.address}
                </div>
                {/* Show district/metro info if available */}
                {(place.districtName || place.metroName) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {place.districtName && `${place.districtName}`}
                    {place.districtName && place.metroName && " • "}
                    {place.metroName && `м. ${place.metroName}`}
                    {place.metroDistanceM && ` (${Math.round(place.metroDistanceM)}м)`}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Location Picker - same as Place */}
      <EventLocationPicker
        data={data}
        onChange={onChange}
        disabled={!isEditable}
      />

      {/* Block 3: Special cases */}
      <div className="space-y-3">
        <Label>Особые случаи</Label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleSpecialCase("MOBILE")}
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
                <div className="text-sm text-muted-foreground">
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
                <div className="font-medium">Локация будет объявлена позже</div>
                <div className="text-sm text-muted-foreground">
                  {hasConcreteLocation 
                    ? "Недоступно: уже выбрана конкретная локация"
                    : "Место проведения пока не определено"
                  }
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Optional Note for MOBILE/TBD */}
      {(data.venueKind === "MOBILE" || data.venueKind === "TBD") && (
        <div className="space-y-2">
          <Label htmlFor="location-note">Дополнительная информация (опционально)</Label>
          <Textarea
            id="location-note"
            value={data.venueNote}
            onChange={(e) => onChange({ venueNote: e.target.value })}
            placeholder={
              data.venueKind === "MOBILE" 
                ? "Например: Выезд в пределах Минска" 
                : "Например: Локация будет объявлена за неделю до события"
            }
            disabled={!isEditable}
            rows={3}
          />
        </div>
      )}

      {/* Current Selection Summary */}
      {data.venueKind && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <MapPinIcon className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-medium text-green-900">Локация выбрана</div>
              <div className="text-sm text-green-700 mt-1">
                {data.venueKind === "PLACE" && data.venueName && (
                  <>{data.venueName} • {data.city}</>
                )}
                {data.venueKind === "MANUAL" && (
                  <>
                    {formatEventLocationAddress({
                      venueName: data.venueName,
                      address: data.address,
                      city: data.city,
                    })}
                  </>
                )}
                {data.venueKind === "MOBILE" && "Выездное событие"}
                {data.venueKind === "TBD" && "Локация будет объявлена"}
                {data.source && (
                  <div className="text-xs mt-1 opacity-75">
                    Источник: {data.source === "PLACE" ? "Место из базы" : 
                              data.source === "ADDRESS_INPUT" ? "Google Places" :
                              data.source === "MAP_PICKER" ? "Выбор на карте" : data.source}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}