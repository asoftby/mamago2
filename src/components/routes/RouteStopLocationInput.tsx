"use client";

/**
 * RouteStopLocationInput
 *
 * Single smart input for route stop location resolution.
 * Resolution order (invisible to user):
 *   1. Search mamaGo Places DB
 *   2. Google Places Autocomplete (fallback)
 *   3. Manual map pin (user-triggered)
 *
 * States:
 *   - empty:    input + hint + "Указать на карте" link
 *   - searching: input + loading indicator + dropdown
 *   - selected:  entity card + edit/clear actions
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { PlaceMapModal } from "@/components/business/place/PlaceMapModal";
import { GoogleMapsService } from "@/services/googleMaps";
import {
  MapPin, Search, Building2, Navigation,
  X, Pencil, Loader2, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteStopSource = "PLACE" | "GOOGLE" | "MANUAL_PIN";

export type RouteStopLocationValue = {
  source: RouteStopSource;
  placeId?: string;
  googlePlaceId?: string;
  /** Canonical title — Place title for PLACE, Google name for GOOGLE, coords for MANUAL_PIN */
  title: string;
  /**
   * Human-readable step label set by the user.
   * Only relevant for GOOGLE and MANUAL_PIN sources.
   * For PLACE, the Place title is used directly.
   */
  customTitle?: string;
  address?: string;
  cityId?: string;
  cityName?: string;
  lat?: number;
  lng?: number;
};

type PlaceResult = {
  id: string;
  title: string;
  address: string;
  cityId: string | null;
  cityName: string | null;
  lat: number | null;
  lng: number | null;
};

type GoogleResult = {
  googlePlaceId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: PlaceResult[]; google: GoogleResult[] }
  | { kind: "empty" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sourceIcon(source: RouteStopSource) {
  if (source === "PLACE") return <Building2 className="w-4 h-4" />;
  if (source === "GOOGLE") return <Search className="w-4 h-4" />;
  return <Navigation className="w-4 h-4" />;
}

function sourceLabel(source: RouteStopSource) {
  if (source === "PLACE") return "mamaGo";
  if (source === "GOOGLE") return "Google";
  return "Пин";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RouteStopLocationInputProps {
  value?: RouteStopLocationValue | null;
  onChange: (value: RouteStopLocationValue | null) => void;
  disabled?: boolean;
}

export function RouteStopLocationInput({
  value,
  onChange,
  disabled = false,
}: RouteStopLocationInputProps) {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ kind: "idle" });
  const [mapOpen, setMapOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(!value);

  // Sync isEditing when value is set externally (e.g. parent state restore)
  const prevValueRef = useRef(value);
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    // If value was null and is now set externally, exit editing mode
    if (!prev && value) setIsEditing(false);
    // If value was set and is now cleared externally, enter editing mode
    if (prev && !value) setIsEditing(true);
  }, [value]);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Always-current ref for onChange — prevents stale closure in autocomplete listener
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ── Google Autocomplete init ──────────────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return;
    initGoogleAutocomplete();
    return () => {
      if (autocompleteRef.current && typeof google !== "undefined") {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isEditing]);

  const initGoogleAutocomplete = async () => {
    if (!inputRef.current || !(inputRef.current instanceof HTMLInputElement)) return;
    try {
      const placesLib = await GoogleMapsService.getPlacesLibrary();
      const input = inputRef.current;
      if (!input || !(input instanceof HTMLInputElement)) return;
      const autocomplete = new placesLib.Autocomplete(input, {
        types: ["geocode", "establishment"],
        fields: ["place_id", "name", "geometry", "formatted_address"],
        componentRestrictions: { country: "by" },
      });
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.place_id || !place.geometry?.location) return;

        const result: RouteStopLocationValue = {
          source: "GOOGLE",
          googlePlaceId: place.place_id,
          title: place.name || place.formatted_address || "",
          address: place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        // Use ref so we always call the latest onChange, never a stale closure
        onChangeRef.current(result);
        setIsEditing(false);
        setSearchState({ kind: "idle" });
        setQuery("");
      });
    } catch (err) {
      console.error("[RouteStopLocationInput] Google autocomplete init error:", err);
    }
  };

  // ── Debounced mamaGo place search ─────────────────────────────────────────
  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchState({ kind: "idle" });
      return;
    }

    setSearchState({ kind: "searching" });

    try {
      const res = await fetch(`/api/routes/stops/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const places: PlaceResult[] = data.results ?? [];

      setSearchState({
        kind: "results",
        places,
        google: [], // Google results come via autocomplete listener
      });

      if (places.length === 0) {
        setSearchState({ kind: "empty" });
      }
    } catch {
      setSearchState({ kind: "empty" });
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(q), 300);
  };

  // ── Selection handlers ────────────────────────────────────────────────────
  const confirmSelection = (val: RouteStopLocationValue) => {
    onChangeRef.current(val);
    setIsEditing(false);
    setSearchState({ kind: "idle" });
    setQuery("");
  };

  const handlePlaceSelect = (place: PlaceResult) => {
    confirmSelection({
      source: "PLACE",
      placeId: place.id,
      title: place.title,
      address: place.address,
      cityId: place.cityId ?? undefined,
      cityName: place.cityName ?? undefined,
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
    });
  };

  const handleMapConfirm = (data: { lat: number; lng: number; formattedAddr?: string }) => {
    confirmSelection({
      source: "MANUAL_PIN",
      title: data.formattedAddr || `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`,
      address: data.formattedAddr || `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`,
      lat: data.lat,
      lng: data.lng,
    });
    setMapOpen(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setQuery(value?.title ?? "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = () => {
    onChange(null);
    setIsEditing(true);
    setQuery("");
    setSearchState({ kind: "idle" });
  };

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (searchState.kind === "results" || searchState.kind === "empty") {
          setSearchState({ kind: "idle" });
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchState.kind]);

  // ── Render: selected entity card ──────────────────────────────────────────
  if (value && !isEditing) {
    // For PLACE: title comes from the Place entity
    // For GOOGLE/MANUAL_PIN: show customTitle if set, otherwise fall back to title (address)
    const displayTitle =
      value.source === "PLACE"
        ? value.title
        : value.customTitle || value.title;

    // Secondary line: for PLACE show address; for others show the raw address/coords
    const displayAddress =
      value.source === "PLACE"
        ? value.address
        : value.address !== value.title
        ? value.address
        : undefined;

    return (
      <>
        <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
          <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5 text-neutral-500">
            {sourceIcon(value.source)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate">{displayTitle}</p>
            {displayAddress && (
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{displayAddress}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="text-xs text-neutral-400">{sourceLabel(value.source)}</span>
              {value.cityName && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-xs text-neutral-400">{value.cityName}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleEdit}
              disabled={disabled}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Изменить"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClear}
              disabled={disabled}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Удалить"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Render: input + dropdown ──────────────────────────────────────────────
  return (
    <>
      <div className="space-y-2" ref={dropdownRef}>
        {/* Input */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder="Введите адрес или место"
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
          />
          {searchState.kind === "searching" ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />
          ) : query ? (
            <button
              onClick={() => { setQuery(""); setSearchState({ kind: "idle" }); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        {/* Hint */}
        {searchState.kind === "idle" && !query && (
          <p className="text-xs text-neutral-400 px-1">
            Например: Парк Горького или Мястровская 5
          </p>
        )}

        {/* Dropdown results */}
        {searchState.kind === "results" && searchState.places.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
            {searchState.places.map((place) => (
              <button
                key={place.id}
                onClick={() => handlePlaceSelect(place)}
                className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-0"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-500">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{place.title}</p>
                  {place.address && (
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{place.address}</p>
                  )}
                </div>
                <span className="text-xs text-neutral-300 shrink-0">mamaGo</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {searchState.kind === "empty" && query.length >= 2 && (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-xs text-neutral-500">
              Место не найдено в каталоге — попробуйте выбрать через Google или{" "}
              <button
                onClick={() => setMapOpen(true)}
                className="text-neutral-700 underline underline-offset-2 hover:text-neutral-900 transition-colors"
              >
                укажите на карте
              </button>
            </p>
          </div>
        )}

        {/* Map pin link */}
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          disabled={disabled}
          className="text-xs text-neutral-500 hover:text-neutral-800 underline underline-offset-2 transition-colors disabled:opacity-40 px-1"
        >
          Указать точку на карте
        </button>
      </div>

      {/* Map modal — reuse existing PlaceMapModal */}
      <PlaceMapModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={(data) =>
          handleMapConfirm({
            lat: data.lat,
            lng: data.lng,
            formattedAddr: data.formattedAddr,
          })
        }
      />
    </>
  );
}
