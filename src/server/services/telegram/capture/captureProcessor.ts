import type { InboxItem, InboxItemPart, Prisma, PrismaClient } from "@prisma/client";
import {
  captureDraftJsonSchema,
  parseCaptureDraft,
  type CaptureDraft,
} from "./captureDraft.schema";
import {
  type CaptureModelConfig,
  type OpenRouterClient,
  type OpenRouterErrorCode,
  type OpenRouterResponseFormat,
} from "@/lib/ai/openrouterClient";
import { CAPTURE_LIMITS } from "./captureLimits";
import { loadCaptureContext, type CaptureContextDeps } from "./captureContext";
import { buildCaptureUserParts, CAPTURE_SYSTEM_PROMPT } from "./capturePrompt";
import { applyPostLlmRules, detectEscalationReason, RULE_CODES, type RuleResult } from "./captureRules";
import type { InboxProcessor } from "./inboxProcessor";
import { findPlanDuplicates, type DuplicateMatch } from "./planDuplicates";
import type { TelegramCaptureClient } from "./telegramCaptureClient.core";
import { CAPTURE_PROCESSING_FAILED_TEXT } from "./captureReplies";

/**
 * The capture parsing pipeline (forward-to-plan spec v1.3, PR3):
 * PROCESSING -> context -> photos (memory only) -> model -> Zod -> rules ->
 * duplicates -> DRAFT_READY | FAILED. PlanItem writes still happen only from
 * callback handlers; an optional presenter may publish the confirmation card.
 *
 * Logging: ids, model id, durations, token counts and machine codes only.
 * `InboxItem.error` is always a machine code, never exception or provider text.
 */
export type CaptureFailureCode =
  | "CAPTURE_MODEL_NOT_CONFIGURED"
  | "OPENROUTER_FAILED"
  | "INVALID_MODEL_OUTPUT"
  | "TELEGRAM_FILE_FAILED"
  | "PROCESSOR_ERROR";

export type CaptureProcessorDeps = {
  db: PrismaClient;
  openrouter: Pick<OpenRouterClient, "chat">;
  telegram: Pick<TelegramCaptureClient, "getFile" | "downloadFile">;
  models: () => CaptureModelConfig;
  context: CaptureContextDeps;
  presenter?: { present(inboxItemId: string): Promise<void> };
  notifier?: {
    reply(chatId: number, text: string): Promise<void>;
    failed?(chatId: number, messageId: number | null, text: string): Promise<void>;
  };
  now?: () => Date;
};

export type CaptureRunResult =
  | {
      ok: true;
      draft: CaptureDraft;
      matchedPlanItemId: string | null;
      ruleCodes: string[];
      escalated: boolean;
      model: string | null;
      tokensIn: number | null;
      tokensOut: number | null;
      duplicates: DuplicateMatch[];
    }
  | { ok: false; code: CaptureFailureCode; escalated: boolean; model: string | null; tokensIn: number | null; tokensOut: number | null };

type Usage = { tokensIn: number | null; tokensOut: number | null; model: string | null };

type Attempt =
  | { kind: "parsed"; draft: CaptureDraft }
  | { kind: "invalid" }
  | { kind: "infra"; code: OpenRouterErrorCode; notConfigured: boolean; retryable: boolean };

function addUsage(total: Usage, tokensIn: number | null, tokensOut: number | null, model: string): void {
  if (tokensIn !== null) total.tokensIn = (total.tokensIn ?? 0) + tokensIn;
  if (tokensOut !== null) total.tokensOut = (total.tokensOut ?? 0) + tokensOut;
  total.model = model;
}

function imageMime(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function sourceText(parts: Pick<InboxItemPart, "text">[]): string {
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function createCaptureInboxProcessor(deps: CaptureProcessorDeps): InboxProcessor {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  async function loadImages(parts: InboxItemPart[]): Promise<string[] | null> {
    const urls: string[] = [];
    for (const part of parts) {
      if (part.kind !== "PHOTO" || !part.telegramFileId) continue;
      const file = await deps.telegram.getFile(part.telegramFileId);
      if (!file.ok) return null;
      const bytes = await deps.telegram.downloadFile(file.value.filePath, { maxBytes: CAPTURE_LIMITS.maxPhotoBytes });
      if (!bytes.ok) return null;
      urls.push(`data:${imageMime(file.value.filePath)};base64,${Buffer.from(bytes.value).toString("base64")}`);
    }
    return urls;
  }

  async function run(item: InboxItem & { parts: InboxItemPart[] }): Promise<CaptureRunResult> {
    const usage: Usage = { tokensIn: null, tokensOut: null, model: null };
    let escalated = false;
    const fail = (code: CaptureFailureCode): CaptureRunResult => ({
      ok: false,
      code,
      escalated,
      model: usage.model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
    });

    const models = deps.models();
    if (!models.fast) return fail("CAPTURE_MODEL_NOT_CONFIGURED");

    const text = sourceText(item.parts);
    const imageDataUrls = await loadImages(item.parts);
    if (imageDataUrls === null) return fail("TELEGRAM_FILE_FAILED");
    if (!text && imageDataUrls.length === 0) return fail("PROCESSOR_ERROR");

    const owner = { userId: item.userId };
    const context = await loadCaptureContext(deps.context, owner, {
      anchorAt: item.anchorAt,
      anchorIsForward: item.anchorIsForward,
      text,
    });
    const userParts = buildCaptureUserParts({ context, text, imageDataUrls, now: now() });
    const responseFormat: OpenRouterResponseFormat =
      models.responseFormat === "json_schema"
        ? { type: "json_schema", name: "capture_draft", schema: captureDraftJsonSchema() }
        : { type: "json_object" };

    const attempt = async (model: string): Promise<Attempt> => {
      const response = await deps.openrouter.chat({
        model,
        systemPrompt: CAPTURE_SYSTEM_PROMPT,
        userParts,
        responseFormat,
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
      addUsage(usage, response.tokensIn, response.tokensOut, response.model);
      const parsed = parseCaptureDraft(response.content);
      return parsed.ok ? { kind: "parsed", draft: parsed.draft } : { kind: "invalid" };
    };

    // Normal model, one retry.
    let first = await attempt(models.fast);
    if (first.kind === "infra" && first.notConfigured) return fail("CAPTURE_MODEL_NOT_CONFIGURED");
    if (first.kind === "invalid" || (first.kind === "infra" && first.retryable)) first = await attempt(models.fast);
    const escalationCodes: string[] = [];
    let current: CaptureDraft | null = null;

    if (first.kind === "infra") {
      if (first.notConfigured) return fail("CAPTURE_MODEL_NOT_CONFIGURED");
      // A structurally bad provider response is model-specific rather than a
      // transport outage. After the fast-model retry is exhausted, give the
      // configured strong model one chance before failing the item.
      if (first.code === "OPENROUTER_BAD_RESPONSE" && models.strong) {
        escalated = true;
        escalationCodes.push(RULE_CODES.escalateBadResponse);
        const strong = await attempt(models.strong);
        if (strong.kind === "infra") return fail("OPENROUTER_FAILED");
        if (strong.kind === "invalid") return fail("INVALID_MODEL_OUTPUT");
        current = strong.draft;
      } else {
        return fail("OPENROUTER_FAILED");
      }
    } else if (first.kind === "invalid") {

      // Escalation 1: invalid JSON / schema after the retry. Strong model, once.
      if (!models.strong) return fail("INVALID_MODEL_OUTPUT");
      escalated = true;
      escalationCodes.push(RULE_CODES.escalateInvalidJson);
      const strong = await attempt(models.strong);
      if (strong.kind === "infra") return fail("OPENROUTER_FAILED");
      if (strong.kind === "invalid") return fail("INVALID_MODEL_OUTPUT");
      current = strong.draft;
    } else if (first.kind === "parsed") {
      current = first.draft;
    }

    if (!current) return fail("PROCESSOR_ERROR");
    let rules: RuleResult = applyPostLlmRules(current, context);

    // Escalations 2 and 3, only if the strong model has not been used yet.
    if (!escalated && models.strong) {
      const reason = detectEscalationReason(rules, context, text);
      if (reason) {
        escalated = true;
        escalationCodes.push(reason === "ESCALATE_EVENT_DATE" ? RULE_CODES.escalateEventDate : RULE_CODES.escalateMatch);
        const strong = await attempt(models.strong);
        // If the strong call fails, the already valid first result stands.
        if (strong.kind === "parsed") rules = applyPostLlmRules(strong.draft, context);
      }
    }

    const ruleCodes = [...escalationCodes, ...rules.ruleCodes];

    let duplicates: DuplicateMatch[] = [];
    if (rules.draft.intent === "CREATE") {
      for (const entry of rules.draft.entries) {
        duplicates = duplicates.concat(await findPlanDuplicates({ db }, owner, entry, context.timeZone));
      }
      if (duplicates.length > 0) ruleCodes.push(RULE_CODES.duplicateFound);
    }

    return {
      ok: true,
      draft: rules.draft,
      matchedPlanItemId: rules.matchedPlanItemId,
      ruleCodes: [...new Set(ruleCodes)],
      escalated,
      model: usage.model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      duplicates,
    };
  }

  function logResult(item: InboxItem, status: string, code: string | null, result: Usage, startedAt: number): void {
    console.log(
      `[capture-processor] inboxItemId=${item.id} userId=${item.userId} status=${status} code=${code ?? "-"} ` +
        `model=${result.model ?? "-"} durationMs=${now().getTime() - startedAt} ` +
        `tokensIn=${result.tokensIn ?? "-"} tokensOut=${result.tokensOut ?? "-"}`,
    );
  }

  return {
    async process(inboxItemId) {
      const startedAt = now().getTime();
      const item = await db.inboxItem.findUnique({
        where: { id: inboxItemId },
        include: { parts: { orderBy: [{ position: "asc" }, { telegramMessageId: "asc" }] } },
      });
      if (!item || item.status !== "PROCESSING") return;

      let result: CaptureRunResult;
      try {
        result = await run(item);
      } catch {
        result = { ok: false, code: "PROCESSOR_ERROR", escalated: false, model: null, tokensIn: null, tokensOut: null };
      }

      const usageData = {
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        escalated: result.escalated,
        processedAt: now(),
      };

      // Only a row that is still PROCESSING is updated: terminal states are never overwritten.
      if (result.ok) {
        const updated = await db.inboxItem.updateMany({
          where: { id: item.id, status: "PROCESSING" },
          data: {
            ...usageData,
            status: "DRAFT_READY",
            intent: result.draft.intent,
            draft: result.draft as unknown as Prisma.InputJsonValue,
            draftVersion: { increment: 1 },
            matchedPlanItemId: result.matchedPlanItemId,
            ruleCodes: { push: result.ruleCodes },
            error: null,
          },
        });
        logResult(item, "DRAFT_READY", null, result, startedAt);
        if (updated.count === 1 && deps.presenter) {
          try {
            await deps.presenter.present(item.id);
          } catch {
            console.error(`[capture-processor] inboxItemId=${item.id} code=CARD_SEND_FAILED`);
          }
        }
        return;
      }

      const failed = await db.inboxItem.updateMany({
        where: { id: item.id, status: "PROCESSING" },
        data: { ...usageData, status: "FAILED", error: result.code },
      });
      logResult(item, "FAILED", result.code, result, startedAt);
      if (failed.count === 1 && deps.notifier) {
        try {
          const progressMessageId = item.cardMessageId !== null && item.cardMessageId > 0
            ? item.cardMessageId
            : null;
          if (deps.notifier.failed) {
            await deps.notifier.failed(
              Number(item.telegramChatId),
              progressMessageId,
              CAPTURE_PROCESSING_FAILED_TEXT,
            );
          } else {
            await deps.notifier.reply(Number(item.telegramChatId), CAPTURE_PROCESSING_FAILED_TEXT);
          }
        } catch {
          console.error(`[capture-processor] inboxItemId=${item.id} code=FAILURE_REPLY_FAILED`);
        }
      }
    },
  };
}
