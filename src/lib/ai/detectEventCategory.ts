/**
 * AI-based Event Category Detection
 * 
 * Автоматически определяет категорию события на основе контекста
 * (название, описание, теги, место проведения и т.д.)
 */

import { z } from "zod";
import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryDetectionInput {
  title: string;
  description?: string;
  shortDescription?: string;
  venueName?: string;
  addressText?: string;
  categoryCandidates?: string[];
  ageText?: string;
  priceText?: string;
  scheduleText?: string;
  organizerName?: string;
}

export interface CategoryDetectionResult {
  /** ID выбранной категории (может быть root или subcategory) */
  categoryId: string;
  /** Slug категории */
  categorySlug: string;
  /** Название категории на русском */
  categoryNameRu: string;
  /** Полный путь категории (например: "Концерты -> Рок") */
  categoryPath: string;
  /** ID корневой категории */
  rootCategoryId: string;
  /** ID подкатегории (если выбрана подкатегория) */
  subcategoryId: string | null;
  /** Уверенность AI (0-1) */
  confidence: number;
  /** Причина выбора (для отладки) */
  reason: string;
}

interface CategoryCandidate {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  path: string;
  keywords: string[];
  rootCategoryId: string;
  subcategoryId: string | null;
  isLeaf: boolean;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const aiCategoryResponseSchema = z.object({
  categoryId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "и", "в", "во", "на", "по", "для", "от", "до", "из", "у", "к", "со",
  "а", "но", "или", "это", "как", "под", "над", "без", "при", "про",
  "the", "and", "for", "with", "from", "that", "this", "are", "was",
]);

function tokenize(input: string): string[] {
  const matches = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return matches.filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function extractKeywords(parts: Array<string | null | undefined>, max = 12): string[] {
  const tokens = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .flatMap((part) => tokenize(part));
  return Array.from(new Set(tokens)).slice(0, max);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function isOpenRouterResponse(value: unknown): value is OpenRouterResponse {
  return value !== null && typeof value === "object" && "choices" in value;
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

// ─── Category Candidates ──────────────────────────────────────────────────────

async function loadCategoryCandidates(): Promise<CategoryCandidate[]> {
  const categories = await prisma.eventCategory.findMany({
    where: {
      isActive: true,
      publicationType: "EVENT",
      archivedAt: null,
    },
    select: {
      id: true,
      slug: true,
      nameRu: true,
      nameEn: true,
      parentId: true,
      parent: {
        select: {
          id: true,
          nameRu: true,
          slug: true,
        },
      },
      children: {
        where: { isActive: true, archivedAt: null },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
  });

  const candidates: CategoryCandidate[] = [];

  for (const category of categories) {
    const hasChildren = category.children.length > 0;
    const isRoot = !category.parentId;
    const isLeaf = !hasChildren;

    // Для корневых категорий с детьми — не добавляем их как кандидатов
    // (пользователь должен выбрать подкатегорию)
    if (isRoot && hasChildren) {
      continue;
    }

    const path = category.parent
      ? `${category.parent.nameRu} -> ${category.nameRu}`
      : category.nameRu;

    const keywords = extractKeywords([
      category.nameRu,
      category.nameEn,
      category.slug.replace(/[-_]/g, " "),
      category.parent?.nameRu,
      category.parent?.slug.replace(/[-_]/g, " "),
    ]);

    candidates.push({
      id: category.id,
      slug: category.slug,
      nameRu: category.nameRu,
      nameEn: category.nameEn,
      path,
      keywords,
      rootCategoryId: category.parentId || category.id,
      subcategoryId: category.parentId ? category.id : null,
      isLeaf,
    });
  }

  return candidates;
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────

function buildCategoryDetectionPrompt(
  input: CategoryDetectionInput,
  candidates: CategoryCandidate[],
): string {
  const contextParts: string[] = [];

  contextParts.push(`Название: ${input.title}`);

  if (input.shortDescription) {
    contextParts.push(`Краткое описание: ${input.shortDescription}`);
  } else if (input.description) {
    const truncated = input.description.length > 500
      ? `${input.description.slice(0, 500)}...`
      : input.description;
    contextParts.push(`Описание: ${truncated}`);
  }

  if (input.venueName) {
    contextParts.push(`Место: ${input.venueName}`);
  }

  if (input.addressText) {
    contextParts.push(`Адрес: ${input.addressText}`);
  }

  if (input.categoryCandidates && input.categoryCandidates.length > 0) {
    contextParts.push(`Теги из источника: ${input.categoryCandidates.join(", ")}`);
  }

  if (input.ageText) {
    contextParts.push(`Возраст: ${input.ageText}`);
  }

  if (input.priceText) {
    contextParts.push(`Цена: ${input.priceText}`);
  }

  if (input.scheduleText) {
    contextParts.push(`Расписание: ${input.scheduleText}`);
  }

  if (input.organizerName) {
    contextParts.push(`Организатор: ${input.organizerName}`);
  }

  const context = contextParts.join("\n");

  return [
    "Ты AI-классификатор событий для платформы mamaGo.",
    "Твоя задача — определить наиболее подходящую категорию события на основе контекста.",
    "",
    "Правила:",
    "- Выбирай ТОЛЬКО из переданных категорий (используй id из списка)",
    "- НЕ придумывай новые категории",
    "- Анализируй название, описание, место, теги и другой контекст",
    "- Если уверенности мало (confidence < 0.5), выбирай наиболее общую подходящую категорию",
    "- Confidence от 0 до 1 (0.7+ = высокая уверенность, 0.5-0.7 = средняя, <0.5 = низкая)",
    "",
    "Примеры:",
    "",
    "Пример 1:",
    "Контекст: Название: Концерт группы Би-2",
    "Описание: Легендарная рок-группа выступит с новой программой",
    'Ответ: {"categoryId":"concerts-rock","confidence":0.92,"reason":"Явно указан концерт рок-группы"}',
    "",
    "Пример 2:",
    "Контекст: Название: Мастер-класс по рисованию для детей",
    "Возраст: 5-10 лет",
    'Ответ: {"categoryId":"workshops-art","confidence":0.88,"reason":"Мастер-класс по творчеству для детей"}',
    "",
    "Пример 3:",
    "Контекст: Название: Выставка современного искусства",
    "Место: Национальный художественный музей",
    'Ответ: {"categoryId":"exhibitions-art","confidence":0.85,"reason":"Выставка в музее"}',
    "",
    "Контекст события:",
    context,
    "",
    "Доступные категории:",
    JSON.stringify(
      candidates.map((c) => ({
        id: c.id,
        path: c.path,
        keywords: c.keywords,
      })),
      null,
      2,
    ),
    "",
    'Верни только JSON вида {"categoryId":"...","confidence":0.85,"reason":"..."}',
  ].join("\n");
}

// ─── OpenRouter Request ───────────────────────────────────────────────────────

async function requestOpenRouterCategoryDetection(
  prompt: string,
): Promise<z.infer<typeof aiCategoryResponseSchema>> {
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
    temperature: 0.3, // Низкая температура для более детерминированных результатов
    max_tokens: 500,
    messages: [
      {
        role: "system" as const,
        content:
          "Ты AI-классификатор событий для mamaGo. Твоя задача — определить категорию события на основе контекста.",
      },
      { role: "user" as const, content: prompt },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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

  const parsed = aiCategoryResponseSchema.safeParse(safeJsonParse(content));

  if (!parsed.success) {
    console.error("[AI Category Detection] Invalid response:", content);
    throw new Error("AI did not return a valid category detection result");
  }

  return parsed.data;
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Определяет категорию события с помощью AI
 * 
 * @param input - Контекст события (название, описание, теги и т.д.)
 * @returns Результат определения категории или null если не удалось определить
 */
export async function detectEventCategory(
  input: CategoryDetectionInput,
): Promise<CategoryDetectionResult | null> {
  try {
    // Валидация входных данных
    if (!input.title || input.title.trim().length === 0) {
      console.warn("[AI Category Detection] Title is required");
      return null;
    }

    // Загружаем доступные категории
    const candidates = await loadCategoryCandidates();
    if (candidates.length === 0) {
      console.warn("[AI Category Detection] No active categories found");
      return null;
    }

    // Строим промпт и запрашиваем AI
    const prompt = buildCategoryDetectionPrompt(input, candidates);
    const aiResult = await requestOpenRouterCategoryDetection(prompt);

    // Находим выбранную категорию
    const selectedCandidate = candidates.find((c) => c.id === aiResult.categoryId);
    if (!selectedCandidate) {
      console.warn(
        `[AI Category Detection] AI returned unknown category ID: ${aiResult.categoryId}`,
      );
      return null;
    }

    // Если уверенность слишком низкая, не возвращаем результат
    if (aiResult.confidence < 0.4) {
      console.warn(
        `[AI Category Detection] Confidence too low: ${aiResult.confidence} for category ${selectedCandidate.nameRu}`,
      );
      return null;
    }

    return {
      categoryId: selectedCandidate.id,
      categorySlug: selectedCandidate.slug,
      categoryNameRu: selectedCandidate.nameRu,
      categoryPath: selectedCandidate.path,
      rootCategoryId: selectedCandidate.rootCategoryId,
      subcategoryId: selectedCandidate.subcategoryId,
      confidence: aiResult.confidence,
      reason: aiResult.reason || "AI classification",
    };
  } catch (error) {
    console.error("[AI Category Detection] Error:", error);
    return null;
  }
}

/**
 * Определяет категорию события с помощью AI (синхронная обёртка для normalizer)
 * 
 * Использует Promise без await для неблокирующего вызова в normalizer.
 * Результат можно получить через .then() или await снаружи.
 */
export function detectEventCategoryAsync(
  input: CategoryDetectionInput,
): Promise<CategoryDetectionResult | null> {
  return detectEventCategory(input);
}
