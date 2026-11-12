"use client";

import { useState } from "react";
import { AddressSuggestInput } from "@/components/address/AddressSuggestInput";
import { shouldAdoptExternalValue } from "@/lib/address/addressSuggestions";
import { toLegacyAddressComponents } from "@/services/googleMaps/toLegacyAddressComponents";

interface PlaceSearchInputProps {
  onPlaceSelect: (data: {
    googlePlaceId: string;
    placeName: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: google.maps.GeocoderAddressComponent[];
  }) => void;
  onInputChange?: (value: string) => void;
  disabled?: boolean;
  initialValue?: string; // Initial address to display
}

/**
 * Поле адреса мастера места и блоков статьи. Тонкая обёртка над общим {@link AddressSuggestInput}.
 * Выбор подсказки НЕ вызывает onInputChange (иначе редактор статьи сбросил бы только что
 * полученные координаты как «ручной ввод»).
 */
export function PlaceSearchInput({ onPlaceSelect, onInputChange, disabled, initialValue }: PlaceSearchInputProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const [previousInitialValue, setPreviousInitialValue] = useState(initialValue);

  if (initialValue !== previousInitialValue) {
    setPreviousInitialValue(initialValue);
    if (shouldAdoptExternalValue(initialValue, value)) setValue(initialValue ?? "");
  }

  return (
    <div id="place-location-search">
      <AddressSuggestInput
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          setValue(next);
          onInputChange?.(next);
        }}
        onSelect={(place) => {
          setValue(place.formattedAddress);
          onPlaceSelect({
            googlePlaceId: place.googlePlaceId,
            placeName: place.displayName || place.formattedAddress,
            lat: place.lat,
            lng: place.lng,
            formattedAddr: place.formattedAddress,
            addressJson: toLegacyAddressComponents(place.addressComponents) as unknown as google.maps.GeocoderAddressComponent[],
          });
        }}
      />
    </div>
  );
}
