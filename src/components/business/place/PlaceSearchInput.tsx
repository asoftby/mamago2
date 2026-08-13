"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { GoogleMapsService } from "@/services/googleMaps";
import { toLegacyAddressComponents, type NewAddressComponent } from "@/services/googleMaps/toLegacyAddressComponents";
import { cn } from "@/lib/utils";

interface PlaceSearchInputProps {
  onPlaceSelect: (data: {
    googlePlaceId: string;
    placeName: string;
    lat: number;
    lng: number;
    formattedAddr: string;
    addressJson: google.maps.GeocoderAddressComponent[];
  }) => void;
  disabled?: boolean;
  initialValue?: string; // Initial address to display
}

type PlaceAutocompleteElementCtor = new () => HTMLElement & {
  value?: string;
  focus?: () => void;
};

type PlaceAutocompleteSelectionEvent = Event & {
  placePrediction?: {
    toPlace?: () => {
      id?: string;
      displayName?: string;
      formattedAddress?: string;
      location?: {
        lat?: number | (() => number);
        lng?: number | (() => number);
      };
      addressComponents?: NewAddressComponent[];
      fetchFields?: (input: { fields: string[] }) => Promise<void>;
    };
  };
  detail?: {
    placePrediction?: {
      toPlace?: () => {
        id?: string;
        displayName?: string;
        formattedAddress?: string;
        location?: {
          lat?: number | (() => number);
          lng?: number | (() => number);
        };
        addressComponents?: NewAddressComponent[];
        fetchFields?: (input: { fields: string[] }) => Promise<void>;
      };
    };
  };
};

const PLACE_SEARCH_WIDGET_CLASS = "mg-place-search-autocomplete-widget";

function readCoordinate(value: number | (() => number) | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "function") {
    const resolved = value();
    return Number.isFinite(resolved) ? resolved : null;
  }
  return null;
}

export function PlaceSearchInput({ onPlaceSelect, disabled, initialValue }: PlaceSearchInputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<(HTMLElement & { value?: string; focus?: () => void }) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const [isWidgetReady, setIsWidgetReady] = useState(false);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  const initAutocomplete = useCallback(async () => {
    if (widgetRef.current) return;

    const host = hostRef.current;
    if (!host) return;

    try {
      const placesLib = (await GoogleMapsService.getPlacesLibrary()) as google.maps.PlacesLibrary & {
        PlaceAutocompleteElement?: PlaceAutocompleteElementCtor;
      };

      const PlaceAutocompleteElement = placesLib.PlaceAutocompleteElement;
      if (!PlaceAutocompleteElement) return;

      const widget = new PlaceAutocompleteElement();
      widgetRef.current = widget;

      widget.setAttribute("placeholder", "Адрес или название места");
      widget.setAttribute("aria-label", "Адрес или название места");
      widget.setAttribute("included-region-codes", "by");
      widget.setAttribute("requested-language", "ru");
      widget.setAttribute("requested-region", "by");

      if (disabled) {
        widget.setAttribute("disabled", "");
      }

      if (initialValue) {
        widget.value = initialValue;
        widget.setAttribute("value", initialValue);
      }

      widget.classList.add(PLACE_SEARCH_WIDGET_CLASS);
      widget.style.display = "block";
      widget.style.width = "100%";
      widget.style.colorScheme = "light";
      widget.style.backgroundColor = "#FFFFFF";
      widget.style.color = "#1F1F1F";

      const handlePlaceSelect = async (event: Event) => {
        const selectEvent = event as PlaceAutocompleteSelectionEvent;
        const prediction = selectEvent.placePrediction ?? selectEvent.detail?.placePrediction;

        const place = prediction?.toPlace?.();
        if (!place) return;

        try {
          await place.fetchFields?.({
            fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
          });
        } catch (error) {
          console.error("[PlaceSearchInput] Place fetch error:", error);
          return;
        }

        const lat = readCoordinate(place.location?.lat);
        const lng = readCoordinate(place.location?.lng);
        if (!place.id || lat === null || lng === null) return;

        onPlaceSelectRef.current({
          googlePlaceId: place.id,
          placeName: place.displayName || place.formattedAddress || "",
          lat,
          lng,
          formattedAddr: place.formattedAddress || "",
          addressJson: toLegacyAddressComponents(place.addressComponents),
        });
      };

      widget.addEventListener("gmp-select", handlePlaceSelect);
      widget.addEventListener("gmp-placeselect", handlePlaceSelect);

      host.innerHTML = "";
      host.appendChild(widget);
      setIsWidgetReady(true);

      cleanupRef.current = () => {
        widget.removeEventListener("gmp-select", handlePlaceSelect);
        widget.removeEventListener("gmp-placeselect", handlePlaceSelect);
        if (host.contains(widget)) {
          host.removeChild(widget);
        }
        widgetRef.current = null;
        cleanupRef.current = null;
        setIsWidgetReady(false);
      };
    } catch (err) {
      console.error("[PlaceSearchInput] Init error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initAutocomplete();
    return () => {
      cleanupRef.current?.();
    };
  }, [initAutocomplete]);

  // Keep the widget's disabled attribute and value in sync with props after it mounts
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    if (disabled) {
      widget.setAttribute("disabled", "");
    } else {
      widget.removeAttribute("disabled");
    }
  }, [disabled]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || initialValue === undefined) return;
    if (widget.value !== initialValue) {
      widget.value = initialValue;
    }
  }, [initialValue]);

  return (
    <div id="place-location-search" className="relative">
      <style>{`
        .${PLACE_SEARCH_WIDGET_CLASS} {
          color-scheme: light;
          background-color: #ffffff;
          color: #1f1f1f;
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(input-field) {
          background-color: #ffffff;
          color: #1f1f1f;
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(predictions) {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(31, 31, 31, 0.12);
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(prediction-item) {
          background-color: #ffffff;
          color: #1f1f1f;
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(prediction-item-match) {
          color: #1f1f1f;
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(prediction-item-selected) {
          background-color: #f3f4f6;
          color: #1f1f1f;
        }

        .${PLACE_SEARCH_WIDGET_CLASS}::part(prediction-item-icon) {
          color: #6b6b6b;
        }
      `}</style>

      <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />

      <div
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 h-10 w-full rounded-md border bg-white pl-10 pr-3 shadow-xs focus-within:ring-[3px]",
          "flex items-center text-sm",
          !isWidgetReady && "hidden",
        )}
      >
        <div ref={hostRef} className="w-full" />
      </div>

      {!isWidgetReady ? (
        <input
          ref={fallbackInputRef}
          type="text"
          placeholder="Адрес или название места"
          disabled={disabled}
          defaultValue={initialValue}
          autoComplete="off"
          className={cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-10 w-full min-w-0 rounded-md border bg-white px-3 py-2 text-base leading-none shadow-xs outline-none md:text-sm dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "pl-10",
          )}
        />
      ) : null}
    </div>
  );
}
