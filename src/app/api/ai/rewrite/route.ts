import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  normalizeAiDescriptionContext,
  type AiDescriptionAction,
  type AiDescriptionEntityType,
} from "@/lib/ai/descriptionAssistant";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SOURCE_LENGTH = 8000;
const MAX_TITLE_LENGTH = 200;

const contextValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

const rewriteRequestSchema = z
  .object({
    action: z.enum(["generate", "improve", "shorten", "warm", "sell"]),
    sourceText: z.string().trim().max(MAX_SOURCE_LENGTH).optional().default(""),
    title: z.string().trim().max(MAX_TITLE_LENGTH).optional(),
    entityType: z.enum(["event", "place", "offer"]),
    context: z.record(z.string(), contextValueSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action !== "generate" && data.sourceText.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceText"],
        message: "sourceText must be at least 20 characters",
      });
    }

    if (data.action === "generate") {
      const normalizedContext = normalizeAiDescriptionContext(data.context);
      if (!data.title?.trim() && Object.keys(normalizedContext).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["context"],
          message: "title or context is required for generate",
        });
      }
    }
  });

const SYSTEM_PROMPT =
  "Ты — встроенный AI-редактор в системе mamaGo. Твоя задача — писать и улучшать описания для карточек и страниц внутри продукта.\n\n" +
  "Это НЕ чат. Это инструмент генерации текста внутри редактора.\n\n" +
  "ОБЩИЕ ПРАВИЛА:\n" +
  "1. Пиши только на русском языке.\n" +
  "2. Не придумывай факты, которых нет во входных данных.\n" +
  "3. Если данных не хватает — опирайся только на то, что явно передано, без догадок.\n" +
  "4. Не добавляй вводных фраз вроде \"Вот вариант\".\n" +
  "5. Не используй markdown.\n" +
  "6. Разбивай текст на короткие абзацы.\n" +
  "6a. Каждые 2–4 предложения отделяй пустой строкой.\n" +
  "6b. Не возвращай один длинный абзац.\n" +
  "6c. Если текст длиннее 700 символов, сделай минимум 3–5 абзацев.\n" +
  "6d. Абзацы разделяй двойным переносом строки.\n" +
  "7. Если уместно перечисление — используй строки с \"—\".\n" +
  "8. Если упоминаются цены, даты, время, условия, адрес — сохраняй их аккуратно и без искажений.\n" +
  "9. Верни только готовый текст для вставки в редактор.\n" +
  '10. Всегда возвращай JSON вида {"result":"готовый текст"}.\n';

const ENTITY_PROMPTS: Record<AiDescriptionEntityType, string> = {
  event:
    "Для событий делай текст понятным для родителей: что будет происходить, кому подходит событие, какие важные детали по времени, формату и участию нужно знать.",
  place:
    "Для мест описывай семейную локацию: какая атмосфера, что здесь можно делать, кому подходит место, что важно для родителей и детей, какие есть удобства и особенности.",
  offer:
    "Для предложений объясняй ценность: что входит, кому подходит, почему это может быть полезно, какие есть условия участия, записи, цены, даты или ограничения.",
};

const ACTION_PROMPTS: Record<AiDescriptionAction, string> = {
  generate:
    "Сгенерируй описание с нуля только на основе переданного контекста. Не добавляй то, чего нет в данных.",
  improve:
    "Улучши текст: сделай его чище, понятнее и структурированнее, сохранив все факты.",
  shorten:
    "Сделай текст короче и плотнее, сохранив все ключевые факты и смысл.",
  warm:
    "Сделай текст теплее, мягче и дружелюбнее, но без рекламного нажима и без выдуманных деталей.",
  sell:
    "Сделай текст более продающим и убедительным, но без агрессивной рекламы и без выдуманных фактов.",
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    text?: string | null;
  }>;
};

function isOpenRouterResponse(value: unknown): value is OpenRouterResponse {
  return value !== null && typeof value === "object" && "choices" in value;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function buildUserPrompt(input: z.infer<typeof rewriteRequestSchema>) {
  const normalizedContext = normalizeAiDescriptionContext(input.context);
  const contextLines = Object.entries(normalizedContext).map(
    ([key, value]) => `- ${key}: ${value}`,
  );

  return [
    `Тип сущности: ${input.entityType}`,
    `Действие: ${input.action}`,
    `Инструкция по сущности: ${ENTITY_PROMPTS[input.entityType]}`,
    `Инструкция по действию: ${ACTION_PROMPTS[input.action]}`,
    input.title ? `Заголовок: ${input.title}` : null,
    "",
    "Контекст:",
    contextLines.length > 0 ? contextLines.join("\n") : "- Контекст не передан",
    "",
    input.action === "generate"
      ? "Сгенерируй описание только по контексту выше."
      : "Перепиши только исходный текст ниже, учитывая контекст выше.",
    "Сохраняй факты, формулируй ясно и не придумывай новые детали.",
    "",
    input.action !== "generate" ? "Исходный текст:" : null,
    input.action !== "generate" ? input.sourceText : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractRewriteResult(content: string): string | null {
  if (!content || content.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(content) as { result?: unknown };
    if (typeof parsed.result === "string" && parsed.result.trim().length > 0) {
      return parsed.result.trim();
    }
    return null;
  } catch {
    if (content.length > 20 && !content.toLowerCase().includes("error")) {
      return content.trim();
    }
    return null;
  }
}

function mapOpenRouterError(status: number, body: string): string {
  if (status === 401 || status === 403) return "OpenRouter: ошибка авторизации";
  if (status === 402) return "OpenRouter: недостаточно баланса";
  if (status === 429) return "OpenRouter: превышен лимит запросов, попробуйте позже";
  if (status >= 500) return "OpenRouter: временная ошибка провайдера, попробуйте позже";
  const parsed = safeJsonParse(body);
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const err = (parsed as Record<string, unknown>).error;
    if (typeof err === "string") return err;
    if (
      err &&
      typeof err === "object" &&
      "message" in err &&
      typeof (err as Record<string, unknown>).message === "string"
    ) {
      return (err as Record<string, unknown>).message as string;
    }
  }
  return `OpenRouter request failed: ${status}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = rewriteRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (parsed.data.sourceText.length > MAX_SOURCE_LENGTH) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      console.error("[AI Rewrite] OPENROUTER_API_KEY not configured");
      return NextResponse.json(
        {
          error: "Не удалось сгенерировать текст. Попробуйте ещё раз.",
          code: "AI_PROVIDER_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
    const temperature = Number(process.env.OPENROUTER_TEMPERATURE ?? 0.4);
    const maxTokens = Number(process.env.OPENROUTER_MAX_TOKENS ?? 900);
    const siteUrl = process.env.OPENROUTER_SITE_URL || "http://mamago.local:3000";
    const appName = process.env.OPENROUTER_APP_NAME || "mamaGo 2.0";

    const requestBody = {
      model,
      response_format: { type: "json_object" as const },
      temperature:
        parsed.data.action === "shorten"
          ? Math.min(temperature, 0.35)
          : parsed.data.action === "generate"
            ? Math.max(temperature, 0.45)
            : temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: buildUserPrompt(parsed.data) },
      ],
    };

    console.log("[AI Rewrite] request started", {
      provider: "openrouter",
      model,
      action: parsed.data.action,
      entityType: parsed.data.entityType,
      sourceLength: parsed.data.sourceText.length,
    });

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
    } catch (fetchError) {
      clearTimeout(timeout);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[AI Rewrite] request timeout after 25s");
        return NextResponse.json(
          { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "TIMEOUT" },
          { status: 504 },
        );
      }

      console.error("[AI Rewrite] fetch error", {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        provider: "openrouter",
      });

      return NextResponse.json(
        { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "NETWORK_ERROR" },
        { status: 503 },
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawResponseText = await response.text();

    if (!response.ok) {
      const message = mapOpenRouterError(response.status, rawResponseText);
      console.error("[AI Rewrite] provider error", {
        provider: "openrouter",
        status: response.status,
        errorMessage: message,
      });

      return NextResponse.json(
        {
          error: "Не удалось сгенерировать текст. Попробуйте ещё раз.",
          code: "PROVIDER_ERROR",
          details: message,
        },
        { status: 502 },
      );
    }

    const payload = safeJsonParse(rawResponseText) as OpenRouterResponse | null;
    if (!payload) {
      return NextResponse.json(
        { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "INVALID_RESPONSE" },
        { status: 502 },
      );
    }

    let content = "";
    if (isOpenRouterResponse(payload) && payload.choices?.length) {
      const firstChoice = payload.choices[0];
      if (typeof firstChoice.message?.content === "string") {
        content = firstChoice.message.content.trim();
      } else if (typeof firstChoice.text === "string") {
        content = firstChoice.text.trim();
      }
    }

    if (!content) {
      return NextResponse.json(
        { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "INVALID_RESULT" },
        { status: 502 },
      );
    }

    const result = extractRewriteResult(content);
    if (!result) {
      return NextResponse.json(
        { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "INVALID_RESULT" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      result,
      action: parsed.data.action,
      provider: "openrouter",
      model,
    });
  } catch (error) {
    console.error("[AI Rewrite] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Не удалось сгенерировать текст. Попробуйте ещё раз.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
