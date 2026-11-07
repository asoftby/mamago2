"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMapsService } from "@/services/googleMaps";

type Prediction = {
  text?: { text?: string; toString?: () => string };
  mainText?: { text?: string };
  secondaryText?: { text?: string };
  toPlace: () => google.maps.places.Place;
};

type Suggestion = { placePrediction?: Prediction };

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: google.maps.places.Place) => Promise<void> | void;
  placeholder: string;
  disabled?: boolean;
}

/** Mobile-only, controlled Google Places suggestions; avoids the widget's viewport-sized popover on iOS. */
export function MobilePlaceAutocomplete({ value, onChange, onSelect, placeholder, disabled }: Props) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestRef = useRef(0);
  const selectingRef = useRef(false);

  useEffect(() => {
    if (!open || disabled || selectingRef.current || value.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const request = ++requestRef.current;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const places = await GoogleMapsService.getPlacesLibrary();
        if (!sessionRef.current) {
          sessionRef.current = new places.AutocompleteSessionToken();
        }
        const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value,
          sessionToken: sessionRef.current,
          language: "ru",
          region: "by",
        });
        if (request === requestRef.current) {
          setSuggestions(response.suggestions
            .map((suggestion: Suggestion) => suggestion.placePrediction)
            .filter((prediction): prediction is Prediction => Boolean(prediction)));
        }
      } catch (cause) {
        console.error("[MobilePlaceAutocomplete] Search error:", cause);
        if (request === requestRef.current) {
          setSuggestions([]);
          setError(true);
        }
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      requestRef.current++;
    };
  }, [value, open, disabled]);

  const choose = async (prediction: Prediction) => {
    selectingRef.current = true;
    requestRef.current++;
    setOpen(false);
    setSuggestions([]);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"] });
      await onSelect(place);
      sessionRef.current = null;
    } catch (cause) {
      console.error("[MobilePlaceAutocomplete] Selection error:", cause);
      setError(true);
    } finally {
      selectingRef.current = false;
    }
  };

  return (
    <div className="relative min-w-0 w-full">
      <input
        type="text"
        className="border-input h-10 w-full min-w-0 rounded-md border bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        style={{ fontSize: 16 }}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={placeholder}
        aria-expanded={open && suggestions.length > 0}
        aria-controls="mobile-place-predictions"
        onFocus={() => setOpen(true)}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); if (event.key === "Escape") setOpen(false); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && (suggestions.length > 0 || loading || error) && (
        <div id="mobile-place-predictions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-md border bg-white shadow-lg">
          {suggestions.map((prediction, index) => (
            <button
              key={index}
              type="button"
              role="option"
              aria-selected={false}
              className="block w-full border-b px-3 py-3 text-left text-sm text-gray-900 last:border-0"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => void choose(prediction)}
            >
              {prediction.text?.text ?? prediction.mainText?.text ?? ""}
              {prediction.secondaryText?.text ? <span className="block text-xs text-gray-500">{prediction.secondaryText.text}</span> : null}
            </button>
          ))}
          {loading && <p className="p-3 text-sm text-gray-500">Поиск адреса…</p>}
          {error && <p className="p-3 text-sm text-red-600">Не удалось загрузить адреса. Повторите ввод.</p>}
          <div className="px-3 py-1 text-right text-xs text-gray-500">Powered by Google</div>
        </div>
      )}
    </div>
  );
}
