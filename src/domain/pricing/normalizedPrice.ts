export const PUBLICATION_PRICE_MODES = ["FREE", "EXACT", "FROM", "RANGE", "NONE", "UNKNOWN"] as const;

export type PublicationPriceMode = (typeof PUBLICATION_PRICE_MODES)[number];

export type NormalizedPriceRange = {
  min: number | null;
  max: number | null;
  currency: "BYN";
  mode: PublicationPriceMode;
};

export type PriceNormalizationResult = NormalizedPriceRange & {
  source: "STRUCTURED" | "NUMERIC" | "TEXT" | "NONE";
  conflict: string | null;
};

function finiteNonNegative(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function extractStructuredPriceValues(raw: unknown): number[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  return source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const price = finiteNonNegative((item as { price?: unknown }).price);
    return price == null ? [] : [price];
  });
}

function result(
  mode: PublicationPriceMode,
  min: number | null,
  max: number | null,
  source: PriceNormalizationResult["source"],
  conflict: string | null = null,
): PriceNormalizationResult {
  return { mode, min, max, currency: "BYN", source, conflict };
}

export function parseSafeLegacyPriceText(value: unknown): PriceNormalizationResult {
  if (typeof value !== "string") return result("UNKNOWN", null, null, "NONE");
  const text = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return result("UNKNOWN", null, null, "NONE");
  if (/^(бесплатно|free)[.!]?$/.test(text)) return result("FREE", 0, 0, "TEXT");

  const currency = "(?:byn|br|б|руб(?:\\.|ля|лей)?|р\\.?)";
  const number = "(\\d+(?:[.,]\\d{1,2})?)";
  let match = text.match(new RegExp(`^от\\s+${number}\\s*${currency}[.!]?$`, "i"));
  if (match) return result("FROM", finiteNonNegative(match[1]), null, "TEXT");
  match = text.match(new RegExp(`^${number}\\s*[–—-]\\s*${number}\\s*${currency}[.!]?$`, "i"));
  if (match) {
    const min = finiteNonNegative(match[1]);
    const max = finiteNonNegative(match[2]);
    if (min != null && max != null && max >= min) return result("RANGE", min, max, "TEXT");
    return result("UNKNOWN", null, null, "TEXT", "invalid-range");
  }
  match = text.match(new RegExp(`^${number}\\s*${currency}[.!]?$`, "i"));
  if (match) {
    const price = finiteNonNegative(match[1]);
    return price == null ? result("UNKNOWN", null, null, "TEXT") : result("EXACT", price, price, "TEXT");
  }
  return result("UNKNOWN", null, null, "TEXT");
}

export function normalizePublicationPrice(input: {
  mode?: PublicationPriceMode | "free" | "fixed" | "from" | "single" | "multiple" | "none" | null;
  min?: unknown;
  max?: unknown;
  priceItems?: unknown;
  priceText?: unknown;
}): PriceNormalizationResult {
  const rawMode = typeof input.mode === "string" ? input.mode.toUpperCase() : "";

  // Explicit semantic modes are authoritative. A user switching a publication
  // to FREE/NONE must not be overridden by stale tariff rows left in priceItems.
  if (rawMode === "NONE") return result("NONE", null, null, "NONE");
  if (rawMode === "FREE") return result("FREE", 0, 0, "NUMERIC");

  const values = extractStructuredPriceValues(input.priceItems);
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === 0 && max === 0) return result("FREE", 0, 0, "STRUCTURED");
    return result(values.length === 1 ? "EXACT" : "RANGE", min, max, "STRUCTURED");
  }

  const min = finiteNonNegative(input.min);
  const max = finiteNonNegative(input.max);
  if (min != null && max != null && max < min) {
    return result("UNKNOWN", null, null, "NUMERIC", "max-less-than-min");
  }
  if ((rawMode === "EXACT" || rawMode === "FIXED" || rawMode === "SINGLE") && min != null) {
    if (min === 0) return result("FREE", 0, 0, "NUMERIC");
    return result("EXACT", min, min, "NUMERIC");
  }
  if (rawMode === "FROM" && min != null) return result("FROM", min, null, "NUMERIC");
  if ((rawMode === "RANGE" || rawMode === "MULTIPLE") && min != null && max != null) {
    return result("RANGE", min, max, "NUMERIC");
  }
  if (rawMode === "UNKNOWN") return result("UNKNOWN", null, null, "NONE");
  if (min != null && max != null) {
    if (min === 0 && max === 0) return result("FREE", 0, 0, "NUMERIC");
    return result(min === max ? "EXACT" : "RANGE", min, max, "NUMERIC");
  }
  if (min != null) return result("FROM", min, null, "NUMERIC");
  return parseSafeLegacyPriceText(input.priceText);
}
