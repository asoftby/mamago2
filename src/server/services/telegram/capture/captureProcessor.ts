import type { InboxItem, InboxItemPart, Prisma, PrismaClient } from "@prisma/client";
import {
  captureDraftJsonSchema,
  parseCaptureDraft,
  type CaptureDraft,
} from "./captureDraft.schema";
import {
  type CaptureModelConfig,
  type OpenRouterClient,
  type OpenRouterResponseFormat,
} from "@/lib/ai/openrouterClient";
import {
  createExtractionCall,
  createTelegramFileImageSource,
  imageToDataUrl,
  type ExtractionUsage,
} from "@/server/ai/extraction";
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

type Usage = ExtractionUsage;

function sourceText(parts: Pick<InboxItemPart, "text">[]): string {
  return parts
    .map((part) => part.text?.trim() ?? "")
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function createCaptureInboxProcessor(deps: CaptureProcessorDeps): InboxProcessor {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  const imageSource = createTelegramFileImageSource(deps.telegram, { maxBytes: CAPTURE_LIMITS.maxPhotoBytes });

  async function loadImages(parts: InboxItemPart[]): Promise<string[] | null> {
    const urls: string[] = [];
    for (const part of parts) {
      if (part.kind !== "PHOTO" || !part.telegramFileId) continue;
      const image = await imageSource.load(part.telegramFileId);
      if (!image.ok) return null;
      urls.push(imageToDataUrl(image.value));
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

    const call = createExtractionCall<CaptureDraft>({
      openrouter: deps.openrouter,
      systemPrompt: CAPTURE_SYSTEM_PROMPT,
      userParts,
      responseFormat,
      parse: (content) => {
        const parsed = parseCaptureDraft(content);
        return parsed.ok ? { ok: true, value: parsed.draft } : { ok: false };
      },
      usage,
    });

    // Fast model, one retry, then the strong model once (escalation 1 / bad response).
    const outcome = await call.runWithRetry({ fast: models.fast, strong: models.strong });
    const escalationCodes: string[] = [];
    if (outcome.escalation === "BAD_RESPONSE") escalationCodes.push(RULE_CODES.escalateBadResponse);
    if (outcome.escalation === "INVALID_JSON") escalationCodes.push(RULE_CODES.escalateInvalidJson);
    if (!outcome.ok) {
      escalated = outcome.escalated;
      if (outcome.reason === "NOT_CONFIGURED") return fail("CAPTURE_MODEL_NOT_CONFIGURED");
      return fail(outcome.reason === "INFRA" ? "OPENROUTER_FAILED" : "INVALID_MODEL_OUTPUT");
    }
    escalated = outcome.escalation !== null;
    const current: CaptureDraft = outcome.value;
    let rules: RuleResult = applyPostLlmRules(current, context);

    // Escalations 2 and 3, only if the strong model has not been used yet.
    if (!escalated && models.strong) {
      const reason = detectEscalationReason(rules, context, text);
      if (reason) {
        escalated = true;
        escalationCodes.push(reason === "ESCALATE_EVENT_DATE" ? RULE_CODES.escalateEventDate : RULE_CODES.escalateMatch);
        const strong = await call.attempt(models.strong);
        // If the strong call fails, the already valid first result stands.
        if (strong.kind === "parsed") rules = applyPostLlmRules(strong.value, context);
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
