"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
      addressComponents?: unknown[];
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
        addressComponents?: unknown[];
        fetchFields?: (input: { fields: string[] }) => Promise<void>;
      };
    };
  };
};

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

export const EventLocationSearchInput = forwardRef<HTMLInputElement, EventLocationSearchInputProps>(
  function EventLocationSearchInput(
    {
      onPlaceSelect,
      disabled,
      initialValue,
      placeholder = "Адрес или название места",
    },
    forwardedRef,
  ) {
    const fallbackInputRef = useRef<HTMLInputElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<(HTMLElement & { value?: string; focus?: () => void }) | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);
    const [isWidgetReady, setIsWidgetReady] = useState(false);

    useImperativeHandle(forwardedRef, () => {
      const focusTarget = widgetRef.current ?? fallbackInputRef.current;
      return focusTarget as HTMLInputElement;
    });

    const syncWidgetState = useCallback(() => {
      const widget = widgetRef.current;
      if (!widget) {
        return;
      }

      widget.setAttribute("placeholder", placeholder);
      widget.setAttribute("aria-label", placeholder);
      widget.setAttribute("included-region-codes", "by");
      widget.setAttribute("requested-language", "ru");
      widget.setAttribute("requested-region", "by");
      widget.setAttribute("unit-system", "metric");

      if (disabled) {
        widget.setAttribute("disabled", "");
      } else {
        widget.removeAttribute("disabled");
      }

      if (typeof initialValue === "string") {
        widget.value = initialValue;
        widget.setAttribute("value", initialValue);
      }
    }, [disabled, initialValue, placeholder]);

    const initAutocomplete = useCallback(async () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      widgetRef.current = null;
      setIsWidgetReady(false);

      const host = hostRef.current;
      if (!host) {
        return;
      }

      host.innerHTML = "";

      try {
        const placesLib = (await GoogleMapsService.getPlacesLibrary()) as google.maps.PlacesLibrary & {
          PlaceAutocompleteElement?: PlaceAutocompleteElementCtor;
        };

        const PlaceAutocompleteElement = placesLib.PlaceAutocompleteElement;
        if (!PlaceAutocompleteElement) {
          return;
        }

        const widget = new PlaceAutocompleteElement();
        widgetRef.current = widget;
        syncWidgetState();

        widget.style.display = "block";
        widget.style.width = "100%";

        const handlePlaceSelect = async (event: Event) => {
          const selectEvent = event as PlaceAutocompleteSelectionEvent;
          const prediction =
            selectEvent.placePrediction ??
            selectEvent.detail?.placePrediction;

          const place = prediction?.toPlace?.();
          if (!place) {
            return;
          }

          try {
            await place.fetchFields?.({
              fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
            });
          } catch (error) {
            console.error("[EventLocationSearchInput] Place fetch error:", error);
            return;
          }

          const lat = readCoordinate(place.location?.lat);
          const lng = readCoordinate(place.location?.lng);
          if (!place.id || lat === null || lng === null) {
            return;
          }

          onPlaceSelect({
            googlePlaceId: place.id,
            lat,
            lng,
            formattedAddr: place.formattedAddress ?? "",
            addressJson: Array.isArray(place.addressComponents) ? place.addressComponents : [],
          });
        };

        widget.addEventListener("gmp-select", handlePlaceSelect);
        widget.addEventListener("gmp-placeselect", handlePlaceSelect);

        host.appendChild(widget);
        setIsWidgetReady(true);

        cleanupRef.current = () => {
          widget.removeEventListener("gmp-select", handlePlaceSelect);
          widget.removeEventListener("gmp-placeselect", handlePlaceSelect);
          if (host.contains(widget)) {
            host.removeChild(widget);
          }
        };
      } catch (err) {
        console.error("[EventLocationSearchInput] Init error:", err);
      }
    }, [onPlaceSelect, syncWidgetState]);

    useEffect(() => {
      if (fallbackInputRef.current && typeof initialValue === "string") {
        fallbackInputRef.current.value = initialValue;
      }
    }, [initialValue]);

    useEffect(() => {
      initAutocomplete();
      return () => {
        cleanupRef.current?.();
      };
    }, [initAutocomplete]);

    useEffect(() => {
      syncWidgetState();
    }, [syncWidgetState]);

    return (
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <div
          className={cn(
            "border-input focus-within:border-ring focus-within:ring-ring/50 min-h-10 w-full rounded-md border bg-white pl-10 pr-3 py-2 shadow-xs focus-within:ring-[3px]",
            "text-[13px]",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            !isWidgetReady && "hidden",
          )}
        >
          <div
            ref={hostRef}
            className={cn(
              "min-h-[24px] w-full",
              "[&_gmp-place-autocomplete]:block [&_gmp-place-autocomplete]:w-full",
            )}
          />
        </div>

        {!isWidgetReady ? (
          <input
            ref={fallbackInputRef}
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
        ) : null}
      </div>
    );
  },
);
