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
  "Ты редактор текста для платформы mamaGo. Перепиши текст в заданном тоне. " +
  "Не добавляй новые факты. Не меняй даты, цены, возраст, место. " +
  "Не выдумывай информацию и не дополняй текст от себя. Работай только с исходным текстом.";

const TONE_INSTRUCTIONS: Record<"neutral" | "friendly" | "editorial" | "short", string> = {
  neutral:
    "Сделай текст нейтральным, чистым и понятным. Убери рекламные формулировки и лишний пафос.",
  friendly:
    "Сделай текст мягким и дружелюбным, но без фамильярности и без добавления новых фактов.",
  editorial:
    "Сделай текст более афишным и живым, но строго без выдуманных деталей и без изменения фактов.",
  short:
    "Сделай компактную, более короткую версию текста, сохранив все ключевые факты.",
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function isDeepSeekResponse(value: unknown): value is DeepSeekResponse {
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
    "Перепиши только исходный текст ниже.",
    "Сохрани факты, даты, цены, возрастные ограничения, место и смысл.",
    'Верни JSON вида {"result":"..."} и ничего больше.',
    "Исходный текст:",
    input.sourceText,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractRewriteResult(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { result?: unknown };
    return typeof parsed.result === "string" ? parsed.result.trim() : null;
  } catch {
    return null;
  }
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

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "DEEPSEEK_API_KEY is not configured" }, { status: 500 });
    }

    const endpoint = "https://api.deepseek.com/chat/completions";
    const model = "deepseek-chat";
    const requestBody = {
      model,
      response_format: { type: "json_object" as const },
      temperature: parsed.data.tone === "short" ? 0.4 : 0.6,
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: buildUserPrompt(parsed.data) },
      ],
    };

    console.log("[DeepSeek] request started", {
      model,
      endpoint,
      tone: parsed.data.tone,
      entityType: parsed.data.entityType ?? "event",
      hasApiKey: Boolean(apiKey),
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
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawResponseText = await response.text();
    console.log("[DeepSeek] response received", {
      status: response.status,
      statusText: response.statusText,
      body: rawResponseText,
    });

    const payload = safeJsonParse(rawResponseText) as DeepSeekResponse | { error?: unknown } | null;
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `DeepSeek request failed: ${response.status} ${response.statusText}. ${rawResponseText}`;
      console.error("[DeepSeek] request failed", {
        status: response.status,
        statusText: response.statusText,
        body: rawResponseText,
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const content = isDeepSeekResponse(payload)
      ? payload.choices?.[0]?.message?.content?.trim() ?? ""
      : "";
    if (!payload) {
      console.error("[DeepSeek] JSON parse failed", {
        status: response.status,
        statusText: response.statusText,
        body: rawResponseText,
      });
    }
    const result = extractRewriteResult(content);
    if (!result) {
      console.error("[DeepSeek] invalid rewrite payload", {
        content,
        body: rawResponseText,
      });
      return NextResponse.json({ error: "AI did not return a valid rewrite result" }, { status: 502 });
    }

    return NextResponse.json({
      result,
      tone: parsed.data.tone,
      provider: "deepseek",
      model: "deepseek-chat",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out" }, { status: 504 });
    }

    console.error("AI rewrite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
