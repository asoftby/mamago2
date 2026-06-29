export type EventImportLocationFields = {
  venueName?: string;
  addressText?: string;
  cityName?: string;
};

const VENUE_KEYS = ["venueName", "placeName", "venue", "location", "place"] as const;
const ADDRESS_KEYS = [
  "addressText",
  "placeAddress",
  "locationAddress",
  "address",
  "addressLine",
  "formattedAddress",
  "addr",
] as const;
const CITY_KEYS = ["cityName", "city", "town", "parsedCity"] as const;
const TEXT_KEYS = ["sourceText", "fullDescription", "description", "body", "text"] as const;

const ADDRESS_PREFIX_PATTERN =
  String.raw`(?:ул\.?|улица|пр-т|просп\.?|проспект|пер\.?|переулок|пл\.?|площадь|наб\.?|набережная|шоссе|б-р|бульвар)`;
const ADDRESS_PATTERN = String.raw`${ADDRESS_PREFIX_PATTERN}\s+[^\n.;:]{1,80}?\d[\dA-Za-zА-Яа-яЁё/-]*`;
const ADDRESS_REGEX = new RegExp(`(${ADDRESS_PATTERN})`, "iu");

function pickString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function normalizeSpaces(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddressCandidate(value: string): string {
  return normalizeSpaces(value)
    .replace(/^[,;\s:—–-]+/u, "")
    .replace(/[,;\s:—–-]+$/u, "")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractAddressFromText(text: string, venueName?: string): string {
  const cleanText = normalizeSpaces(text);
  if (!cleanText) return "";

  if (venueName) {
    const venuePattern = escapeRegExp(normalizeSpaces(venueName));
    const nearVenueRegex = new RegExp(
      `${venuePattern}\\s*[,;:—–-]?\\s*(${ADDRESS_PATTERN})`,
      "iu",
    );
    const nearVenueMatch = cleanText.match(nearVenueRegex);
    if (nearVenueMatch?.[1]) {
      return normalizeAddressCandidate(nearVenueMatch[1]);
    }
  }

  const genericMatch = cleanText.match(ADDRESS_REGEX);
  if (genericMatch?.[1]) {
    return normalizeAddressCandidate(genericMatch[1]);
  }

  return "";
}

function sanitizeDirectAddress(value: string, venueName?: string): string {
  const normalized = normalizeAddressCandidate(value);
  if (!normalized) return "";

  const derivedFromSelf = extractAddressFromText(normalized, venueName);
  if (derivedFromSelf) {
    return derivedFromSelf;
  }

  return normalized;
}

export function extractEventImportLocationFields(raw: unknown): EventImportLocationFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const venueName = normalizeSpaces(pickString(record, VENUE_KEYS));
  const directAddress = sanitizeDirectAddress(pickString(record, ADDRESS_KEYS), venueName);
  const cityName = normalizeSpaces(pickString(record, CITY_KEYS));

  if (directAddress) {
    return {
      ...(venueName ? { venueName } : {}),
      addressText: directAddress,
      ...(cityName ? { cityName } : {}),
    };
  }

  for (const key of TEXT_KEYS) {
    const text = record[key];
    if (typeof text !== "string" || text.trim().length === 0) continue;
    const derivedAddress = extractAddressFromText(text, venueName);
    if (derivedAddress) {
      return {
        ...(venueName ? { venueName } : {}),
        addressText: derivedAddress,
        ...(cityName ? { cityName } : {}),
      };
    }
  }

  return {
    ...(venueName ? { venueName } : {}),
    ...(cityName ? { cityName } : {}),
  };
}
