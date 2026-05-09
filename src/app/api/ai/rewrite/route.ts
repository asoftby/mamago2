import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";

export const runtime = "nodejs";
export const maxDuration = 30;

const rewriteRequestSchema = z.object({
  tone: z.enum(["neutral", "friendly", "editorial", "short"]),
  sourceText: z.string().trim().min(20),
  title: z.string().trim().optional(),
  entityType: z.enum(["event", "place"]).optional(),
});

const SYSTEM_PROMPT =
  "Ты — встроенный AI-редактор в системе mamaGo. Твоя задача — переписывать описания событий так, чтобы они были понятными, структурированными и готовыми к отображению в интерфейсе.\n\n" +
  "Это НЕ чат. Это функция rewrite внутри продукта. Ты всегда работаешь с уже существующим текстом и улучшаешь его.\n\n" +
  "ТРЕБОВАНИЯ К ФОРМАТУ:\n" +
  "1. Разбивай текст на короткие абзацы (2–4 строки максимум)\n" +
  "2. Не пиши сплошным текстом\n" +
  "3. Используй переносы строк для улучшения читаемости\n" +
  "4. Если есть перечисления (активности, участники, зоны) — оформляй их списком через перенос строки:\n" +
  "— пункт 1\n" +
  "— пункт 2\n" +
  "— пункт 3\n\n" +
  "5. Если есть цены — ОБЯЗАТЕЛЬНО вынеси их в отдельный блок:\n" +
  "Стоимость:\n" +
  "— 0 BYN — дети до 5 лет\n" +
  "— 30 BYN — общий билет\n" +
  "— 40 BYN — единый билет\n\n" +
  "6. Если есть расписание — оформи его отдельным блоком:\n" +
  "Время:\n" +
  "10:00–23:00\n\n" +
  "7. НЕ используй markdown (**, #, списки через *, и т.д.). Только обычный текст и переносы строк\n" +
  "8. НЕ добавляй от себя новую информацию\n" +
  "9. НЕ сокращай важные детали\n" +
  "10. НЕ добавляй пояснения вроде \"Вот переписанный текст\"\n\n" +
  "РЕЗУЛЬТАТ: Верни только готовый переписанный текст с форматированием, пригодным для отображения в интерфейсе.";

const TONE_INSTRUCTIONS: Record<"neutral" | "friendly" | "editorial" | "short", string> = {
  neutral:
    "Сделай текст нейтральным, чистым и понятным. Убери рекламные формулировки и лишний пафос. Сохрани структуру с абзацами и списками.",
  friendly:
    "Сделай текст мягким и дружелюбным, но без фамильярности. Сохрани структуру с абзацами и списками.",
  editorial:
    "Сделай текст более афишным и живым, но строго без выдуманных деталей. Сохрани структуру с абзацами и списками.",
  short:
    "Сделай компактную, более короткую версию текста, сохранив все ключевые факты. Обязательно сохрани структуру с абзацами, списками и блоками цен/времени.",
};

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

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function buildUserPrompt(input: z.infer<typeof rewriteRequestSchema>) {
  return [
    `Тип сущности: ${input.entityType ?? "event"}`,
    `Тон: ${input.tone}`,
    `Инструкция по тону: ${TONE_INSTRUCTIONS[input.tone]}`,
    input.title ? `Заголовок: ${input.title}` : null,
    "",
    "Перепиши только исходный текст ниже.",
    "Сохрани факты, даты, цены, возрастные ограничения, место и смысл.",
    "",
    "ВАЖНО:",
    "— Разбивай на абзацы по 2-4 строки",
    "— Списки оформляй через \"—\" и переносы строк",
    "— Цены выноси в блок \"Стоимость:\"",
    "— Время выноси в блок \"Время:\"",
    "— НЕ используй markdown",
    "",
    'Верни JSON вида {"result":"переписанный текст с переносами строк"} и ничего больше.',
    "",
    "Исходный текст:",
    input.sourceText,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractRewriteResult(content: string): string | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content) as { result?: unknown };
    if (typeof parsed.result === "string" && parsed.result.trim().length > 0) {
      return parsed.result.trim();
    }
    
    // If result field is missing but we have other fields, log it
    if (parsed && typeof parsed === "object") {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AI Rewrite] JSON parsed but no 'result' field", {
          keys: Object.keys(parsed),
        });
      }
    }
    
    return null;
  } catch {
    // If not valid JSON, maybe AI returned plain text
    // This shouldn't happen with response_format: json_object, but handle it gracefully
    if (process.env.NODE_ENV !== "production") {
      console.warn("[AI Rewrite] content is not valid JSON, treating as plain text");
    }
    
    // Return the content as-is if it looks like rewritten text (not an error message)
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
    if (err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string") {
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
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      console.error("[AI Rewrite] OPENROUTER_API_KEY not configured");
      return NextResponse.json(
        { 
          error: "Не удалось переписать текст. Попробуйте позже.",
          code: "AI_PROVIDER_NOT_CONFIGURED"
        },
        { status: 503 }
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
      temperature: parsed.data.tone === "short" ? Math.min(temperature, 0.4) : temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: buildUserPrompt(parsed.data) },
      ],
    };

    console.log("[AI Rewrite] request started", {
      provider: "openrouter",
      model,
      tone: parsed.data.tone,
      entityType: parsed.data.entityType ?? "event",
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
          { error: "Не удалось переписать текст. Попробуйте позже.", code: "TIMEOUT" },
          { status: 504 }
        );
      }
      
      console.error("[AI Rewrite] fetch error", {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        provider: "openrouter",
      });
      
      return NextResponse.json(
        { error: "Не удалось переписать текст. Попробуйте позже.", code: "NETWORK_ERROR" },
        { status: 503 }
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawResponseText = await response.text();
    console.log("[AI Rewrite] response received", {
      provider: "openrouter",
      status: response.status,
      statusText: response.statusText,
      bodyLength: rawResponseText.length,
    });

    if (!response.ok) {
      const message = mapOpenRouterError(response.status, rawResponseText);
      console.error("[AI Rewrite] provider error", {
        provider: "openrouter",
        status: response.status,
        errorMessage: message,
      });
      
      return NextResponse.json(
        { 
          error: "Не удалось переписать текст. Попробуйте позже.",
          code: "PROVIDER_ERROR",
          details: message
        },
        { status: 502 }
      );
    }

    const payload = safeJsonParse(rawResponseText) as OpenRouterResponse | null;
    if (!payload) {
      console.error("[AI Rewrite] invalid JSON response", {
        provider: "openrouter",
        status: response.status,
      });
      
      return NextResponse.json(
        { error: "Не удалось переписать текст. Попробуйте позже.", code: "INVALID_RESPONSE" },
        { status: 502 }
      );
    }

    // Extract content from OpenRouter response
    // Support multiple formats: choices[0].message.content or choices[0].text
    let content = "";
    
    if (isOpenRouterResponse(payload) && payload.choices && payload.choices.length > 0) {
      const firstChoice = payload.choices[0];
      
      // Try message.content first (standard format)
      if (firstChoice.message?.content) {
        const rawContent = firstChoice.message.content;
        
        // Handle string content
        if (typeof rawContent === "string") {
          content = rawContent.trim();
        }
        // Handle array content (some models return array of content parts)
        else if (Array.isArray(rawContent)) {
          content = (rawContent as Array<unknown>)
            .map((part: unknown) => {
              if (typeof part === "string") return part;
              if (part && typeof part === "object" && "text" in part) {
                return String((part as { text: unknown }).text);
              }
              return "";
            })
            .join("")
            .trim();
        }
      }
      // Fallback: try text field (some models use this)
      else if ("text" in firstChoice && typeof (firstChoice as { text?: unknown }).text === "string") {
        content = ((firstChoice as { text: string }).text).trim();
      }
    }

    // Debug logging if content extraction failed
    if (!content) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AI Rewrite] failed to extract content", {
          provider: "openrouter",
          topLevelKeys: payload ? Object.keys(payload) : [],
          hasChoices: !!(payload && "choices" in payload),
          choicesLength:
            isOpenRouterResponse(payload) && Array.isArray(payload.choices)
              ? payload.choices.length
              : 0,
        });
      } else {
        console.error("[AI Rewrite] failed to extract content");
      }
      
      return NextResponse.json(
        { error: "Не удалось переписать текст. Попробуйте позже.", code: "INVALID_RESULT" },
        { status: 502 }
      );
    }

    // Extract the actual rewritten text from JSON response
    const result = extractRewriteResult(content);
    if (!result) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AI Rewrite] failed to parse result JSON", {
          contentLength: content.length,
        });
      } else {
        console.error("[AI Rewrite] failed to parse result JSON");
      }
      
      return NextResponse.json(
        { error: "Не удалось переписать текст. Попробуйте позже.", code: "INVALID_RESULT" },
        { status: 502 }
      );
    }

    console.log("[AI Rewrite] success", {
      provider: "openrouter",
      model,
      tone: parsed.data.tone,
      resultLength: result.length,
    });

    return NextResponse.json({
      result,
      tone: parsed.data.tone,
      provider: "openrouter",
      model,
    });
  } catch (error) {
    console.error("[AI Rewrite] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (process.env.NODE_ENV !== "production" && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    
    return NextResponse.json(
      { error: "Не удалось переписать текст. Попробуйте позже.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
