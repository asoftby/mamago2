import type {
  OpenRouterClient,
  OpenRouterErrorCode,
  OpenRouterResponseFormat,
  OpenRouterUserPart,
} from "@/lib/ai/openrouterClient";

/**
 * One structured model call with the shared attempt policy: fast model, one
 * retry, then the strong model once. Prompts, schemas and domain rules stay
 * with the caller; this module only knows about transport and parsing.
 */
export type ExtractionUsage = { tokensIn: number | null; tokensOut: number | null; model: string | null };

export type ExtractionParse<T> = (content: string) => { ok: true; value: T } | { ok: false };

export type ExtractionAttempt<T> =
  | { kind: "parsed"; value: T }
  | { kind: "invalid" }
  | { kind: "infra"; code: OpenRouterErrorCode; notConfigured: boolean; retryable: boolean };

export type ExtractionEscalation = "INVALID_JSON" | "BAD_RESPONSE";

export type ExtractionOutcome<T> =
  | { ok: true; value: T; escalation: ExtractionEscalation | null }
  | {
      ok: false;
      reason: "NOT_CONFIGURED" | "INFRA" | "INVALID";
      /** True when the strong model was tried before failing. */
      escalated: boolean;
      escalation: ExtractionEscalation | null;
    };

export type ExtractionCallDeps<T> = {
  openrouter: Pick<OpenRouterClient, "chat">;
  systemPrompt: string;
  userParts: OpenRouterUserPart[];
  responseFormat: OpenRouterResponseFormat;
  parse: ExtractionParse<T>;
  /** Mutated in place so the caller can report usage even when the call fails. */
  usage: ExtractionUsage;
};

export function addExtractionUsage(
  total: ExtractionUsage,
  tokensIn: number | null,
  tokensOut: number | null,
  model: string,
): void {
  if (tokensIn !== null) total.tokensIn = (total.tokensIn ?? 0) + tokensIn;
  if (tokensOut !== null) total.tokensOut = (total.tokensOut ?? 0) + tokensOut;
  total.model = model;
}

export function createExtractionCall<T>(deps: ExtractionCallDeps<T>) {
  async function attempt(model: string): Promise<ExtractionAttempt<T>> {
    const response = await deps.openrouter.chat({
      model,
      systemPrompt: deps.systemPrompt,
      userParts: deps.userParts,
      responseFormat: deps.responseFormat,
    });
    if (!response.ok) {
      // A non-retryable failure (not configured, auth/4xx) is final; retryable ones are retried once.
      return {
        kind: "infra",
        code: response.code,
        notConfigured: response.code === "OPENROUTER_NOT_CONFIGURED",
        retryable: response.retryable,
      };
    }
    addExtractionUsage(deps.usage, response.tokensIn, response.tokensOut, response.model);
    const parsed = deps.parse(response.content);
    return parsed.ok ? { kind: "parsed", value: parsed.value } : { kind: "invalid" };
  }

  async function runWithRetry(models: { fast: string; strong: string | null }): Promise<ExtractionOutcome<T>> {
    // Normal model, one retry.
    let first = await attempt(models.fast);
    if (first.kind === "infra" && first.notConfigured) {
      return { ok: false, reason: "NOT_CONFIGURED", escalated: false, escalation: null };
    }
    if (first.kind === "invalid" || (first.kind === "infra" && first.retryable)) first = await attempt(models.fast);

    const viaStrong = async (escalation: ExtractionEscalation): Promise<ExtractionOutcome<T>> => {
      const strong = await attempt(models.strong as string);
      if (strong.kind === "infra") return { ok: false, reason: "INFRA", escalated: true, escalation };
      if (strong.kind === "invalid") return { ok: false, reason: "INVALID", escalated: true, escalation };
      return { ok: true, value: strong.value, escalation };
    };

    if (first.kind === "infra") {
      if (first.notConfigured) return { ok: false, reason: "NOT_CONFIGURED", escalated: false, escalation: null };
      // A structurally bad provider response is model-specific rather than a
      // transport outage. After the fast-model retry is exhausted, give the
      // configured strong model one chance before failing.
      if (first.code === "OPENROUTER_BAD_RESPONSE" && models.strong) return viaStrong("BAD_RESPONSE");
      return { ok: false, reason: "INFRA", escalated: false, escalation: null };
    }
    if (first.kind === "invalid") {
      // Invalid JSON / schema after the retry. Strong model, once.
      if (!models.strong) return { ok: false, reason: "INVALID", escalated: false, escalation: null };
      return viaStrong("INVALID_JSON");
    }
    return { ok: true, value: first.value, escalation: null };
  }

  return { attempt, runWithRetry };
}
