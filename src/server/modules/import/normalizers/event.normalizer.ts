/**
 * Event Normalizer
 * raw payload → NormalizedEventImport
 *
 * Partial normalized payload допустим — ошибки не фатальны.
 * Не делает matching, не делает publish.
 */

import type { NormalizedEventImport } from "../types";
import {
  extractFirstPhoneFromRawPayload,
  extractFirstWebsiteFromRawPayload,
  extractSocialUrlsFromRawPayload,
} from "./extract-social-urls";
import { detectEventCategory } from "@/lib/ai/detectEventCategory";
import { extractEventImportLocationFields } from "@/lib/event-import/extractEventImportLocationFields";

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

const SHORT_DESC_MAX = 200;

function deriveShortDesc(description: string): string {
  if (description.length <= SHORT_DESC_MAX) return description;
  const truncated = description.slice(0, SHORT_DESC_MAX);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd() + "…";
}

// ─── Date extraction ──────────────────────────────────────────────────────────

/**
 * Извлечь дату как ISO-строку из поля rawPayload.
 * Принимает строки и числа (unix timestamp).
 */
function extractDateString(raw: RawPayload, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = raw[key];
    if (typeof val === "string" && val.trim().length > 0) {
      // Проверяем что это хоть что-то похожее на дату
      const d = new Date(val.trim());
      if (!isNaN(d.getTime())) return d.toISOString();
      // Если не парсится — вернуть как есть (scheduleText fallback)
      return val.trim();
    }
    if (typeof val === "number" && isFinite(val)) {
      const d = new Date(val * 1000);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return undefined;
}

// ─── Type / ScheduleMode candidates ──────────────────────────────────────────

/**
 * Извлечь typeCandidate.
 * Принимает строки, маппит к известным Activity.type значениям если возможно.
 */
function extractTypeCandidate(raw: RawPayload): string | undefined {
  const raw_val = extractString(raw, "type", "eventType", "activityType", "kind");
  if (!raw_val) return undefined;

  const normalized = raw_val.toUpperCase().trim();
  // Прямое совпадение с ActivityType enum
  const known = ["EVENT", "PERMANENT", "COURSE", "ROUTE", "OFFER"];
  if (known.includes(normalized)) return normalized;

  // Alias mapping
  const aliases: Record<string, string> = {
    "МЕРОПРИЯТИЕ": "EVENT",
    "СОБЫТИЕ":     "EVENT",
    "КУРС":        "COURSE",
    "ЗАНЯТИЕ":     "COURSE",
    "ПОСТОЯННОЕ":  "PERMANENT",
    "WORKSHOP":    "EVENT",
    "МАСТЕР-КЛАСС": "EVENT",
    "MASTERCLASS": "EVENT",
  };
  return aliases[normalized] ?? raw_val;
}

/**
 * Извлечь scheduleModeCandidate.
 */
function extractScheduleModeCandidate(raw: RawPayload): string | undefined {
  const raw_val = extractString(raw, "scheduleMode", "schedule_mode", "recurrence", "frequency");
  if (!raw_val) return undefined;

  const normalized = raw_val.toUpperCase().trim();
  const known = ["ONE_TIME", "MULTI_DATE", "RECURRING", "ON_DEMAND", "ALWAYS"];
  if (known.includes(normalized)) return normalized;

  const aliases: Record<string, string> = {
    "ONCE":       "ONE_TIME",
    "SINGLE":     "ONE_TIME",
    "РАЗОВОЕ":    "ONE_TIME",
    "WEEKLY":     "RECURRING",
    "DAILY":      "RECURRING",
    "ЕЖЕНЕДЕЛЬНО": "RECURRING",
    "ЕЖЕДНЕВНО":  "RECURRING",
    "MULTIPLE":   "MULTI_DATE",
    "НЕСКОЛЬКО":  "MULTI_DATE",
  };
  return aliases[normalized] ?? raw_val;
}

function detectFormatCandidate(raw: RawPayload): "OFFLINE" | "ONLINE" | "HYBRID" {
  const haystack = [
    extractString(raw, "title", "name", "eventTitle"),
    extractString(raw, "venue", "venueName", "placeName", "location", "place", "площадка"),
    extractString(
      raw,
      "addressText",
      "placeAddress",
      "locationAddress",
      "address",
      "addressLine",
      "formattedAddress",
      "addr",
    ),
    extractString(raw, "fullDescription", "description", "body", "text"),
    extractString(raw, "scheduleText", "schedule", "timing", "расписание"),
    extractString(raw, "onlineUrl", "onlineLink", "streamUrl", "zoomLink", "webinarLink"),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" \n")
    .toLowerCase();

  const onlineSignals = [
    "онлайн",
    "online",
    "zoom",
    "webinar",
    "вебинар",
    "трансляция",
    "стрим",
    "youtube live",
    "meet.google",
    "google meet",
  ];
  const hasOnlineSignal = onlineSignals.some((signal) => haystack.includes(signal));

  const hasPhysicalPlace = Boolean(
    extractString(raw, "venue", "venueName", "placeName", "location", "place", "площадка") ||
      extractString(
        raw,
        "addressText",
        "placeAddress",
        "locationAddress",
        "address",
        "addressLine",
        "formattedAddress",
        "addr",
      ),
  );

  if (hasOnlineSignal && hasPhysicalPlace) return "HYBRID";
  if (hasOnlineSignal) return "ONLINE";
  return "OFFLINE";
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

export interface EventNormalizerInput {
  rawPayload: RawPayload;
  sourceSlug: string;
  sourceUrl: string;
  externalId?: string | null;
  sourceUpdatedAt?: Date;
}

export interface EventNormalizerOutput {
  normalized: NormalizedEventImport;
  warnings: string[];
  /** AI-определённая категория (если удалось определить) */
  aiDetectedCategory?: {
    categoryId: string;
    categorySlug: string;
    categoryNameRu: string;
    categoryPath: string;
    rootCategoryId: string;
    subcategoryId: string | null;
    confidence: number;
    reason: string;
  } | null;
}

export function normalizeEventPayload(input: EventNormalizerInput): EventNormalizerOutput {
  const { rawPayload, sourceSlug, sourceUrl, externalId, sourceUpdatedAt } = input;
  const warnings: string[] = [];

  // ── Обязательные (кандидаты) ─────────────────────────────────────────────
  const title = extractString(rawPayload, "title", "name", "eventTitle");
  if (!title) warnings.push("title missing");

  const description = extractString(rawPayload, "fullDescription", "description", "body", "text");
  const shortDescRaw = extractString(
    rawPayload,
    "summaryText",
    "shortDescription",
    "shortDesc",
    "excerpt",
    "summary",
    "annotation",
  );

  let shortDescCandidate: string | undefined;
  if (shortDescRaw) {
    shortDescCandidate = shortDescRaw.length <= SHORT_DESC_MAX ? shortDescRaw : deriveShortDesc(shortDescRaw);
  } else if (description) {
    shortDescCandidate = deriveShortDesc(description);
    warnings.push("shortDescCandidate derived from description");
  } else {
    warnings.push("shortDescCandidate missing");
  }

  const typeCandidate = extractTypeCandidate(rawPayload);
  if (!typeCandidate) warnings.push("typeCandidate missing — Activity.type will need manual mapping");
  const formatCandidate = detectFormatCandidate(rawPayload);

  const scheduleModeCandidate = extractScheduleModeCandidate(rawPayload);
  if (!scheduleModeCandidate) warnings.push("scheduleModeCandidate missing — Activity.scheduleMode will need manual mapping");

  // ── Опциональные ─────────────────────────────────────────────────────────
  const locationFields = extractEventImportLocationFields(rawPayload);
  const venueName = locationFields.venueName;
  const addressText = locationFields.addressText;
  const cityName = locationFields.cityName;

  if (!venueName && !addressText) warnings.push("venue and address both missing");
  if (!cityName) warnings.push("city missing");

  const startAt = extractDateString(rawPayload, "startDate", "startAt", "start", "dateStart", "date");
  const endAt = extractDateString(rawPayload, "endDate", "endAt", "end", "dateEnd");
  const scheduleText = extractString(rawPayload, "scheduleText", "schedule", "timing", "расписание");

  let occurrenceLines = extractStringArray(rawPayload, "occurrenceLines");
  if (occurrenceLines.length === 0 && scheduleText) {
    const lines = scheduleText
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (lines.length > 1) occurrenceLines = lines;
  }

  if (!startAt && !scheduleText) warnings.push("startAt and scheduleText both missing");

  const ageText = extractString(rawPayload, "ageRange", "age", "ageText", "ages", "возраст");
  const priceText = extractString(rawPayload, "price", "priceText", "cost", "fee", "цена", "стоимость");
  const organizerName = extractString(rawPayload, "organizer", "organizerName", "host", "организатор");

  const phone = extractFirstPhoneFromRawPayload(rawPayload);
  let website = extractFirstWebsiteFromRawPayload(rawPayload);
  if (!website) {
    const w = extractString(rawPayload, "website", "site");
    if (w) website = w;
  }
  const socialUrls = extractSocialUrlsFromRawPayload(rawPayload);

  const categoryCandidates = extractStringArray(rawPayload, "categories", "tags", "types", "category");
  if (categoryCandidates.length === 0) warnings.push("categoryCandidates empty — will attempt AI detection");

  const mainImageUrl = extractString(
    rawPayload,
    "mainImageUrl",
    "mainImage",
    "ogImage",
    "coverImage",
    "poster",
    "posterUrl",
  );

  let imageUrls = extractStringArray(rawPayload, "images", "imageUrls", "photos", "gallery");
  if (mainImageUrl) {
    imageUrls = imageUrls.filter((u) => u !== mainImageUrl);
  }

  const trailerUrl = extractString(
    rawPayload,
    "trailerUrl",
    "trailer_url",
    "trailer",
    "videoUrl",
    "video_url",
    "reelsUrl",
  );

  const normalized: NormalizedEventImport = {
    entityType: "EVENT",
    sourceSlug,
    sourceUrl,
    externalId: externalId ?? null,
    sourceUpdatedAt,
    title,
    shortDescCandidate,
    description,
    typeCandidate,
    formatCandidate,
    scheduleModeCandidate,
    venueName,
    addressText,
    cityName,
    startAt,
    endAt,
    scheduleText,
    ...(occurrenceLines.length > 0 ? { occurrenceLines } : {}),
    ageText,
    priceText,
    organizerName,
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(socialUrls.length > 0 ? { socialUrls } : {}),
    categoryCandidates,
    ...(mainImageUrl ? { mainImageUrl } : {}),
    imageUrls,
    ...(trailerUrl ? { trailerUrl } : {}),
  };

  return { normalized, warnings, aiDetectedCategory: null };
}

/**
 * Асинхронная версия normalizeEventPayload с AI-определением категории
 * 
 * Использует AI для автоматического определения категории события,
 * если categoryCandidates пустой или если явно запрошено.
 * 
 * @param input - Входные данные для нормализации
 * @param options - Опции: forceAiDetection = всегда использовать AI, даже если есть categoryCandidates
 * @returns Нормализованные данные с AI-определённой категорией
 */
export async function normalizeEventPayloadWithAI(
  input: EventNormalizerInput,
  options: { forceAiDetection?: boolean } = {},
): Promise<EventNormalizerOutput> {
  // Сначала выполняем обычную нормализацию
  const result = normalizeEventPayload(input);
  const { normalized, warnings } = result;

  // Проверяем, нужно ли использовать AI для определения категории
  const shouldUseAI =
    options.forceAiDetection ||
    !normalized.categoryCandidates ||
    normalized.categoryCandidates.length === 0;

  if (!shouldUseAI || !normalized.title) {
    return result;
  }

  try {
    console.log(
      `[Event Normalizer] Attempting AI category detection for: ${normalized.title}`,
    );

    const aiCategory = await detectEventCategory({
      title: normalized.title,
      description: normalized.description,
      shortDescription: normalized.shortDescCandidate,
      venueName: normalized.venueName,
      addressText: normalized.addressText,
      categoryCandidates: normalized.categoryCandidates,
      ageText: normalized.ageText,
      priceText: normalized.priceText,
      scheduleText: normalized.scheduleText,
      organizerName: normalized.organizerName,
    });

    if (aiCategory) {
      console.log(
        `[Event Normalizer] AI detected category: ${aiCategory.categoryPath} (confidence: ${aiCategory.confidence})`,
      );

      // Добавляем AI-определённую категорию в categoryCandidates
      // (чтобы она была доступна в UI для выбора)
      if (!normalized.categoryCandidates.includes(aiCategory.categoryNameRu)) {
        normalized.categoryCandidates = [
          aiCategory.categoryNameRu,
          ...normalized.categoryCandidates,
        ];
      }

      return {
        normalized,
        warnings,
        aiDetectedCategory: aiCategory,
      };
    } else {
      console.log(
        `[Event Normalizer] AI could not detect category for: ${normalized.title}`,
      );
    }
  } catch (error) {
    console.error("[Event Normalizer] AI category detection failed:", error);
    warnings.push("AI category detection failed");
  }

  return result;
}
