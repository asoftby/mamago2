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

type PlacesLib = Awaited<ReturnType<typeof GoogleMapsService.getPlacesLibrary>>;

export async function fetchAddressSuggestions(
  session: AddressSuggestionsSession,
  input: string,
  // Внедряется только в тестах (без ключа Google); в приложении всегда настоящая библиотека.
  loadPlaces: () => Promise<PlacesLib> = () => GoogleMapsService.getPlacesLibrary(),
): Promise<AddressSuggestionView[]> {
  const placesLib = await loadPlaces();
  const suggestionApi = placesLib.AutocompleteSuggestion;
  if (!suggestionApi?.fetchAutocompleteSuggestions) throw new Error("Places AutocompleteSuggestion is unavailable");

  if (!session.token && placesLib.AutocompleteSessionToken) {
    session.token = new placesLib.AutocompleteSessionToken();
  }

  // Вызываем как метод класса (как в документации Google), а не «оторванной» функцией.
  const { suggestions } = await suggestionApi.fetchAutocompleteSuggestions({
    input,
    sessionToken: session.token,
    language: "ru",
    region: "by",
  });

  const predictions = suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction));

  const views = mapSuggestions(predictions as unknown as RawPlacePrediction[]);
  // Карту только дополняем и никогда не очищаем здесь: ответы приходят не по порядку, и
  // устаревший ответ (UI его отбросит) не должен стереть подсказки, которые пользователь видит.
  // Очищается карта при завершении сессии выбором (resolveAddressSuggestion).
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

  // Подпись берём из подсказки (бесплатно): displayName относится к более дорогому
  // уровню Place Details Pro и для адреса не нужен.
  const displayName = prediction.mainText?.text ?? prediction.text?.text ?? "";

  const place = prediction.toPlace();
  try {
    // Только поля уровня Essentials. sessionToken сюда не передаётся: сессия подхватывается
    // из подсказки, а вызов fetchFields() её завершает.
    await place.fetchFields({ fields: ["id", "formattedAddress", "location", "addressComponents"] });
  } finally {
    // Сессия завершена при любом исходе fetchFields: токен использовать повторно нельзя
    // (иначе каждый следующий запрос тарифицируется отдельно). Следующий поиск — с новым токеном.
    session.token = undefined;
  }

  const location = place.location as { lat: number | (() => number); lng: number | (() => number) } | null | undefined;
  const lat = readCoordinate(location?.lat);
  const lng = readCoordinate(location?.lng);
  if (!place.id || lat === null || lng === null) return null;

  session.predictions.clear();

  return {
    googlePlaceId: place.id,
    displayName,
    formattedAddress: place.formattedAddress ?? "",
    lat,
    lng,
    addressComponents: Array.isArray(place.addressComponents)
      ? (place.addressComponents as unknown as NewAddressComponent[])
      : [],
  };
}
