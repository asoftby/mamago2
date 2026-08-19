import type { ActivityFormat } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { EventFormatPreset } from "@/lib/business/eventFormatSignals";
import { EVENT_FORMAT_OPTIONS } from "@/lib/business/eventFormatSignals";
import type { EventStep1Taxonomies } from "@/components/business/wizard/event/steps/step1Taxonomies";
import { getEventStep1Taxonomies } from "@/server/admin/activities/get-activity-form-data";
import type { NormalizedEventImport } from "@/server/modules/import/types";

export type AiEnrichmentFieldKey =
  | "format"
  | "eventFormats"
  | "interestIds"
  | "categoryId";

export interface EnrichmentResult {
  participationFormat?: {
    value: ActivityFormat;
    confidence: number;
  };
  atmosphereSignals: Array<{
    id: EventFormatPreset;
    confidence: number;
  }>;
  interestSignals: Array<{
    id: string;
    confidence: number;
  }>;
  mainCategory?: {
    id: string;
    confidence: number;
    rootCategoryId: string;
    subcategoryId: string | null;
    optionValue: string | null;
    categorySlug: string;
    categoryPathLabel: string;
    primaryRootHasChildren: boolean;
  };
  suggestedUpdates: {
    format?: ActivityFormat;
    eventFormats?: EventFormatPreset[];
    interestIds?: string[];
    categoryIds?: string[];
    categoryId?: string | null;
    subcategoryIdsByCategoryId?: Record<string, string[]>;
    subcategoryId?: string | null;
    genreSlugByRootCategoryId?: Record<string, string>;
    cinemaGenre?: string;
    categorySlug?: string | null;
    categoryPathLabel?: string | null;
    primaryRootHasChildren?: boolean;
  };
  confidentFieldKeys: AiEnrichmentFieldKey[];
  partial: boolean;
  sourceContext: {
    title: string;
    shortDescription: string;
    keywords: string[];
  };
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type CategoryCandidate = {
  id: string;
  label: string;
  keywords: string[];
  rootCategoryId: string;
  subcategoryId: string | null;
  optionValue: string | null;
  categorySlug: string;
  categoryPathLabel: string;
  primaryRootHasChildren: boolean;
};

type EventSourceContext = {
  title: string;
  shortDescription: string;
  keywords: string[];
  hasAddress: boolean;
  hasOnlineKeywords: boolean;
  hasTime: boolean;
  placeName?: string;
  tags?: string[];
  ageGroups?: string[];
};

const SHORT_DESCRIPTION_LIMIT = 700;

const ONLINE_KEYWORDS = [
  "zoom",
  "онлайн",
  "online",
  "вебинар",
  "webinar",
  "трансляция",
  "стрим",
  "stream",
  "google meet",
  "meet.google",
];

const STOP_WORDS = new Set([
  "и",
  "в",
  "во",
  "на",
  "по",
  "для",
  "от",
  "до",
  "из",
  "у",
  "к",
  "со",
  "а",
  "но",
  "или",
  "это",
  "как",
  "под",
  "над",
  "без",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
]);

const aiResponseSchema = z.object({
  participationFormat: z
    .object({
      value: z.enum(["OFFLINE", "ONLINE", "HYBRID"]),
      confidence: z.number().min(0).max(1),
    })
    .optional(),
  atmosphereSignals: z
    .array(
      z.object({
        id: z.string().min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional()
    .default([]),
  interestSignals: z
    .array(
      z.object({
        id: z.string().min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional()
    .default([]),
  mainCategory: z
    .object({
      id: z.string().min(1),
      confidence: z.number().min(0).max(1),
    })
    .optional(),
});

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isOpenRouterResponse(value: unknown): value is OpenRouterResponse {
  return value !== null && typeof value === "object" && "choices" in value;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function truncateText(value: string | null | undefined, limit = SHORT_DESCRIPTION_LIMIT): string {
  const source = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (source.length <= limit) return source;
  return `${source.slice(0, limit - 1).trimEnd()}…`;
}

function tokenize(input: string): string[] {
  const matches = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return matches.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function extractKeywords(parts: Array<string | null | undefined>, max = 14): string[] {
  return uniqueStrings(parts.flatMap((part) => (part ? tokenize(part) : []))).slice(0, max);
}

function joinTruthy(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join(" \n");
}

function extractString(
  record: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function extractStringArray(
  record: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  }
  return [];
}

function buildSourceContext(params: {
  normalizedData: NormalizedEventImport | null;
  rawPayload: Record<string, unknown> | null;
  rawText: string | null;
}): EventSourceContext | null {
  const normalizedData = params.normalizedData;
  const rawPayload = params.rawPayload;

  const title =
    normalizedData?.title?.trim() ||
    extractString(rawPayload, "title", "name", "eventTitle") ||
    "";
  const rawDescription =
    normalizedData?.description?.trim() ||
    params.rawText?.trim() ||
    extractString(rawPayload, "fullDescription", "description", "body", "text") ||
    "";
  const shortDescription = truncateText(rawDescription);

  if (!title && !shortDescription) {
    return null;
  }

  const placeName =
    normalizedData?.venueName?.trim() ||
    extractString(rawPayload, "venue", "venueName", "placeName", "location", "place", "площадка");
  const addressText =
    normalizedData?.addressText?.trim() ||
    extractString(
      rawPayload,
      "addressText",
      "placeAddress",
      "locationAddress",
      "address",
      "addressLine",
      "formattedAddress",
      "addr",
    );
  const scheduleText =
    normalizedData?.scheduleText?.trim() ||
    extractString(rawPayload, "scheduleText", "schedule", "timing", "расписание");
  const tags = uniqueStrings([
    ...(normalizedData?.categoryCandidates ?? []),
    ...extractStringArray(rawPayload, "categories", "tags", "types", "category"),
  ]).slice(0, 8);

  const ageGroups = uniqueStrings([
    normalizedData?.ageText?.trim() ?? "",
    extractString(rawPayload, "ageRange", "age", "ageText", "ages", "возраст") ?? "",
  ]).slice(0, 3);

  const haystack = joinTruthy([
    title,
    shortDescription,
    scheduleText,
    placeName,
    addressText,
    normalizedData?.startAt,
    normalizedData?.endAt,
  ]).toLowerCase();

  const hasOnlineKeywords = ONLINE_KEYWORDS.some((keyword) => haystack.includes(keyword));
  const hasTime =
    /\b\d{1,2}[:.]\d{2}\b/u.test(haystack) ||
    /\b(с|до)\s+\d{1,2}[:.]\d{2}\b/u.test(haystack);
  const hasAddress =
    Boolean(addressText) ||
    /\b(ул|улица|просп|проспект|пер|переулок|дом|адрес|address|street|st\.)\b/iu.test(haystack);

  const keywords = extractKeywords([
    title,
    shortDescription,
    scheduleText,
    placeName,
    addressText,
    ...tags,
  ]);

  return {
    title,
    shortDescription,
    keywords,
    hasAddress,
    hasOnlineKeywords,
    hasTime,
    placeName: placeName || undefined,
    tags: tags.length > 0 ? tags : undefined,
    ageGroups: ageGroups.length > 0 ? ageGroups : undefined,
  };
}

function buildParticipationCandidates() {
  return [
    {
      value: "OFFLINE" as const,
      label: "Офлайн",
      keywords: ["офлайн", "место", "адрес", "прийти", "на площадке", "в зале"],
    },
    {
      value: "ONLINE" as const,
      label: "Онлайн",
      keywords: ["онлайн", "zoom", "вебинар", "трансляция", "стрим", "google meet"],
    },
    {
      value: "HYBRID" as const,
      label: "Гибрид",
      keywords: ["онлайн и офлайн", "очно и онлайн", "гибрид", "два формата"],
    },
  ];
}

function buildAtmosphereCandidates() {
  return EVENT_FORMAT_OPTIONS.map((option) => {
    const keywordsById: Record<EventFormatPreset, string[]> = {
      calm_relaxed: ["спокойно", "мягко", "тихо", "неспешно", "уютно", "расслабленно"],
      educational: ["познавательно", "лекция", "мастер-класс", "обучение", "экскурсия", "развитие"],
      active_energetic: ["активно", "энергично", "спорт", "игра", "движение", "интерактив"],
    };

    return {
      id: option.value,
      label: option.label,
      keywords: keywordsById[option.value],
    };
  });
}

function buildInterestCandidates(taxonomies: EventStep1Taxonomies) {
  return taxonomies.interestOptions.map((option) => ({
    id: option.value,
    label: option.label,
    keywords: extractKeywords([option.label, option.value.replace(/[-_]/g, " ")], 6),
  }));
}

function buildCategoryCandidates(taxonomies: EventStep1Taxonomies): CategoryCandidate[] {
  const candidates: CategoryCandidate[] = [];

  for (const root of taxonomies.categories) {
    const children = root.children ?? [];
    const options = Array.isArray(root.options) ? root.options.filter((option) => option.isActive) : [];
    if (children.length === 0) {
      if (options.length > 0) {
        for (const option of options) {
          candidates.push({
            id: `${root.id}::option::${option.value}`,
            label: `${root.nameRu} -> ${option.label}`,
            keywords: extractKeywords([
              root.nameRu,
              root.slug.replace(/[-_]/g, " "),
              option.label,
              option.value.replace(/[-_]/g, " "),
            ]),
            rootCategoryId: root.id,
            subcategoryId: null,
            optionValue: option.value,
            categorySlug: root.slug,
            categoryPathLabel: `${root.nameRu} -> ${option.label}`,
            primaryRootHasChildren: false,
          });
        }
        continue;
      }

      candidates.push({
        id: root.id,
        label: root.nameRu,
        keywords: extractKeywords([root.nameRu, root.slug.replace(/[-_]/g, " ")]),
        rootCategoryId: root.id,
        subcategoryId: null,
        optionValue: null,
        categorySlug: root.slug,
        categoryPathLabel: root.nameRu,
        primaryRootHasChildren: false,
      });
      continue;
    }

    for (const child of children) {
      candidates.push({
        id: child.id,
        label: `${root.nameRu} -> ${child.nameRu}`,
        keywords: extractKeywords([
          root.nameRu,
          root.slug.replace(/[-_]/g, " "),
          child.nameRu,
          child.slug.replace(/[-_]/g, " "),
        ]),
        rootCategoryId: root.id,
        subcategoryId: child.id,
        optionValue: null,
        categorySlug: child.slug,
        categoryPathLabel: child.nameRu,
        primaryRootHasChildren: true,
      });
    }
  }

  return candidates;
}

function mapOpenRouterError(status: number, body: string): string {
  if (status === 401 || status === 403) return "OpenRouter: ошибка авторизации";
  if (status === 402) return "OpenRouter: недостаточно баланса";
  if (status === 429) return "OpenRouter: превышен лимит запросов, попробуйте позже";
  if (status >= 500) return "OpenRouter: временная ошибка провайдера, попробуйте позже";

  const parsed = safeJsonParse(body);
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const errorValue = (parsed as Record<string, unknown>).error;
    if (typeof errorValue === "string") return errorValue;
    if (
      errorValue &&
      typeof errorValue === "object" &&
      "message" in errorValue &&
      typeof (errorValue as Record<string, unknown>).message === "string"
    ) {
      return (errorValue as Record<string, string>).message;
    }
  }

  return `OpenRouter request failed: ${status}`;
}

function buildUserPrompt(params: {
  context: EventSourceContext;
  participationFormats: ReturnType<typeof buildParticipationCandidates>;
  atmosphereSignals: ReturnType<typeof buildAtmosphereCandidates>;
  interestSignals: ReturnType<typeof buildInterestCandidates>;
  mainCategories: CategoryCandidate[];
}) {
  const { context, participationFormats, atmosphereSignals, interestSignals, mainCategories } = params;

  return [
    "Ты анализируешь событие и оцениваешь, насколько каждый вариант подходит.",
    "",
    "Правила:",
    "- НЕ придумывай новые значения",
    "- используй только переданные id/value",
    "- confidence от 0 до 1",
    "- interests максимум 5",
    "- mainCategory только 1",
    "- participationFormat только 1",
    "- если уверенности мало, оставляй элемент невыбранным или ставь низкий confidence",
    "",
    "Пример 1:",
    "Событие: Онлайн мастер-класс по рисованию",
    'Ответ: {"participationFormat":{"value":"ONLINE","confidence":0.96},"atmosphereSignals":[{"id":"educational","confidence":0.84}],"interestSignals":[{"id":"drawing","confidence":0.91},{"id":"creativity","confidence":0.87}],"mainCategory":{"id":"workshop","confidence":0.83}}',
    "",
    "Пример 2:",
    "Событие: Выставка в музее с адресом",
    'Ответ: {"participationFormat":{"value":"OFFLINE","confidence":0.95},"atmosphereSignals":[{"id":"educational","confidence":0.72},{"id":"calm_relaxed","confidence":0.64}],"interestSignals":[{"id":"art","confidence":0.88},{"id":"educational","confidence":0.69}],"mainCategory":{"id":"museum-exhibition","confidence":0.86}}',
    "",
    "Пример 3:",
    "Событие: Лагерь для детей",
    'Ответ: {"participationFormat":{"value":"OFFLINE","confidence":0.93},"atmosphereSignals":[{"id":"active_energetic","confidence":0.78}],"interestSignals":[{"id":"active-games","confidence":0.82}],"mainCategory":{"id":"camp","confidence":0.9}}',
    "",
    "Контекст события:",
    JSON.stringify(context, null, 2),
    "",
    "Кандидаты:",
    JSON.stringify(
      {
        participationFormats,
        atmosphereSignals,
        interestSignals,
        mainCategories,
      },
      null,
      2,
    ),
    "",
    'Верни только JSON вида {"participationFormat": {...}, "atmosphereSignals": [...], "interestSignals": [...], "mainCategory": {...}}.',
  ].join("\n");
}

function dedupeById<T extends { id: string; confidence: number }>(items: T[]): T[] {
  const bestById = new Map<string, T>();
  for (const item of items) {
    const current = bestById.get(item.id);
    if (!current || item.confidence > current.confidence) {
      bestById.set(item.id, item);
    }
  }
  return Array.from(bestById.values());
}

function normalizeAtmosphereSelection(
  items: Array<{ id: EventFormatPreset; confidence: number }>,
): Array<{ id: EventFormatPreset; confidence: number }> {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
  const selected: Array<{ id: EventFormatPreset; confidence: number }> = [];

  for (const item of sorted) {
    if (selected.length >= 2) break;
    if (
      (item.id === "calm_relaxed" && selected.some((entry) => entry.id === "active_energetic")) ||
      (item.id === "active_energetic" && selected.some((entry) => entry.id === "calm_relaxed"))
    ) {
      continue;
    }
    selected.push(item);
  }

  return selected;
}

async function requestOpenRouterEnrichment(prompt: string): Promise<z.infer<typeof aiResponseSchema>> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured");
  }

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://mamago.local:3000";
  const appName = process.env.OPENROUTER_APP_NAME || "mamaGo 2.0";

  const requestBody = {
    model,
    response_format: { type: "json_object" as const },
    temperature: Math.min(Number(process.env.OPENROUTER_TEMPERATURE ?? 0.2), 0.3),
    max_tokens: Math.min(Number(process.env.OPENROUTER_MAX_TOKENS ?? 900), 1100),
    messages: [
      {
        role: "system" as const,
        content:
          "Ты AI-классификатор событий для mamaGo. Твоя задача — оценить только переданные кандидаты, не выдумывая новых значений.",
      },
      { role: "user" as const, content: prompt },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": siteUrl,
        "X-Title": appName,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawResponseText = await response.text();
  if (!response.ok) {
    throw new Error(mapOpenRouterError(response.status, rawResponseText));
  }

  const payload = safeJsonParse(rawResponseText) as OpenRouterResponse | null;
  const content = isOpenRouterResponse(payload)
    ? payload?.choices?.[0]?.message?.content?.trim() ?? ""
    : "";
  const parsed = aiResponseSchema.safeParse(safeJsonParse(content));

  if (!parsed.success) {
    throw new Error("AI did not return a valid enrichment result");
  }

  return parsed.data;
}

function findLinkedImportedRecord(params: {
  explicitImportedRecordId?: string | null;
  activityId?: string | null;
}) {
  if (params.explicitImportedRecordId) {
    return prisma.importedRecord.findUnique({
      where: { id: params.explicitImportedRecordId },
      select: {
        id: true,
        entityTypeHint: true,
        rawText: true,
        rawPayload: true,
        normalizedData: true,
      },
    });
  }

  if (!params.activityId) {
    return Promise.resolve(null);
  }

  return prisma.importedRecord.findFirst({
    where: { publishedActivityId: params.activityId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      entityTypeHint: true,
      rawText: true,
      rawPayload: true,
      normalizedData: true,
    },
  });
}

export async function enrichEvent(input: {
  importedRecordId?: string | null;
  activityId?: string | null;
}): Promise<EnrichmentResult | null> {
  const record = await findLinkedImportedRecord({
    explicitImportedRecordId: input.importedRecordId ?? null,
    activityId: input.activityId ?? null,
  });

  if (!record || record.entityTypeHint !== "EVENT") {
    return null;
  }

  const normalizedData =
    record.normalizedData && typeof record.normalizedData === "object"
      ? (record.normalizedData as unknown as NormalizedEventImport)
      : null;
  const rawPayload =
    record.rawPayload && typeof record.rawPayload === "object"
      ? (record.rawPayload as Record<string, unknown>)
      : null;

  const context = buildSourceContext({
    normalizedData,
    rawPayload,
    rawText: record.rawText,
  });

  if (!context) {
    return null;
  }

  const taxonomies = await getEventStep1Taxonomies();
  const participationFormats = buildParticipationCandidates();
  const atmosphereSignals = buildAtmosphereCandidates();
  const interestSignals = buildInterestCandidates(taxonomies);
  const mainCategories = buildCategoryCandidates(taxonomies);

  const aiResult = await requestOpenRouterEnrichment(
    buildUserPrompt({
      context,
      participationFormats,
      atmosphereSignals,
      interestSignals,
      mainCategories,
    }),
  );

  const participationFormat =
    aiResult.participationFormat && aiResult.participationFormat.confidence > 0.6
      ? aiResult.participationFormat
      : undefined;

  const atmosphereById = new Set(atmosphereSignals.map((item) => item.id));
  const filteredAtmosphere = normalizeAtmosphereSelection(
    dedupeById(
      (aiResult.atmosphereSignals ?? [])
        .filter((item): item is { id: EventFormatPreset; confidence: number } =>
          atmosphereById.has(item.id as EventFormatPreset),
        )
        .filter((item) => item.confidence > 0.5),
    ),
  );

  const interestById = new Set(interestSignals.map((item) => item.id));
  const filteredInterests = dedupeById(aiResult.interestSignals ?? [])
    .filter((item) => interestById.has(item.id))
    .filter((item) => item.confidence > 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  const categoryById = new Map(mainCategories.map((candidate) => [candidate.id, candidate]));
  const mainCategoryCandidate =
    aiResult.mainCategory && aiResult.mainCategory.confidence > 0.6
      ? categoryById.get(aiResult.mainCategory.id) ?? null
      : null;

  const confidentFieldKeys: AiEnrichmentFieldKey[] = [];
  const suggestedUpdates: EnrichmentResult["suggestedUpdates"] = {};

  if (participationFormat) {
    suggestedUpdates.format = participationFormat.value;
    confidentFieldKeys.push("format");
  }

  if (filteredAtmosphere.length > 0) {
    suggestedUpdates.eventFormats = filteredAtmosphere.map((item) => item.id);
    confidentFieldKeys.push("eventFormats");
  }

  if (filteredInterests.length > 0) {
    suggestedUpdates.interestIds = filteredInterests.map((item) => item.id);
    confidentFieldKeys.push("interestIds");
  }

  const resolvedMainCategory =
    mainCategoryCandidate && aiResult.mainCategory
      ? {
          id: mainCategoryCandidate.id,
          confidence: aiResult.mainCategory.confidence,
          rootCategoryId: mainCategoryCandidate.rootCategoryId,
          subcategoryId: mainCategoryCandidate.subcategoryId,
          optionValue: mainCategoryCandidate.optionValue,
          categorySlug: mainCategoryCandidate.categorySlug,
          categoryPathLabel: mainCategoryCandidate.categoryPathLabel,
          primaryRootHasChildren: mainCategoryCandidate.primaryRootHasChildren,
        }
      : undefined;

  if (resolvedMainCategory) {
    suggestedUpdates.categoryIds = [resolvedMainCategory.rootCategoryId];
    suggestedUpdates.categoryId = resolvedMainCategory.rootCategoryId;
    suggestedUpdates.subcategoryIdsByCategoryId = {
      [resolvedMainCategory.rootCategoryId]: resolvedMainCategory.subcategoryId
        ? [resolvedMainCategory.subcategoryId]
        : [],
    };
    suggestedUpdates.subcategoryId = resolvedMainCategory.subcategoryId;
    suggestedUpdates.genreSlugByRootCategoryId =
      resolvedMainCategory.optionValue
        ? { [resolvedMainCategory.rootCategoryId]: resolvedMainCategory.optionValue }
        : {};
    if (
      resolvedMainCategory.optionValue &&
      resolvedMainCategory.categorySlug.toLowerCase().includes("cinema")
    ) {
      suggestedUpdates.cinemaGenre = resolvedMainCategory.optionValue;
    }
    suggestedUpdates.categorySlug = resolvedMainCategory.categorySlug;
    suggestedUpdates.categoryPathLabel = resolvedMainCategory.categoryPathLabel;
    suggestedUpdates.primaryRootHasChildren = resolvedMainCategory.primaryRootHasChildren;
    confidentFieldKeys.push("categoryId");
  }

  const confidentGroups = confidentFieldKeys.length;
  const partial = confidentGroups > 0 && confidentGroups < 4;

  return {
    participationFormat,
    atmosphereSignals: filteredAtmosphere,
    interestSignals: filteredInterests,
    mainCategory: resolvedMainCategory,
    suggestedUpdates,
    confidentFieldKeys,
    partial,
    sourceContext: {
      title: context.title,
      shortDescription: context.shortDescription,
      keywords: context.keywords,
    },
  };
}
