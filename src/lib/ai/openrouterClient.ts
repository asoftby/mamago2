/**
 * Narrow OpenRouter chat client for the forward-to-plan capture parser.
 *
 * Plain `fetch`, no SDK. Never logs prompts, message text, image data or the
 * provider response body: failures are reported as safe codes only. Existing
 * AI modules (`enrichEvent`, `detectEventCategory`) are left untouched.
 */

export type OpenRouterConfig = {
  apiKey: string;
  siteUrl: string;
  appName: string;
};

export type CaptureModelConfig = {
  fast: string | null;
  strong: string | null;
  /** `json_object` is the safe default; `json_schema` is opt-in once the model is verified to support it. */
  responseFormat: "json_object" | "json_schema";
};

export type OpenRouterUserPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterResponseFormat =
  | { type: "json_object" }
  | { type: "json_schema"; name: string; schema: Record<string, unknown> };

export type OpenRouterCallInput = {
  model: string;
  systemPrompt: string;
  userParts: OpenRouterUserPart[];
  responseFormat: OpenRouterResponseFormat;
  timeoutMs?: number;
  maxTokens?: number;
};

export type OpenRouterErrorCode =
  | "OPENROUTER_NOT_CONFIGURED"
  | "OPENROUTER_TIMEOUT"
  | "OPENROUTER_NETWORK"
  | "OPENROUTER_HTTP_4XX"
  | "OPENROUTER_HTTP_5XX"
  | "OPENROUTER_BAD_RESPONSE";

export type OpenRouterCallResult =
  | { ok: true; content: string; model: string; tokensIn: number | null; tokensOut: number | null }
  | { ok: false; code: OpenRouterErrorCode; retryable: boolean };

export type OpenRouterClientDeps = {
  getConfig?: () => OpenRouterConfig | null;
  fetchImpl?: typeof fetch;
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const VISION_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 2_000;

export function readOpenRouterConfig(env: Record<string, string | undefined> = process.env): OpenRouterConfig | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    siteUrl: env.OPENROUTER_SITE_URL?.trim() || "http://mamago.local:3000",
    appName: env.OPENROUTER_APP_NAME?.trim() || "mamaGo 2.0",
  };
}

export function readCaptureModelConfig(env: Record<string, string | undefined> = process.env): CaptureModelConfig {
  return {
    fast: env.OPENROUTER_CAPTURE_MODEL?.trim() || null,
    strong: env.OPENROUTER_CAPTURE_MODEL_STRONG?.trim() || null,
    responseFormat: env.OPENROUTER_CAPTURE_RESPONSE_FORMAT?.trim() === "json_schema" ? "json_schema" : "json_object",
  };
}

type RawResponse = {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function createOpenRouterClient(deps: OpenRouterClientDeps = {}) {
  const getConfig = deps.getConfig ?? (() => readOpenRouterConfig());
  const fetchImpl = deps.fetchImpl ?? fetch;

  async function send(
    config: OpenRouterConfig,
    input: OpenRouterCallInput,
    responseFormat: OpenRouterResponseFormat,
  ): Promise<OpenRouterCallResult & { status?: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? VISION_TIMEOUT_MS);
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": config.siteUrl,
          "X-Title": config.appName,
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0,
          max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
          response_format:
            responseFormat.type === "json_schema"
              ? {
                  type: "json_schema",
                  json_schema: { name: responseFormat.name, strict: true, schema: responseFormat.schema },
                }
              : { type: "json_object" },
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user", content: input.userParts },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const is5xx = response.status >= 500 || response.status === 429 || response.status === 408;
        return {
          ok: false,
          code: is5xx ? "OPENROUTER_HTTP_5XX" : "OPENROUTER_HTTP_4XX",
          retryable: is5xx,
          status: response.status,
        };
      }

      const payload = (await response.json().catch(() => null)) as RawResponse | null;
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        return { ok: false, code: "OPENROUTER_BAD_RESPONSE", retryable: true };
      }
      return {
        ok: true,
        content,
        model: typeof payload?.model === "string" && payload.model ? payload.model : input.model,
        tokensIn: asCount(payload?.usage?.prompt_tokens),
        tokensOut: asCount(payload?.usage?.completion_tokens),
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return { ok: false, code: aborted ? "OPENROUTER_TIMEOUT" : "OPENROUTER_NETWORK", retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /**
     * One request. When `json_schema` is rejected (HTTP 400/422: the model
     * does not support it) the same call is repeated once in JSON mode;
     * schema validation then stays with the caller (Zod).
     */
    async chat(input: OpenRouterCallInput): Promise<OpenRouterCallResult> {
      const config = getConfig();
      if (!config) return { ok: false, code: "OPENROUTER_NOT_CONFIGURED", retryable: false };

      let result = await send(config, input, input.responseFormat);
      if (
        !result.ok &&
        input.responseFormat.type === "json_schema" &&
        (result.status === 400 || result.status === 422)
      ) {
        result = await send(config, input, { type: "json_object" });
      }

      if (result.ok) return result;
      const { code, retryable } = result;
      console.error(`[openrouter] code=${code}`);
      return { ok: false, code, retryable };
    },
  };
}

export type OpenRouterClient = ReturnType<typeof createOpenRouterClient>;
