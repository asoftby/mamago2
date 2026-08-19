/** Parsed evidence from Event `location` postmeta — plain text or the JSON-object shape Voxel sometimes stores (`{"address":...,"latitude":...,"longitude":...}`). */
export interface ParsedEventLocation {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ParseEventLocationRawResult {
  /** `null` when there's nothing usable at all (blank input, or JSON-shaped input with no valid address/coordinates). */
  location: ParsedEventLocation | null;
  /** `true` only when the input looked like a JSON object but couldn't be parsed into one — never set for plain text, even if some individual field inside a real JSON object turned out unusable. */
  invalidJsonLike: boolean;
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * `candidate.locationRaw` (WordPress `location` postmeta) is either plain
 * text or a JSON-object string. Never returns the raw JSON text as an
 * `address` — that would land a `{"address":...}` blob directly in
 * `EventVenue.addressLine`, which is exactly the bug this parser exists to
 * prevent. `(0, 0)` coordinates are treated as absent, not a real point —
 * the same convention this repo already uses for "no evidence" over "fake
 * evidence". Never throws.
 */
export function parseEventLocationRaw(raw: string | null | undefined): ParseEventLocationRawResult {
  if (raw === null || raw === undefined) {
    return { location: null, invalidJsonLike: false };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { location: null, invalidJsonLike: false };
  }

  if (!trimmed.startsWith("{")) {
    return { location: { address: trimmed, lat: null, lng: null }, invalidJsonLike: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { location: null, invalidJsonLike: true };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { location: null, invalidJsonLike: true };
  }

  const obj = parsed as Record<string, unknown>;
  const address = typeof obj.address === "string" && obj.address.trim() ? obj.address.trim() : null;

  const latRaw = obj.latitude;
  const lngRaw = obj.longitude;
  const hasValidPair =
    isValidCoordinate(latRaw, -90, 90) && isValidCoordinate(lngRaw, 180 * -1, 180) && !(latRaw === 0 && lngRaw === 0);
  const lat = hasValidPair ? (latRaw as number) : null;
  const lng = hasValidPair ? (lngRaw as number) : null;

  if (address === null && lat === null && lng === null) {
    return { location: null, invalidJsonLike: false };
  }

  return { location: { address, lat, lng }, invalidJsonLike: false };
}
