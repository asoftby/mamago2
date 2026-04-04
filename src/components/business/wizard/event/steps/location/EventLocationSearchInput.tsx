"use client";

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { MapPin } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";
import { cn } from "@/lib/utils";

interface EventLocationSearchInputProps {
  onPlaceSelect: (data: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: unknown[];
  }) => void;
  disabled?: boolean;
  initialValue?: string;
  placeholder?: string;
}

export const EventLocationSearchInput = forwardRef<HTMLInputElement, EventLocationSearchInputProps>(
  function EventLocationSearchInput({ 
    onPlaceSelect, 
    disabled, 
    initialValue,
    placeholder = "Адрес или название места"
  }, forwardedRef) {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    // Expose the input element to parent via forwardedRef
    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    const initAutocomplete = useCallback(async () => {
      const inputBefore = inputRef.current;
      if (!inputBefore || !(inputBefore instanceof HTMLInputElement)) return;

      try {
        const placesLib = await GoogleMapsService.getPlacesLibrary();

        // После await ref мог смениться (Strict Mode / навигация) — только нативный input.
        const input = inputRef.current;
        if (!input || !(input instanceof HTMLInputElement)) return;

        const autocomplete = new placesLib.Autocomplete(input, {
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
        console.error("[EventLocationSearchInput] Init error:", err);
      }
    }, [onPlaceSelect]);

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
    }, [initAutocomplete]);

    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        {/* Нативный input: Places Autocomplete требует именно HTMLInputElement */}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-10 w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base leading-none shadow-xs outline-none md:text-sm dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "pl-10 text-[13px]",
          )}
        />
      </div>
    );
  }
);