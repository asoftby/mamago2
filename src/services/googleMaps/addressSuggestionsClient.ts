import { GoogleMapsService } from "@/services/googleMaps";
import { mapSuggestions, type AddressSuggestionView, type RawPlacePrediction } from "@/lib/address/addressSuggestions";
import type { NewAddressComponent } from "@/services/googleMaps/toLegacyAddressComponents";

/**
 * Адаптер Places API (New) для общего поля адреса: подсказки без виджета
 * PlaceAutocompleteElement (на мобильных он ломал ввод/клавиатуру).
 * Поиск по всему миру: без ограничения по стране, язык ru, регион BY.
 */

export type AddressSuggestionsSession = {
  token: google.maps.places.AutocompleteSessionToken | undefined;
  predictions: Map<string, google.maps.places.PlacePrediction>;
};

export type ResolvedAddressPlace = {
  googlePlaceId: string;
  displayName: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  addressComponents: NewAddressComponent[];
};

export function createAddressSuggestionsSession(): AddressSuggestionsSession {
  return { token: undefined, predictions: new Map() };
}

export async function fetchAddressSuggestions(
  session: AddressSuggestionsSession,
  input: string,
): Promise<AddressSuggestionView[]> {
  const placesLib = await GoogleMapsService.getPlacesLibrary();
  const fetchSuggestions = placesLib.AutocompleteSuggestion?.fetchAutocompleteSuggestions;
  if (!fetchSuggestions) throw new Error("Places AutocompleteSuggestion is unavailable");

  if (!session.token && placesLib.AutocompleteSessionToken) {
    session.token = new placesLib.AutocompleteSessionToken();
  }

  const { suggestions } = await fetchSuggestions({
    input,
    sessionToken: session.token,
    language: "ru",
    region: "by",
  });

  const predictions = suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction));

  const views = mapSuggestions(predictions as unknown as RawPlacePrediction[]);
  session.predictions.clear();
  for (const prediction of predictions) {
    if (prediction.placeId) session.predictions.set(prediction.placeId, prediction);
  }
  return views;
}

function readCoordinate(value: number | (() => number) | undefined): number | null {
  const resolved = typeof value === "function" ? value() : value;
  return typeof resolved === "number" && Number.isFinite(resolved) ? resolved : null;
}

/** Достаёт полные данные места по выбранной подсказке; null — если нет id/координат. */
export async function resolveAddressSuggestion(
  session: AddressSuggestionsSession,
  suggestionId: string,
): Promise<ResolvedAddressPlace | null> {
  const prediction = session.predictions.get(suggestionId);
  if (!prediction?.toPlace) return null;

  const place = prediction.toPlace();
  await place.fetchFields({
    fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
  });

  const location = place.location as { lat: number | (() => number); lng: number | (() => number) } | null | undefined;
  const lat = readCoordinate(location?.lat);
  const lng = readCoordinate(location?.lng);
  if (!place.id || lat === null || lng === null) return null;

  // Выбор завершает сессию биллинга: следующий поиск начинается с нового токена.
  session.token = undefined;
  session.predictions.clear();

  return {
    googlePlaceId: place.id,
    displayName: place.displayName ?? "",
    formattedAddress: place.formattedAddress ?? "",
    lat,
    lng,
    addressComponents: Array.isArray(place.addressComponents)
      ? (place.addressComponents as unknown as NewAddressComponent[])
      : [],
  };
}
