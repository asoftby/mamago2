
/**
 * Event Field Mapper
 * NormalizedEventImport → Activity create/update data
 *
 * Controlled mapping — только явные поля, без destructive overwrite.
 * Обязательные поля Activity: title, shortDesc, type, scheduleMode, ownerUserId.
 */

import type { NormalizedEventImport } from "../types";
import { detectAgeBuckets, getAgeRangeFromBuckets } from "@/lib/age/ageMapping";

// ── ActivityType whitelist ────────────────────────────────────────────────────

const ACTIVITY_TYPE_VALUES = ["EVENT", "PERMANENT", "COURSE", "ROUTE", "OFFER"] as const;
type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];

const TYPE_ALIAS_MAP: Record<string, ActivityType> = {
  "МЕРОПРИЯТИЕ":   "EVENT",
  "СОБЫТИЕ":       "EVENT",
  "WORKSHOP":      "EVENT",
  "МАСТЕР-КЛАСС":  "EVENT",
  "MASTERCLASS":   "EVENT",
  "КОНЦЕРТ":       "EVENT",
  "СПЕКТАКЛЬ":     "EVENT",
  "ВЫСТАВКА":      "EVENT",
  "КУРС":          "COURSE",
  "ЗАНЯТИЕ":       "COURSE",
  "ТРЕНИНГ":       "COURSE",
  "ОБУЧЕНИЕ":      "COURSE",
  "ПОСТОЯННОЕ":    "PERMANENT",
  "PERMANENT":     "PERMANENT",
};

export function resolveActivityType(candidate: string | undefined): ActivityType | null {
  if (!candidate) return null;
  const upper = candidate.toUpperCase().trim();
  if ((ACTIVITY_TYPE_VALUES as readonly string[]).includes(upper)) return upper as ActivityType;
  return TYPE_ALIAS_MAP[upper] ?? null;
}

// ── ScheduleMode whitelist ────────────────────────────────────────────────────

const SCHEDULE_MODE_VALUES = ["ONE_TIME", "MULTI_DATE", "RECURRING", "ON_DEMAND", "ALWAYS"] as const;
type ScheduleMode = (typeof SCHEDULE_MODE_VALUES)[number];

const SCHEDULE_ALIAS_MAP: Record<string, ScheduleMode> = {
  "ONCE":          "ONE_TIME",
  "SINGLE":        "ONE_TIME",
  "РАЗОВОЕ":       "ONE_TIME",
  "ОДНОКРАТНО":    "ONE_TIME",
  "WEEKLY":        "RECURRING",
  "DAILY":         "RECURRING",
  "ЕЖЕНЕДЕЛЬНО":   "RECURRING",
  "ЕЖЕДНЕВНО":     "RECURRING",
  "РЕГУЛЯРНО":     "RECURRING",
  "MULTIPLE":      "MULTI_DATE",
  "НЕСКОЛЬКО":     "MULTI_DATE",
  "MULTI":         "MULTI_DATE",
  "BY_REQUEST":    "ON_DEMAND",
  "ПО_ЗАПРОСУ":    "ON_DEMAND",
  "ALWAYS_OPEN":   "ALWAYS",
  "ПОСТОЯННО":     "ALWAYS",
};

export function resolveScheduleMode(candidate: string | undefined): ScheduleMode | null {
  if (!candidate) return null;
  const upper = candidate.toUpperCase().trim();
  if ((SCHEDULE_MODE_VALUES as readonly string[]).includes(upper)) return upper as ScheduleMode;
  return SCHEDULE_ALIAS_MAP[upper] ?? null;
}

// ── ShortDesc ─────────────────────────────────────────────────────────────────

const SHORT_DESC_MAX = 200;

export function resolveEventShortDesc(nd: NormalizedEventImport): string | null {
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

// ── Price parsing ─────────────────────────────────────────────────────────────

/**
 * Best-effort parse priceText → { priceFrom, priceTo }.
 * "25 BYN" → { from: 25, to: null }
 * "20-50 BYN" → { from: 20, to: 50 }
 * "бесплатно" → { from: 0, to: 0 }
 * Если не парсится — возвращает null (не fail apply).
 */
export function parsePriceText(priceText: string): { priceFrom: number | null; priceTo: number | null } | null {
  const t = priceText.toLowerCase().trim();

  if (t.includes("бесплатно") || t.includes("free") || t === "0") {
    return { priceFrom: 0, priceTo: 0 };
  }

  // "X-Y" диапазон
  const rangeMatch = t.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (rangeMatch) {
    return {
      priceFrom: parseFloat(rangeMatch[1].replace(",", ".")),
      priceTo: parseFloat(rangeMatch[2].replace(",", ".")),
    };
  }

  // Одно число
  const singleMatch = t.match(/(\d+(?:[.,]\d+)?)/);
  if (singleMatch) {
    return { priceFrom: parseFloat(singleMatch[1].replace(",", ".")), priceTo: null };
  }

  return null;
}

// ── scheduleJson minimal ──────────────────────────────────────────────────────

/**
 * Построить минимальный scheduleJson из startAt/endAt.
 * Не строит сложную occurrence engine — только базовую структуру.
 * Если нет дат — возвращает null.
 */
export function buildMinimalScheduleJson(
  startAt: string | undefined,
  endAt: string | undefined,
  scheduleText: string | undefined,
  occurrenceLines?: string[] | undefined,
): object | null {
  if (!startAt && !scheduleText) return null;

  const result: Record<string, unknown> = { _importSource: true };

  if (startAt) {
    const d = new Date(startAt);
    if (!isNaN(d.getTime())) {
      result.startAt = d.toISOString();
    } else {
      result.startAtRaw = startAt;
    }
  }

  if (endAt) {
    const d = new Date(endAt);
    if (!isNaN(d.getTime())) {
      result.endAt = d.toISOString();
    } else {
      result.endAtRaw = endAt;
    }
  }

  if (scheduleText) result.scheduleText = scheduleText;
  if (occurrenceLines && occurrenceLines.length > 0) result.occurrenceLines = occurrenceLines;

  return result;
}

// ── Main mapped fields ────────────────────────────────────────────────────────

export interface MappedActivityFields {
  title: string;
  shortDesc: string;
  type: ActivityType;
  scheduleMode: ScheduleMode;
  description?: string;
  cityId?: string | null;
  priceText?: string;
  priceFrom?: number;
  priceTo?: number;
  ageTags?: string[];
  ageMinMonths?: number;
  ageMaxMonths?: number;
  scheduleJson?: object;
  nextOccurrenceAt?: Date;
  /**
   * Денормализованный URL постера (https), пока нет ActivityImage / MediaAsset.
   * См. resolveActivityCoverUrl — канонично для карточек и ленты.
   */
  coverImageUrl?: string;
}

/** Первый подходящий URL постера из импорта (внешний CDN до ingestion в медиатеку). */
export function pickImportEventPosterUrl(nd: {
  mainImageUrl?: string;
  imageUrls: string[];
}): string | undefined {
  const raw = [nd.mainImageUrl, ...nd.imageUrls]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
  for (const u of raw) {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("//")) return `https:${u}`;
  }
  return undefined;
}

export interface EventMappingResult {
  fields: MappedActivityFields;
  warnings: string[];
}

export interface EventMappingFailure {
  error: string;
}

export async function mapNormalizedToActivity(
  nd: NormalizedEventImport,
  cityId: string | null,
): Promise<EventMappingResult | EventMappingFailure> {
  const warnings: string[] = [];

  // ── Обязательные ────────────────────────────────────────────────────────
  if (!nd.title?.trim()) {
    return { error: "title is required but missing in normalizedData" };
  }
  const title = nd.title.trim();

  const shortDesc = resolveEventShortDesc(nd);
  if (!shortDesc) {
    return { error: "shortDesc is required but could not be derived (no shortDescCandidate or description)" };
  }

  // type: fallback to EVENT if not mappable
  const type = resolveActivityType(nd.typeCandidate) ?? "EVENT";
  if (!resolveActivityType(nd.typeCandidate)) {
    warnings.push(
      `typeCandidate "${nd.typeCandidate ?? "missing"}" not mapped — defaulted to EVENT`,
    );
  }

  // scheduleMode: fallback to ONE_TIME if not mappable
  const scheduleMode = resolveScheduleMode(nd.scheduleModeCandidate) ?? "ONE_TIME";
  if (!resolveScheduleMode(nd.scheduleModeCandidate)) {
    warnings.push(
      `scheduleModeCandidate "${nd.scheduleModeCandidate ?? "missing"}" not mapped — defaulted to ONE_TIME`,
    );
  }

  // ── Опциональные ────────────────────────────────────────────────────────
  const fields: MappedActivityFields = { title, shortDesc, type, scheduleMode };

  if (nd.description?.trim()) fields.description = nd.description.trim();
  if (cityId) fields.cityId = cityId;

  // Price
  if (nd.priceText) {
    fields.priceText = nd.priceText;
    const parsed = parsePriceText(nd.priceText);
    if (parsed) {
      if (parsed.priceFrom != null) fields.priceFrom = parsed.priceFrom;
      if (parsed.priceTo != null) fields.priceTo = parsed.priceTo;
    } else {
      warnings.push(`priceText "${nd.priceText}" could not be parsed to numbers — stored as text only`);
    }
  }

  // Schedule
  const scheduleJson = buildMinimalScheduleJson(
    nd.startAt,
    nd.endAt,
    nd.scheduleText,
    nd.occurrenceLines,
  );
  if (scheduleJson) fields.scheduleJson = scheduleJson;

  const ageDetection = detectAgeBuckets(nd.ageText);
  if (ageDetection.suggestedBuckets.length > 0) {
    fields.ageTags = ageDetection.suggestedBuckets;
    const range = getAgeRangeFromBuckets(ageDetection.suggestedBuckets);
    if (range.ageMinMonths != null) fields.ageMinMonths = range.ageMinMonths;
    if (range.ageMaxMonths != null) fields.ageMaxMonths = range.ageMaxMonths;
  } else if (nd.ageText) {
    warnings.push(`ageText "${nd.ageText}" could not be confidently mapped to age buckets`);
  }

  if (fields.scheduleJson && typeof fields.scheduleJson === "object") {
    fields.scheduleJson = {
      ...(fields.scheduleJson as Record<string, unknown>),
      ageDetection,
    };
  } else if (ageDetection.raw) {
    fields.scheduleJson = {
      _importSource: true,
      ageDetection,
    };
  }

  // nextOccurrenceAt — из startAt если парсится
  if (nd.startAt) {
    const d = new Date(nd.startAt);
    if (!isNaN(d.getTime())) fields.nextOccurrenceAt = d;
  }

  const posterUrl = pickImportEventPosterUrl(nd);
  if (posterUrl) {
    fields.coverImageUrl = posterUrl;
  } else if (nd.imageUrls.length > 0) {
    warnings.push("imageUrls present but no HTTPS poster URL — cover empty until editor/media");
  }

  return { fields, warnings };
}

// ── Non-destructive update filter for Activity ────────────────────────────────

/**
 * Для UPDATE/MERGE: вернуть только поля с непустым новым значением.
 *
 * title/type/scheduleMode — обновляются только если existing пустой.
 * description — обновляется если новое длиннее.
 * priceText, priceFrom, priceTo, ageMinMonths, ageMaxMonths — только если пустые в existing.
 * scheduleJson — только если пустой в existing (не перезаписываем расписание).
 * nextOccurrenceAt — только если пустой в existing.
 */
export function filterActivityNonDestructiveUpdates(
  mapped: MappedActivityFields,
  existing: Record<string, unknown>,
): { updates: Partial<MappedActivityFields>; skipped: string[] } {
  const result: Partial<MappedActivityFields> = {};
  const skipped: string[] = [];

  // Поля, которые обновляются только если existing пустой
  const onlyIfEmpty: (keyof MappedActivityFields)[] = [
    "title", "type", "scheduleMode",
    "priceText", "priceFrom", "priceTo",
    "ageTags",
    "ageMinMonths", "ageMaxMonths",
    "scheduleJson", "nextOccurrenceAt",
    "cityId",
    "coverImageUrl",
  ];

  for (const field of onlyIfEmpty) {
    const newVal = mapped[field as keyof MappedActivityFields];
    if (newVal === undefined || newVal === null) continue;
    const existingVal = existing[field];
    if (existingVal !== null && existingVal !== undefined && String(existingVal).trim() !== "") {
      skipped.push(field);
    } else {
      (result as Record<string, unknown>)[field] = newVal;
    }
  }

  // description — обновляем если новое длиннее
  if (mapped.description) {
    const existingDesc = existing["description"];
    if (!existingDesc || String(existingDesc).length < mapped.description.length) {
      result.description = mapped.description;
    } else {
      skipped.push("description (existing longer)");
    }
  }

  return { updates: result, skipped };
}
