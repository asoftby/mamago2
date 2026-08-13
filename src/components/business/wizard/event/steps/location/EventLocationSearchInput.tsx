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
import { placeAutocompleteWidgetStyles } from "@/services/googleMaps/placeAutocompleteWidgetStyle";
import { cn } from "@/lib/utils";

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

type PlaceAutocompleteElementCtor = new () => HTMLElement & {
  value?: string;
  focus?: () => void;
};

const EVENT_LOCATION_AUTOCOMPLETE_WIDGET_CLASS = "mg-event-location-autocomplete-widget";

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
      onInputValueChange,
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
    const onPlaceSelectRef = useRef(onPlaceSelect);
    const onInputValueChangeRef = useRef(onInputValueChange);
    const disabledRef = useRef(disabled);
    const placeholderRef = useRef(placeholder);
    const inputValueRef = useRef(initialValue ?? "");
    const shouldFocusWidgetRef = useRef(false);
    const [inputValue, setInputValue] = useState(initialValue ?? "");
    const [autocompleteRequested, setAutocompleteRequested] = useState(false);
    const [isWidgetReady, setIsWidgetReady] = useState(false);

    useImperativeHandle(forwardedRef, () => {
      const focusTarget = widgetRef.current ?? fallbackInputRef.current;
      return focusTarget as HTMLInputElement;
    });

    useEffect(() => {
      onPlaceSelectRef.current = onPlaceSelect;
    }, [onPlaceSelect]);

    useEffect(() => {
      onInputValueChangeRef.current = onInputValueChange;
    }, [onInputValueChange]);

    useEffect(() => {
      disabledRef.current = disabled;
    }, [disabled]);

    useEffect(() => {
      placeholderRef.current = placeholder;
    }, [placeholder]);

    useEffect(() => {
      inputValueRef.current = inputValue;
    }, [inputValue]);

    const applyWidgetAttributes = useCallback(
      (widget: HTMLElement & { value?: string; focus?: () => void }) => {
        const nextPlaceholder = placeholderRef.current;
        widget.setAttribute("placeholder", nextPlaceholder);
        widget.setAttribute("aria-label", nextPlaceholder);
        widget.setAttribute("included-region-codes", "by");
        widget.setAttribute("requested-language", "ru");
        widget.setAttribute("requested-region", "by");
        widget.setAttribute("unit-system", "metric");

        if (disabledRef.current) {
          widget.setAttribute("disabled", "");
        } else {
          widget.removeAttribute("disabled");
        }
      },
      [],
    );

    const syncWidgetValue = useCallback((widget: HTMLElement & { value?: string }, value: string) => {
      if (widget.value !== value) {
        widget.value = value;
      }
      if (widget.getAttribute("value") !== value) {
        widget.setAttribute("value", value);
      }
    }, []);

    const updateInputValue = useCallback((value: string) => {
      setInputValue(value);
      onInputValueChangeRef.current?.(value);
    }, []);

    const initAutocomplete = useCallback(async () => {
      if (widgetRef.current) {
        return;
      }
      console.debug("[EventLocationSearchInput] init");

      const host = hostRef.current;
      if (!host) {
        return;
      }

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
        applyWidgetAttributes(widget);
        syncWidgetValue(widget, inputValueRef.current);

        widget.classList.add(EVENT_LOCATION_AUTOCOMPLETE_WIDGET_CLASS);

        const handleInput = (event: Event) => {
          const target = event.target as HTMLInputElement | null;
          updateInputValue(target?.value ?? widget.value ?? "");
        };

        const handlePlaceSelect = async (event: Event) => {
          console.debug(`[EventLocationSearchInput] ${event.type}`);
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

          const nextFormattedAddress = place.formattedAddress ?? "";
          updateInputValue(nextFormattedAddress);
          onPlaceSelectRef.current({
            googlePlaceId: place.id,
            lat,
            lng,
            formattedAddr: nextFormattedAddress,
            addressJson: Array.isArray(place.addressComponents) ? place.addressComponents : [],
          });
        };

        widget.addEventListener("input", handleInput);
        widget.addEventListener("change", handleInput);
        widget.addEventListener("gmp-select", handlePlaceSelect);
        widget.addEventListener("gmp-placeselect", handlePlaceSelect);

        host.innerHTML = "";
        host.appendChild(widget);
        setIsWidgetReady(true);
        if (shouldFocusWidgetRef.current) {
          shouldFocusWidgetRef.current = false;
          widget.focus?.();
        }

        cleanupRef.current = () => {
          console.debug("[EventLocationSearchInput] cleanup");
          widget.removeEventListener("input", handleInput);
          widget.removeEventListener("change", handleInput);
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
        console.error("[EventLocationSearchInput] Init error:", err);
      }
    }, [applyWidgetAttributes, syncWidgetValue, updateInputValue]);

    useEffect(() => {
      const syncId = window.setTimeout(() => {
        setInputValue(initialValue ?? "");
      }, 0);
      return () => window.clearTimeout(syncId);
    }, [initialValue]);

    useEffect(() => {
      const widget = widgetRef.current;
      if (!widget) {
        return;
      }

      applyWidgetAttributes(widget);
    }, [applyWidgetAttributes, disabled, placeholder]);

    useEffect(() => {
      const widget = widgetRef.current;
      if (!widget) {
        return;
      }

      syncWidgetValue(widget, inputValue);
    }, [inputValue, syncWidgetValue]);

    const requestAutocomplete = useCallback(() => {
      if (disabled || autocompleteRequested) {
        return;
      }
      shouldFocusWidgetRef.current = true;
      setAutocompleteRequested(true);
    }, [autocompleteRequested, disabled]);

    useEffect(() => {
      if (!autocompleteRequested) {
        return;
      }

      const initId = window.setTimeout(() => {
        void initAutocomplete();
      }, 0);

      return () => {
        window.clearTimeout(initId);
        cleanupRef.current?.();
      };
    }, [autocompleteRequested, initAutocomplete]);

    return (
      <div className="relative">
        <style>{placeAutocompleteWidgetStyles(EVENT_LOCATION_AUTOCOMPLETE_WIDGET_CLASS)}</style>

        {/* Google's widget renders its own search icon — our MapPin is only shown for the fallback input */}
        {!isWidgetReady && (
          <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}

        <div ref={hostRef} className={cn("w-full", !isWidgetReady && "hidden")} />

        {!isWidgetReady ? (
          <input
            ref={fallbackInputRef}
            type="text"
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            value={inputValue}
            onChange={(event) => updateInputValue(event.target.value)}
            onFocus={requestAutocomplete}
            onPointerDown={requestAutocomplete}
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
  },
);
