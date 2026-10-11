import { Prisma, type PrismaClient } from "@prisma/client";
import type { PlanOwner } from "@/server/services/planOwner";
import { childScopeFor } from "@/server/family/familyAccess";
import {
  createFromDraft,
  discardInboxDraft,
  PlanEntryError,
} from "@/server/services/planEntry.service";
import type { DecodedCallback } from "./callbackCodec";
import { CaptureDraftSchema } from "./captureDraft.schema";
import type { ParsedCallback } from "./telegramUpdateParser";
import type { CaptureCardPresenter } from "./captureCardPresenter";
import {
  CAPTURE_REPLACE_TEXT_RULE,
  CAPTURE_TARGET_ALL_RULE,
  CAPTURE_TARGET_CHILD_RULE,
  CAPTURE_TARGET_ME_RULE,
  CAPTURE_TARGET_RULES,
} from "./captureReplies";

export type CaptureCallbackChannel = {
  answerCallbackQuery(input: {
    callbackQueryId: string;
    text?: string;
    showAlert?: boolean;
  }): Promise<void>;
  editMessageText(input: {
    chatId: string;
    messageId: number;
    text: string;
  }): Promise<void>;
  sendMessage(input: {
    chatId: string;
    text: string;
  }): Promise<{ message_id: number }>;
};

const EDIT_WINDOW_MS = 10 * 60_000;

export function createCaptureCallbackService(deps: {
  db: PrismaClient;
  channel: CaptureCallbackChannel;
  presenter: CaptureCardPresenter;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  async function answer(
    callbackQueryId: string,
    text?: string,
    showAlert = false,
  ): Promise<void> {
    await deps.channel.answerCallbackQuery({
      callbackQueryId,
      text,
      showAlert,
    });
  }

  async function editTerminal(
    parsed: ParsedCallback,
    text: string,
  ): Promise<void> {
    if (parsed.chatId == null || parsed.messageId == null) return;
    await deps.channel.editMessageText({
      chatId: String(parsed.chatId),
      messageId: parsed.messageId,
      text,
    });
  }

  async function selectTarget(
    owner: PlanOwner,
    inboxItemId: string,
    target: { kind: "child"; childId: string } | { kind: "me" | "all" },
  ): Promise<boolean> {
    if (target.kind === "child") {
      const child = await deps.db.child.findFirst({
        where: { id: target.childId, ...(await childScopeFor(owner.userId)) },
        select: { id: true },
      });
      if (!child) return false;
    }

    const item = await deps.db.inboxItem.findFirst({
      where: { id: inboxItemId, userId: owner.userId, status: "DRAFT_READY" },
      select: { draft: true, draftVersion: true, ruleCodes: true },
    });
    if (!item) return false;

    const parsed = CaptureDraftSchema.safeParse(item.draft);
    if (!parsed.success || parsed.data.intent !== "CREATE" || parsed.data.entries.length === 0) return false;

    const draft = structuredClone(parsed.data);
    for (const entry of draft.entries) {
      entry.child.childId = target.kind === "child" ? target.childId : null;
      entry.child.raw = null;
      entry.child.state = target.kind === "child" ? "stated" : "missing";
    }

    const targetCode = target.kind === "child"
      ? CAPTURE_TARGET_CHILD_RULE
      : target.kind === "me" ? CAPTURE_TARGET_ME_RULE : CAPTURE_TARGET_ALL_RULE;
    const updated = await deps.db.inboxItem.updateMany({
      where: {
        id: inboxItemId,
        userId: owner.userId,
        status: "DRAFT_READY",
        draftVersion: item.draftVersion,
      },
      data: {
        draft: draft as unknown as Prisma.InputJsonValue,
        draftVersion: { increment: 1 },
        ruleCodes: [...item.ruleCodes.filter((code) => !CAPTURE_TARGET_RULES.includes(code as typeof CAPTURE_TARGET_RULES[number]) && code !== "CHILD_ASKED"), targetCode],
      },
    });
    if (updated.count !== 1) return false;
    await deps.presenter.present(inboxItemId);
    return true;
  }

  return {
    async handle(
      owner: PlanOwner,
      parsed: ParsedCallback,
      decoded: DecodedCallback,
    ): Promise<void> {
      if (decoded.kind === "requirement_done") {
        await answer(
          parsed.callbackQueryId,
          "Это действие подключим следующим этапом",
        );
        return;
      }

      if (decoded.kind === "inbox_child") {
        const ok = await selectTarget(owner, decoded.inboxItemId, { kind: "child", childId: decoded.childId });
        await answer(
          parsed.callbackQueryId,
          ok ? "Готово" : "Черновик уже недоступен",
          !ok,
        );
        return;
      }

      if (decoded.kind === "inbox_target") {
        const ok = await selectTarget(owner, decoded.inboxItemId, { kind: decoded.target });
        await answer(parsed.callbackQueryId, ok ? "Готово" : "Черновик уже недоступен", !ok);
        return;
      }

      const { action, inboxItemId } = decoded;

      if (action === "add" || action === "dup") {
        try {
          const result = await createFromDraft(owner, inboxItemId, {
            allowDuplicate: action === "dup",
          });
          if (result.status === "created") {
            await answer(parsed.callbackQueryId, "Добавлено в план");
            await editTerminal(parsed, "✅ Добавлено в план");
          } else {
            await answer(parsed.callbackQueryId, "Уже обработано");
          }
        } catch (error) {
          const duplicate =
            error instanceof PlanEntryError &&
            error.code === "DUPLICATE_REQUIRES_CONFIRMATION";
          const needsTarget =
            error instanceof PlanEntryError && error.code === "TARGET_NOT_SELECTED";
          await answer(
            parsed.callbackQueryId,
            needsTarget ? "Сначала выберите: Я, ребёнок или Для всех" : duplicate ? "Похоже, это уже в плане" : "Не удалось добавить",
            true,
          );
        }
        return;
      }

      if (action === "no") {
        const status = await discardInboxDraft(owner, inboxItemId);
        await answer(
          parsed.callbackQueryId,
          status === "discarded" ? "Пропущено" : "Уже обработано",
        );
        if (status === "discarded") {
          await editTerminal(parsed, "Пропущено");
        }
        return;
      }

      if (action === "edit" || action === "replace") {
        const item = await deps.db.inboxItem.findFirst({
          where: {
            id: inboxItemId,
            userId: owner.userId,
            status: "DRAFT_READY",
          },
          select: { draftVersion: true, ruleCodes: true },
        });
        const until = new Date(now().getTime() + EDIT_WINDOW_MS);
        const nextRuleCodes = item?.ruleCodes.filter((code) => code !== CAPTURE_REPLACE_TEXT_RULE) ?? [];
        if (action === "replace") nextRuleCodes.push(CAPTURE_REPLACE_TEXT_RULE);
        const updated = item
          ? await deps.db.inboxItem.updateMany({
              where: {
                id: inboxItemId,
                userId: owner.userId,
                status: "DRAFT_READY",
                draftVersion: item.draftVersion,
              },
              data: { awaitingEditUntil: until, ruleCodes: nextRuleCodes },
            })
          : { count: 0 };

        if (updated.count !== 1) {
          await answer(parsed.callbackQueryId, "Черновик уже недоступен", true);
          return;
        }

        await answer(
          parsed.callbackQueryId,
          action === "replace" ? "Ожидаю исправленный текст" : "Напишите, что изменить",
        );
        if (parsed.chatId != null) {
          await deps.channel.sendMessage({
            chatId: String(parsed.chatId),
            text: action === "replace"
              ? "Отправьте правильное описание события целиком одним текстовым сообщением. Я распознаю его заново вместо скриншота."
              : "Напишите изменение, например: «перенеси на 19:00» или «это для Стёпы». Для полной замены используйте «Исправить текст».",
          });
        }
        return;
      }

      await answer(
        parsed.callbackQueryId,
        "Это действие подключим следующим этапом",
      );
    },
  };
}

export type CaptureCallbackService = ReturnType<
  typeof createCaptureCallbackService
>;
