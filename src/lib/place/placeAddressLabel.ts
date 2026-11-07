import { extractStreetName } from "@/lib/slug/slugUtils";

/**
 * Подпись адреса места для админ-превью (редактор статьи / Breaking News).
 * Приоритет: человекочитаемый адрес → координаты → «Адрес не указан».
 *
 * Точка, выбранная на карте без Google Maps, сохраняется как `Координаты: <lat>, <lng>`,
 * а `shortAddress` из неё получался обрезанным «Координаты:». Такие значения — не адрес.
 */
export const PLACE_ADDRESS_MISSING_LABEL = "Адрес не указан";

const COORDINATE_PLACEHOLDER_RE = /^\s*координаты\s*:?\s*(?:-?\d+(?:[.,]\d+)?\s*[,;\s]?\s*){0,2}$/i;
const BARE_COORDINATES_RE = /^\s*-?\d+(?:[.,]\d+)?\s*[,;]\s*-?\d+(?:[.,]\d+)?\s*$/;

/** true — строка пустая или это заглушка с координатами, а не реальный адрес. */
export function isCoordinatePlaceholderAddress(value: string | null | undefined): boolean {
  const text = value?.trim();
  if (!text) return true;
  return COORDINATE_PLACEHOLDER_RE.test(text) || BARE_COORDINATES_RE.test(text);
}

function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export function resolvePlaceAddressLabel(input: {
  shortAddress?: string | null;
  formattedAddr?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  for (const candidate of [input.shortAddress, input.formattedAddr]) {
    if (!isCoordinatePlaceholderAddress(candidate)) return candidate!.trim();
  }
  const { lat, lng } = input;
  if (typeof lat === "number" && typeof lng === "number" && isValidCoordinate(lat, lng)) {
    // 5 знаков ≈ 1 м — достаточно для проверки точки, без ложной точности.
    return `Координаты: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  return PLACE_ADDRESS_MISSING_LABEL;
}

/**
 * Единая точка получения Place.shortAddress из адреса. Заглушка «Координаты: lat, lng»
 * (точка с карты без геокодера) — не адрес, улицу из неё не извлекаем.
 */
export function deriveShortAddress(address: string | null | undefined): string | null {
  if (isCoordinatePlaceholderAddress(address)) return null;
  return extractStreetName(address ?? "");
}
