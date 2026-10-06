import {
  Prisma,
  type PrismaClient,
  type TelegramEnvironment,
} from "@prisma/client";
import type {
  CaptureModelConfig,
  OpenRouterClient,
  OpenRouterResponseFormat,
} from "@/lib/ai/openrouterClient";
import type { PlanOwner } from "@/server/services/planOwner";
import {
  CaptureDraftSchema,
  captureDraftJsonSchema,
  parseCaptureDraft,
  type CaptureDraft,
} from "./captureDraft.schema";
import {
  applyPostLlmRules,
  RULE_CODES,
} from "./captureRules";
import {
  buildCaptureEditUserParts,
  CAPTURE_EDIT_SYSTEM_PROMPT,
} from "./capturePrompt";
import {
  findPlanDuplicates,
  type DuplicateMatch,
} from "./planDuplicates";
import {
  loadCaptureContext,
  type CaptureContextDeps,
} from "./captureContext";
import type { CaptureCardPresenter } from "./captureCardPresenter";
import type { ParsedCapture } from "./telegramUpdateParser";
import { CAPTURE_LIMITS } from "./captureLimits";
import { CAPTURE_REPLIES } from "./captureReplies";

type Usage = {
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

type Attempt =
  | { kind: "parsed"; draft: CaptureDraft }
  | { kind: "invalid" }
  | {
      kind: "infra";
      code: string;
      retryable: boolean;
      notConfigured: boolean;
    };

type EditSnapshot = {
  id: string;
  userId: string;
  environment: TelegramEnvironment;
  telegramChatId: bigint;
  anchorAt: Date;
  anchorIsForward: boolean;
  draft: Prisma.JsonValue;
  draftVersion: number;
  ruleCodes: string[];
  escalated: boolean;
  tokensIn: number | null;
  tokensOut: number | null;
};

export type CaptureEditIntakeResult = {
  handled: true;
  afterResponse: (() => Promise<void>) | null;
};

export type CaptureEditNotifier = {
  typing(chatId: number): Promise<void>;
  reply(chatId: number, text: string): Promise<void>;
};

export type CaptureEditDeps = {
  db: PrismaClient;
  openrouter: Pick<OpenRouterClient, "chat">;
  models: () => CaptureModelConfig;
  context: CaptureContextDeps;
  presenter: CaptureCardPresenter;
  notifier: CaptureEditNotifier;
  now?: () => Date;
};

const PRESERVED_INTAKE_RULES = new Set([
  "ALBUM_TRUNCATED",
  "ALBUM_LATE_PART",
]);

function addUsage(
  usage: Usage,
  input: { model: string; tokensIn: number | null; tokensOut: number | null },
): void {
  usage.model = input.model;
  if (input.tokensIn !== null) {
    usage.tokensIn = (usage.tokensIn ?? 0) + input.tokensIn;
  }
  if (input.tokensOut !== null) {
    usage.tokensOut = (usage.tokensOut ?? 0) + input.tokensOut;
  }
}

function sumUsage(previous: number | null, added: number | null): number | null {
  if (previous === null && added === null) return null;
  return (previous ?? 0) + (added ?? 0);
}

function safeLog(code: string, inboxItemId: string, userId: string): void {
  console.error(
    `[capture-edit] inboxItemId=${inboxItemId} userId=${userId} code=${code}`,
  );
}

function isReceiptConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((field) => field.includes("telegramUpdateId"));
}

export function createCaptureEditService(deps: CaptureEditDeps) {
  const now = deps.now ?? (() => new Date());

  async function findActive(
    owner: PlanOwner,
    environment: TelegramEnvironment,
    capture: ParsedCapture,
  ) {
    return deps.db.inboxItem.findFirst({
      where: {
        userId: owner.userId,
        environment,
        telegramChatId: BigInt(capture.chatId),
        status: "DRAFT_READY",
        awaitingEditUntil: { gt: now() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        environment: true,
        telegramChatId: true,
        anchorAt: true,
        anchorIsForward: true,
        draft: true,
        draftVersion: true,
        ruleCodes: true,
        escalated: true,
        tokensIn: true,
        tokensOut: true,
      },
    });
  }

  async function claim(
    owner: PlanOwner,
    environment: TelegramEnvironment,
    capture: ParsedCapture,
  ): Promise<EditSnapshot | "duplicate" | null> {
    const receiptKey = {
      environment_telegramUpdateId: {
        environment,
        telegramUpdateId: BigInt(capture.updateId),
      },
    };

    if (
      await deps.db.inboxItemPart.findUnique({
        where: receiptKey,
        select: { id: true },
      })
    ) {
      return "duplicate";
    }

    const active = await findActive(owner, environment, capture);
    if (!active) return null;

    try {
      return await deps.db.$transaction(async (tx) => {
        const claimed = await tx.inboxItem.updateMany({
          where: {
            id: active.id,
            userId: owner.userId,
            status: "DRAFT_READY",
            draftVersion: active.draftVersion,
            awaitingEditUntil: { gt: now() },
          },
          data: { awaitingEditUntil: null },
        });
        if (claimed.count !== 1) return null;

        const position = await tx.inboxItemPart.count({
          where: { inboxItemId: active.id },
        });
        await tx.inboxItemPart.create({
          data: {
            inboxItemId: active.id,
            environment,
            telegramUpdateId: BigInt(capture.updateId),
            telegramMessageId: capture.messageId,
            kind: "TEXT",
            text: capture.text,
            telegramFileId: null,
            position,
          },
        });

        return active as EditSnapshot;
      });
    } catch (error) {
      if (isReceiptConflict(error)) return "duplicate";
      throw error;
    }
  }

  async function runModel(
    snapshot: EditSnapshot,
    instruction: string,
  ): Promise<
    | {
        ok: true;
        draft: CaptureDraft;
        ruleCodes: string[];
        escalated: boolean;
        usage: Usage;
      }
    | { ok: false; code: string }
  > {
    const current = CaptureDraftSchema.safeParse(snapshot.draft);
    if (!current.success) return { ok: false, code: "EDIT_INVALID_DRAFT" };

    const models = deps.models();
    if (!models.fast) return { ok: false, code: "CAPTURE_MODEL_NOT_CONFIGURED" };

    const contextText = [
      ...current.data.entries.map((entry) => entry.title.value),
      ...current.data.entries
        .map((entry) => entry.location.value)
        .filter((value): value is string => Boolean(value)),
      instruction,
    ].join(" ");

    const context = await loadCaptureContext(
      deps.context,
      { userId: snapshot.userId },
      {
        anchorAt: snapshot.anchorAt,
        anchorIsForward: snapshot.anchorIsForward,
        text: contextText,
      },
    );

    const userParts = buildCaptureEditUserParts({
      context,
      currentDraft: current.data,
      instruction,
      now: now(),
    });
    const responseFormat: OpenRouterResponseFormat =
      models.responseFormat === "json_schema"
        ? {
            type: "json_schema",
            name: "capture_draft",
            schema: captureDraftJsonSchema(),
          }
        : { type: "json_object" };

    const usage: Usage = {
      model: null,
      tokensIn: null,
      tokensOut: null,
    };

    const attempt = async (model: string): Promise<Attempt> => {
      const response = await deps.openrouter.chat({
        model,
        systemPrompt: CAPTURE_EDIT_SYSTEM_PROMPT,
        userParts,
        responseFormat,
      });
      if (!response.ok) {
        return {
          kind: "infra",
          code: response.code,
          retryable: response.retryable,
          notConfigured: response.code === "OPENROUTER_NOT_CONFIGURED",
        };
      }
      addUsage(usage, response);
      const parsed = parseCaptureDraft(response.content);
      return parsed.ok
        ? { kind: "parsed", draft: parsed.draft }
        : { kind: "invalid" };
    };

    let result = await attempt(models.fast);
    if (
      result.kind === "invalid" ||
      (result.kind === "infra" && result.retryable)
    ) {
      result = await attempt(models.fast);
    }

    let escalated = false;
    const escalationCodes: string[] = [];
    if (result.kind === "infra") {
      if (result.notConfigured) {
        return { ok: false, code: "CAPTURE_MODEL_NOT_CONFIGURED" };
      }
      if (result.code !== "OPENROUTER_BAD_RESPONSE" || !models.strong) {
        return { ok: false, code: "OPENROUTER_FAILED" };
      }
      escalated = true;
      escalationCodes.push(RULE_CODES.escalateBadResponse);
      result = await attempt(models.strong);
      if (result.kind === "infra") {
        return { ok: false, code: "OPENROUTER_FAILED" };
      }
      if (result.kind === "invalid") {
        return { ok: false, code: "INVALID_MODEL_OUTPUT" };
      }
    } else if (result.kind === "invalid") {
      if (!models.strong) {
        return { ok: false, code: "INVALID_MODEL_OUTPUT" };
      }
      escalated = true;
      escalationCodes.push(RULE_CODES.escalateInvalidJson);
      result = await attempt(models.strong);
      if (result.kind === "infra") {
        return { ok: false, code: "OPENROUTER_FAILED" };
      }
      if (result.kind === "invalid") {
        return { ok: false, code: "INVALID_MODEL_OUTPUT" };
      }
    }

    if (result.draft.intent !== current.data.intent) {
      return { ok: false, code: "EDIT_INTENT_CHANGED" };
    }

    const rules = applyPostLlmRules(result.draft, context);
    const ruleCodes = [...escalationCodes, ...rules.ruleCodes];
    let duplicates: DuplicateMatch[] = [];
    if (rules.draft.intent === "CREATE") {
      for (const entry of rules.draft.entries) {
        duplicates = duplicates.concat(
          await findPlanDuplicates(
            { db: deps.db },
            { userId: snapshot.userId },
            entry,
            context.timeZone,
          ),
        );
      }
      if (duplicates.length > 0) {
        ruleCodes.push(RULE_CODES.duplicateFound);
      }
    }

    return {
      ok: true,
      draft: rules.draft,
      ruleCodes: [...new Set(ruleCodes)],
      escalated,
      usage,
    };
  }

  async function processEdit(
    snapshot: EditSnapshot,
    capture: ParsedCapture,
  ): Promise<void> {
    if (!capture.text) return;

    try {
      await deps.notifier.typing(capture.chatId);
      const result = await runModel(snapshot, capture.text);
      if (!result.ok) {
        safeLog(result.code, snapshot.id, snapshot.userId);
        await deps.notifier.reply(
          capture.chatId,
          "Не получилось применить правку. Нажмите «Изменить» и попробуйте ещё раз.",
        );
        return;
      }

      const preserved = snapshot.ruleCodes.filter((code) =>
        PRESERVED_INTAKE_RULES.has(code),
      );
      const updated = await deps.db.inboxItem.updateMany({
        where: {
          id: snapshot.id,
          userId: snapshot.userId,
          status: "DRAFT_READY",
          draftVersion: snapshot.draftVersion,
        },
        data: {
          draft: result.draft as unknown as Prisma.InputJsonValue,
          draftVersion: { increment: 1 },
          editCount: { increment: 1 },
          intent: result.draft.intent,
          ruleCodes: [...new Set([...preserved, ...result.ruleCodes])],
          escalated: snapshot.escalated || result.escalated,
          model: result.usage.model ?? undefined,
          tokensIn: sumUsage(snapshot.tokensIn, result.usage.tokensIn),
          tokensOut: sumUsage(snapshot.tokensOut, result.usage.tokensOut),
          error: null,
          processedAt: now(),
        },
      });

      if (updated.count !== 1) {
        safeLog("EDIT_CAS_LOST", snapshot.id, snapshot.userId);
        return;
      }

      await deps.presenter.present(snapshot.id);
    } catch {
      safeLog("EDIT_PROCESSOR_ERROR", snapshot.id, snapshot.userId);
      await deps.notifier.reply(
        capture.chatId,
        "Не получилось применить правку. Нажмите «Изменить» и попробуйте ещё раз.",
      );
    }
  }

  return {
    async tryReceive(
      owner: PlanOwner,
      environment: TelegramEnvironment,
      capture: ParsedCapture,
    ): Promise<CaptureEditIntakeResult | null> {
      if (
        capture.partKind !== "TEXT" ||
        !capture.text ||
        capture.mediaGroupId
      ) {
        return null;
      }

      const alreadyReceived = await deps.db.inboxItemPart.findUnique({
        where: {
          environment_telegramUpdateId: {
            environment,
            telegramUpdateId: BigInt(capture.updateId),
          },
        },
        select: { id: true },
      });
      if (alreadyReceived) {
        return { handled: true, afterResponse: null };
      }

      const active = await findActive(owner, environment, capture);
      if (!active) return null;

      if (capture.text.length > CAPTURE_LIMITS.maxTextChars) {
        await deps.notifier.reply(
          capture.chatId,
          CAPTURE_REPLIES.textTooLong,
        );
        return { handled: true, afterResponse: null };
      }

      const snapshot = await claim(owner, environment, capture);
      if (snapshot === "duplicate") {
        return { handled: true, afterResponse: null };
      }
      if (!snapshot) return null;

      return {
        handled: true,
        afterResponse: () => processEdit(snapshot, capture),
      };
    },
  };
}

export type CaptureEditService = ReturnType<
  typeof createCaptureEditService
>;
