"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";

interface PlaceSearchInputProps {
  onPlaceSelect: (data: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: any[];
  }) => void;
  disabled?: boolean;
  initialValue?: string; // Initial address to display
}

export function PlaceSearchInput({ onPlaceSelect, disabled, initialValue }: PlaceSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Set initial value when component mounts or initialValue changes
  useEffect(() => {
    if (inputRef.current && initialValue) {
      inputRef.current.value = initialValue;
    }
  }, [initialValue]);

  useEffect(() => {
    initAutocomplete();
    return () => {
      if (autocompleteRef.current && typeof google !== "undefined") {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  const initAutocomplete = async () => {
    if (!inputRef.current) return;

    try {
      const placesLib = await GoogleMapsService.getPlacesLibrary();

      const autocomplete = new placesLib.Autocomplete(inputRef.current, {
        types: ["geocode", "establishment"],
        fields: ["place_id", "name", "geometry", "formatted_address", "address_components"],
        componentRestrictions: { country: "by" },
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        
        if (!place.place_id || !place.geometry?.location) {
          return;
        }

        onPlaceSelect({
          googlePlaceId: place.place_id,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          formattedAddr: place.formatted_address || "",
          addressJson: place.address_components || [],
        });
      });
    } catch (err) {
      console.error("[PlaceSearchInput] Init error:", err);
    }
  };

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        ref={inputRef}
        placeholder="Адрес или название места"
        className="pl-10"
        disabled={disabled}
      />
    </div>
  );
}
