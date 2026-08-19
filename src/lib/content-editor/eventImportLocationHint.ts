/**
 * Подсказки локации из нормализованного импорта события (без server-only зависимостей).
 */
import { extractEventImportLocationFields } from "@/lib/event-import/extractEventImportLocationFields";

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

function sanitizeLocationField(
  value: string,
  options: { maxLength: number; maxWords: number },
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (/<\/?[a-z][^>]*>/i.test(normalized)) return "";
  if (normalized.length > options.maxLength) return "";

  const words = normalized.split(" ").filter(Boolean);
  if (words.length > options.maxWords) return "";

  return normalized;
}

export function parseEventImportLocationHint(raw: unknown): EventImportLocationHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.entityType === "string" && o.entityType !== "EVENT") return null;

  const extracted = extractEventImportLocationFields(o);
  const venueName = sanitizeLocationField(
    extracted.venueName ?? "",
    { maxLength: 120, maxWords: 12 },
  );
  const addressText = sanitizeLocationField(
    extracted.addressText ?? "",
    { maxLength: 180, maxWords: 18 },
  );
  const cityName = sanitizeLocationField(
    extracted.cityName ?? "",
    { maxLength: 80, maxWords: 4 },
  );

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
