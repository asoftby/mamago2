/**
 * Place Field Mapper
 * NormalizedPlaceImport → Prisma Place create/update data
 *
 * Controlled mapping — только явные поля, без destructive overwrite.
 * Обязательные поля Place: title, category, shortDesc, createdByUserId.
 */

import type { NormalizedPlaceImport } from "../types";
import { resolveAllowedCategory } from "./category-mapping";

// ── Phone normalization ───────────────────────────────────────────────────────

/**
 * Простая нормализация телефона: убрать лишние символы, привести к +375XXXXXXXXX.
 * Не требует отдельной infra — best-effort.
 */
export function normalizePhoneSimple(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("375") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("80") && digits.length === 11) return `+375${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 11) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return raw.replace(/[^\d+\-() ]/g, "").trim();
}

// ── ShortDesc derive ──────────────────────────────────────────────────────────

const SHORT_DESC_MAX = 200;

export function resolveShortDesc(nd: NormalizedPlaceImport): string | null {
  if (nd.shortDescCandidate?.trim()) {
    const s = nd.shortDescCandidate.trim();
    return s.length <= SHORT_DESC_MAX ? s : s.slice(0, SHORT_DESC_MAX - 1).trimEnd() + "…";
  }
  if (nd.description?.trim()) {
    const d = nd.description.trim();
    if (d.length <= SHORT_DESC_MAX) return d;
    const truncated = d.slice(0, SHORT_DESC_MAX);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd() + "…";
  }
  return null;
}

// ── Category resolution ───────────────────────────────────────────────────────

/**
 * Выбрать category из categoryCandidates через whitelist + alias map.
 * Произвольные source strings не проходят — только явно допустимые значения.
 * Возвращает null если ни один кандидат не маппится.
 */
export function resolveCategory(nd: NormalizedPlaceImport): string | null {
  return resolveAllowedCategory(nd.categoryCandidates);
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface MappedPlaceFields {
  title: string;
  shortDesc: string;
  category: string;
  description?: string;
  formattedAddr?: string;
  customAddress?: string;
  cityName?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  // imageUrls не маппятся — media ingestion Phase 4
}

export interface MappingResult {
  fields: MappedPlaceFields;
  warnings: string[];
}

export interface MappingFailure {
  error: string;
}

export function mapNormalizedToPlace(
  nd: NormalizedPlaceImport,
): MappingResult | MappingFailure {
  const warnings: string[] = [];

  if (!nd.title?.trim()) {
    return { error: "title is required but missing in normalizedData" };
  }
  const title = nd.title.trim();

  const shortDesc = resolveShortDesc(nd);
  if (!shortDesc) {
    return { error: "shortDesc is required but could not be derived (no shortDescCandidate or description)" };
  }

  const category = resolveCategory(nd);
  if (!category) {
    return {
      error: `category mapping failed: none of [${nd.categoryCandidates.join(", ")}] match allowed Place categories`,
    };
  }

  const phone = nd.phones[0] ? normalizePhoneSimple(nd.phones[0]) : undefined;
  const website = nd.websites[0] ?? undefined;
  const formattedAddr = nd.addressText?.trim() || undefined;
  const customAddress = !formattedAddr && nd.addressText ? nd.addressText.trim() : undefined;

  if (!formattedAddr && !customAddress) warnings.push("address not mapped");
  if (!nd.cityName) warnings.push("cityName missing — cityId will be null");

  return {
    fields: {
      title,
      shortDesc,
      category,
      description: nd.description?.trim() || undefined,
      formattedAddr,
      customAddress,
      cityName: nd.cityName?.trim() || undefined,
      lat: nd.lat,
      lng: nd.lng,
      phone,
      website,
    },
    warnings,
  };
}

// ── Non-destructive update filter ─────────────────────────────────────────────

/**
 * Для UPDATE: вернуть только поля с непустым новым значением.
 *
 * Title policy (safer):
 *   - обновляется только если existing title пустой
 *   - или если ImportFieldOverride явно разрешает (PREFER_IMPORT) — проверяется в caller
 *   - иначе title попадает в skippedFields
 *
 * Остальные поля: не перезаписывают непустые существующие значения,
 * кроме description (обновляется если новое длиннее).
 */
export function filterNonDestructiveUpdates(
  mapped: MappedPlaceFields,
  existing: Record<string, unknown>,
  titleOverrideAllowed = false,
): { updates: Partial<MappedPlaceFields>; titleSkipped: boolean } {
  const result: Partial<MappedPlaceFields> = {};
  let titleSkipped = false;

  const updatableFields: (keyof MappedPlaceFields)[] = [
    "title", "shortDesc", "category", "description",
    "formattedAddr", "customAddress", "lat", "lng",
    "phone", "website",
  ];

  for (const field of updatableFields) {
    const newVal = mapped[field];
    const existingVal = existing[field];

    if (newVal === undefined || newVal === null || newVal === "") continue;

    if (field === "title") {
      const existingEmpty = !existingVal || String(existingVal).trim().length === 0;
      if (existingEmpty || titleOverrideAllowed) {
        result.title = mapped.title;
      } else {
        titleSkipped = true;
      }
      continue;
    }

    if (existingVal && String(existingVal).trim().length > 0) {
      if (field === "description") {
        const newLen = String(newVal).length;
        const existLen = String(existingVal).length;
        if (newLen <= existLen) continue;
      } else if (["formattedAddr", "customAddress", "phone", "website"].includes(field)) {
        continue;
      }
    }

    (result as Record<string, unknown>)[field] = newVal;
  }

  return { updates: result, titleSkipped };
}
