/**
 * Place Normalizer
 * raw payload → NormalizedPlaceImport
 *
 * Phase 2A: field extraction из rawPayload.
 * Не делает маппинг category → Place.category (Phase 3).
 * Не делает publish (Phase 3).
 */

import type { NormalizedPlaceImport } from "../types";
import { extractSocialUrlsFromRawPayload } from "./extract-social-urls";

type RawPayload = Record<string, unknown>;

// ─── Field extractors ─────────────────────────────────────────────────────────

function extractString(raw: RawPayload, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = raw[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return undefined;
}

function extractStringArray(raw: RawPayload, ...keys: string[]): string[] {
  for (const key of keys) {
    const val = raw[key];
    if (Array.isArray(val)) {
      return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    }
  }
  return [];
}

function extractNumber(raw: RawPayload, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const val = raw[key];
    if (typeof val === "number" && isFinite(val)) return val;
    if (typeof val === "string") {
      const n = parseFloat(val);
      if (isFinite(n)) return n;
    }
  }
  return undefined;
}

/**
 * Derive shortDescCandidate из description (первые 200 символов, обрезка по слову).
 */
function deriveShortDesc(description: string): string {
  if (description.length <= 200) return description;
  const truncated = description.slice(0, 200);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated).trimEnd() + "…";
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

export interface NormalizerInput {
  rawPayload: RawPayload;
  sourceSlug: string;
  sourceUrl: string;
  externalId?: string | null;
  sourceUpdatedAt?: Date;
}

export interface NormalizerOutput {
  normalized: NormalizedPlaceImport;
  /** Предупреждения (не фатальные) */
  warnings: string[];
}

export function normalizePlacePayload(input: NormalizerInput): NormalizerOutput {
  const { rawPayload, sourceSlug, sourceUrl, externalId, sourceUpdatedAt } = input;
  const warnings: string[] = [];

  const title = extractString(rawPayload, "name", "title");
  if (!title) warnings.push("title missing");

  const description = extractString(rawPayload, "description", "fullDescription", "body");
  const shortDescRaw = extractString(rawPayload, "shortDescription", "shortDesc", "excerpt", "summary");

  // shortDescCandidate: явное поле или derive из description
  let shortDescCandidate: string | undefined;
  if (shortDescRaw) {
    shortDescCandidate = shortDescRaw.length <= 200 ? shortDescRaw : deriveShortDesc(shortDescRaw);
  } else if (description) {
    shortDescCandidate = deriveShortDesc(description);
    warnings.push("shortDescCandidate derived from description");
  } else {
    warnings.push("shortDescCandidate missing — no description to derive from");
  }

  const categoryCandidates = extractStringArray(rawPayload, "categories", "tags", "types", "category");
  if (categoryCandidates.length === 0) warnings.push("categoryCandidates empty");

  const addressText = extractString(rawPayload, "address", "addressLine", "formattedAddress", "addr");
  if (!addressText) warnings.push("address missing");

  const cityName = extractString(rawPayload, "city", "cityName", "town");
  if (!cityName) warnings.push("city missing");

  const lat = extractNumber(rawPayload, "lat", "latitude");
  const lng = extractNumber(rawPayload, "lng", "lon", "longitude");
  if (!lat || !lng) warnings.push("coords missing");

  // phones: поддержка строки и массива
  const phonesRaw = rawPayload["phone"] ?? rawPayload["phones"] ?? rawPayload["tel"];
  const phones: string[] = Array.isArray(phonesRaw)
    ? phonesRaw.filter((v): v is string => typeof v === "string")
    : typeof phonesRaw === "string" && phonesRaw.trim()
      ? [phonesRaw.trim()]
      : [];

  // websites: поддержка строки и массива
  const websitesRaw = rawPayload["website"] ?? rawPayload["websites"] ?? rawPayload["url"];
  const websites: string[] = Array.isArray(websitesRaw)
    ? websitesRaw.filter((v): v is string => typeof v === "string")
    : typeof websitesRaw === "string" && websitesRaw.trim()
      ? [websitesRaw.trim()]
      : [];

  const imageUrls = extractStringArray(rawPayload, "images", "imageUrls", "photos", "gallery");

  const openingHoursText = extractString(rawPayload, "openingHours", "workingHours", "hours", "schedule");

  const socialUrls = extractSocialUrlsFromRawPayload(rawPayload);

  const normalized: NormalizedPlaceImport = {
    entityType: "PLACE",
    sourceSlug,
    sourceUrl,
    externalId: externalId ?? null,
    sourceUpdatedAt,
    title,
    categoryCandidates,
    shortDescCandidate,
    description,
    addressText,
    cityName,
    lat,
    lng,
    phones,
    websites,
    imageUrls,
    openingHoursText,
    ...(socialUrls.length > 0 ? { socialUrls } : {}),
  };

  return { normalized, warnings };
}
