"use client";

import { forwardRef, useState } from "react";
import { AddressSuggestInput } from "@/components/address/AddressSuggestInput";
import { shouldAdoptExternalValue } from "@/lib/address/addressSuggestions";

interface EventLocationSearchInputProps {
  onPlaceSelect: (data: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: unknown[];
  }) => void;
  onInputValueChange?: (value: string) => void;
  disabled?: boolean;
  initialValue?: string;
  placeholder?: string;
}

/**
 * Поле адреса мастера события / быстрого создания места.
 * Тонкая обёртка над общим {@link AddressSuggestInput}: собственных подсказок и виджета Google здесь нет.
 */
export const EventLocationSearchInput = forwardRef<HTMLInputElement, EventLocationSearchInputProps>(
  function EventLocationSearchInput(
    { onPlaceSelect, onInputValueChange, disabled, initialValue, placeholder = "Адрес или название места" },
    forwardedRef,
  ) {
    const [value, setValue] = useState(initialValue ?? "");
    const [previousInitialValue, setPreviousInitialValue] = useState(initialValue);

    // Значение, пришедшее от родителя (сброс/восстановление формы), подхватываем;
    // эхо того, что пользователь только что набрал, не перезаписывает поле.
    if (initialValue !== previousInitialValue) {
      setPreviousInitialValue(initialValue);
      if (shouldAdoptExternalValue(initialValue, value)) setValue(initialValue ?? "");
    }

    return (
      <AddressSuggestInput
        ref={forwardedRef}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onValueChange={(next) => {
          setValue(next);
          onInputValueChange?.(next);
        }}
        onSelect={(place) => {
          setValue(place.formattedAddress);
          onInputValueChange?.(place.formattedAddress);
          onPlaceSelect({
            googlePlaceId: place.googlePlaceId,
            lat: place.lat,
            lng: place.lng,
            formattedAddr: place.formattedAddress,
            addressJson: place.addressComponents,
          });
        }}
      />
    );
  },
);
