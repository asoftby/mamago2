"use client";

/**
 * RouteStopLocationInput
 *
 * Single smart input for route stop location resolution.
 * Resolution order (invisible to user):
 *   1. Search mamaGo Places DB
 *   2. Google Places Autocomplete (fallback, WORLDWIDE — no country restriction)
 *   3. Manual map pin (user-triggered)
 *
 * States:
 *   - empty:    input + hint + "Указать на карте" link
 *   - searching: input + loading indicator + dropdown
 *   - selected:  entity card + edit/clear actions
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { PlaceMapModal } from "@/components/business/place/PlaceMapModal";
import { GoogleMapsService } from "@/services/googleMaps";
import { toLegacyAddressComponents } from "@/services/googleMaps/toLegacyAddressComponents";
import {
  MapPin, Search, Building2, Navigation,
  X, Pencil, Loader2, CheckCircle2, Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RouteStopSource = "PLACE" | "GOOGLE" | "MANUAL_PIN";

/** Address component parsed from Google address_components */
export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

/** Normalised detected location info extracted from Google address_components */
export type DetectedLocation = {
  detectedCountryCode?: string;
  detectedCountryName?: string;
  detectedCityName?: string;
  detectedRegionName?: string;
};

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
  /** Full formatted_address from Google (always set for GOOGLE source) */
  formattedAddress?: string;
  cityId?: string;
  cityName?: string;
  lat?: number;
  lng?: number;
  /** Google address_components — raw array for server-side city resolution */
  addressComponents?: GoogleAddressComponent[];
  /** Raw Google Place payload for future enrichment */
  rawGooglePayload?: Record<string, unknown>;
} & DetectedLocation;

type PlaceResult = {
  id: string;
  title: string;
  address: string;
  cityId: string | null;
  cityName: string | null;
  lat: number | null;
  lng: number | null;
};

/** Lightweight preview of a Google Places (New) autocomplete suggestion — full details are only fetched on selection */
type GooglePrediction = {
  id: string;
  primaryText: string;
  secondaryText: string;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: PlaceResult[]; google: GooglePrediction[] }
  | { kind: "empty" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract city, region, country from Google address_components.
 */
function parseAddressComponents(
  components: GoogleAddressComponent[],
): {
  detectedCityName: string | undefined;
  detectedRegionName: string | undefined;
  detectedCountryCode: string | undefined;
  detectedCountryName: string | undefined;
} {
  let cityName: string | undefined;
  let regionName: string | undefined;
  let countryCode: string | undefined;
  let countryName: string | undefined;

  for (const comp of components) {
    const types = comp.types ?? [];
    if (types.includes("locality") || types.includes("postal_town")) {
      cityName = comp.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      regionName = comp.long_name;
    } else if (types.includes("country")) {
      countryCode = comp.short_name;
      countryName = comp.long_name;
    }
  }

  return { detectedCityName: cityName, detectedRegionName: regionName, detectedCountryCode: countryCode, detectedCountryName: countryName };
}

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
  const [isEditing, setIsEditing] = useState(() => !value);
  /** Скрытое предупреждение для адресов вне активных городов mamaGo */
  const [outsideCityWarning, setOutsideCityWarning] = useState<string | null>(null);
  const [isResolvingGoogleSelection, setIsResolvingGoogleSelection] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef(value);
  const googlePredictionsRef = useRef<Map<string, google.maps.places.PlacePrediction>>(new Map());
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Sync isEditing when value is set externally (e.g. parent state restore)
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (!prev && value) {
      queueMicrotask(() => setIsEditing(false));
    }
    if (prev && !value) {
      queueMicrotask(() => setIsEditing(true));
    }
  }, [value]);

  // Always-current ref for onChange — prevents stale closure in autocomplete listener
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const getSessionToken = useCallback(
    async (): Promise<google.maps.places.AutocompleteSessionToken | undefined> => {
      if (sessionTokenRef.current) return sessionTokenRef.current;
      try {
        const placesLib = await GoogleMapsService.getPlacesLibrary();
        const AutocompleteSessionToken = placesLib.AutocompleteSessionToken;
        if (!AutocompleteSessionToken) return undefined;
        const token = new AutocompleteSessionToken();
        sessionTokenRef.current = token;
        return token;
      } catch {
        return undefined;
      }
    },
    [],
  );

  // ── Google Autocomplete (New Places API, WORLDWIDE — no country restriction) ──
  const searchGoogle = useCallback(async (q: string): Promise<GooglePrediction[]> => {
    try {
      const placesLib = await GoogleMapsService.getPlacesLibrary();
      const fetchAutocompleteSuggestions = placesLib.AutocompleteSuggestion?.fetchAutocompleteSuggestions;
      if (!fetchAutocompleteSuggestions) return [];

      const sessionToken = await getSessionToken();
      const { suggestions } = await fetchAutocompleteSuggestions({ input: q, sessionToken });

      googlePredictionsRef.current.clear();
      const predictions: GooglePrediction[] = [];

      for (const suggestion of suggestions) {
        const prediction = suggestion.placePrediction;
        const placeId = prediction?.placeId;
        if (!prediction || !placeId) continue;

        googlePredictionsRef.current.set(placeId, prediction);
        predictions.push({
          id: placeId,
          primaryText: prediction.mainText?.text || prediction.text?.text || "",
          secondaryText: prediction.secondaryText?.text || "",
        });
      }

      return predictions;
    } catch (err) {
      console.error("[RouteStopLocationInput] Google autocomplete error:", err);
      return [];
    }
  }, [getSessionToken]);

  const handleGoogleSelect = useCallback(async (predictionId: string) => {
    const prediction = googlePredictionsRef.current.get(predictionId);
    if (!prediction?.toPlace) return;

    setIsResolvingGoogleSelection(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
      });

      const lat = place.location?.lat() ?? null;
      const lng = place.location?.lng() ?? null;
      if (!place.id || lat === null || lng === null) return;

      const cleanComponents = toLegacyAddressComponents(place.addressComponents);
      const parsed = parseAddressComponents(cleanComponents);

      const result: RouteStopLocationValue = {
        source: "GOOGLE",
        googlePlaceId: place.id,
        title: place.displayName || place.formattedAddress || "",
        address: place.formattedAddress || "",
        formattedAddress: place.formattedAddress || "",
        lat,
        lng,
        addressComponents: cleanComponents,
        ...parsed,
      };

      const isBelarusCity = parsed.detectedCountryCode?.toUpperCase() === "BY";
      if (!isBelarusCity && parsed.detectedCityName) {
        setOutsideCityWarning(
          `Адрес вне активных городов mamaGo. Точка будет сохранена, но маршрут не попадёт в публичную городскую выдачу, пока город не будет подключён.`,
        );
      } else {
        setOutsideCityWarning(null);
      }

      // Start a fresh billing session for the next search
      sessionTokenRef.current = null;

      onChangeRef.current(result);
      setIsEditing(false);
      setSearchState({ kind: "idle" });
      setQuery("");
    } catch (err) {
      console.error("[RouteStopLocationInput] Google place fetch error:", err);
    } finally {
      setIsResolvingGoogleSelection(false);
    }
  }, []);

  // ── Debounced mamaGo place search + Google suggestions ────────────────────
  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchState({ kind: "idle" });
      return;
    }

    setSearchState({ kind: "searching" });

    try {
      const [placesRes, googlePredictions] = await Promise.all([
        fetch(`/api/routes/stops/search?q=${encodeURIComponent(q)}`),
        searchGoogle(q),
      ]);
      const data = await placesRes.json();
      const places: PlaceResult[] = data.results ?? [];

      if (places.length === 0 && googlePredictions.length === 0) {
        setSearchState({ kind: "empty" });
        return;
      }

      setSearchState({
        kind: "results",
        places,
        google: googlePredictions,
      });
    } catch {
      setSearchState({ kind: "empty" });
    }
  }, [searchGoogle]);

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
    setOutsideCityWarning(null);
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
    setOutsideCityWarning(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = () => {
    onChange(null);
    setIsEditing(true);
    setQuery("");
    setSearchState({ kind: "idle" });
    setOutsideCityWarning(null);
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

    // Check if this is a non-Belarus address for soft warning
    const isOutsideMamaGo =
      value.detectedCountryCode &&
      value.detectedCountryCode.toUpperCase() !== "BY";

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
              {value.detectedCountryCode && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-xs text-neutral-400">{value.detectedCountryCode}</span>
                </>
              )}
              {value.cityName && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-xs text-neutral-400">{value.cityName}</span>
                </>
              )}
            </div>
            {/* Soft warning for addresses outside active mamaGo cities */}
            {isOutsideMamaGo && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <Globe className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Адрес находится вне активных городов mamaGo. Точка будет сохранена, но маршрут не попадёт в публичную городскую выдачу, пока город не будет подключён.
                </p>
              </div>
            )}
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
        {outsideCityWarning && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <Globe className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">{outsideCityWarning}</p>
          </div>
        )}
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
            disabled={disabled || isResolvingGoogleSelection}
            placeholder="Введите адрес или место"
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all"
          />
          {searchState.kind === "searching" || isResolvingGoogleSelection ? (
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
        {searchState.kind === "results" && (searchState.places.length > 0 || searchState.google.length > 0) && (
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
            {searchState.google.map((prediction) => (
              <button
                key={prediction.id}
                onClick={() => handleGoogleSelect(prediction.id)}
                disabled={isResolvingGoogleSelection}
                className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-100 last:border-0 disabled:opacity-50"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 text-neutral-500">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{prediction.primaryText}</p>
                  {prediction.secondaryText && (
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{prediction.secondaryText}</p>
                  )}
                </div>
                <span className="text-xs text-neutral-300 shrink-0">Google</span>
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
