/**
 * Подсказки локации из нормализованного импорта события (без server-only зависимостей).
 */

export type EventImportLocationHint = {
  venueName?: string;
  addressText?: string;
  cityName?: string;
};

/** URL картинок из импорта до загрузки в медиатеку (normalizedData события). */
export type EventImportMediaHint = {
  mainImageUrl: string | null;
  imageUrls: string[];
};

export function parseEventImportLocationHint(raw: unknown): EventImportLocationHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.entityType !== "EVENT") return null;

  const venueName = typeof o.venueName === "string" ? o.venueName.trim() : "";
  const addressText = typeof o.addressText === "string" ? o.addressText.trim() : "";
  const cityName = typeof o.cityName === "string" ? o.cityName.trim() : "";

  if (!venueName && !addressText && !cityName) return null;

  const hint: EventImportLocationHint = {};
  if (venueName) hint.venueName = venueName;
  if (addressText) hint.addressText = addressText;
  if (cityName) hint.cityName = cityName;
  return hint;
}

export function parseEventImportMediaHint(raw: unknown): EventImportMediaHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.entityType !== "EVENT") return null;

  const mainRaw = o.mainImageUrl;
  const mainExplicit =
    typeof mainRaw === "string" && mainRaw.trim().length > 0 ? mainRaw.trim() : null;

  const arr = o.imageUrls;
  const urls = Array.isArray(arr)
    ? arr
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim())
    : [];

  let mainImageUrl = mainExplicit;
  let imageUrls = mainImageUrl ? urls.filter((u) => u !== mainImageUrl) : [...urls];

  if (!mainImageUrl && imageUrls.length > 0) {
    mainImageUrl = imageUrls[0];
    imageUrls = imageUrls.slice(1);
  }

  if (!mainImageUrl && imageUrls.length === 0) return null;

  return { mainImageUrl, imageUrls };
}

export function buildImportLocationSearchQuery(hint: EventImportLocationHint): string {
  const parts: string[] = [];
  if (hint.venueName) parts.push(hint.venueName);
  if (hint.addressText) parts.push(hint.addressText);
  if (
    hint.cityName &&
    !parts.some((p) => p.toLowerCase().includes(hint.cityName!.toLowerCase()))
  ) {
    parts.push(hint.cityName);
  }
  return parts.join(", ");
}
