import type { PrismaClient } from "@prisma/client";
import { childScopeFor } from "@/server/family/familyAccess";
import { CaptureDraftSchema } from "./captureDraft.schema";
import { renderCaptureCard, renderChildChoiceCard } from "./captureCard";

export type CaptureCardChannel = {
  sendMessage(input: {
    chatId: string;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  }): Promise<{ message_id: number }>;
  editMessageText(input: {
    chatId: string;
    messageId: number;
    text: string;
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  }): Promise<void>;
};

export function createCaptureCardPresenter(deps: {
  db: PrismaClient;
  channel: CaptureCardChannel;
}) {
  return {
    async present(inboxItemId: string): Promise<void> {
      const item = await deps.db.inboxItem.findUnique({
        where: { id: inboxItemId },
        select: {
          id: true,
          userId: true,
          status: true,
          telegramChatId: true,
          draft: true,
          ruleCodes: true,
          cardMessageId: true,
        },
      });
      if (!item || item.status !== "DRAFT_READY") return;

      const parsed = CaptureDraftSchema.safeParse(item.draft);
      if (!parsed.success) return;

      const children = await deps.db.child.findMany({
        where: await childScopeFor(item.userId),
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      });

      const missingChild = parsed.data.entries.some(
        (entry) => entry.child.childId === null,
      );
      const card =
        item.ruleCodes.includes("CHILD_ASKED") &&
        missingChild &&
        children.length >= 2
          ? renderChildChoiceCard(item.id, children)
          : renderCaptureCard(
              item.id,
              parsed.data,
              item.ruleCodes,
              new Map(
                children.map((child) => [
                  child.id,
                  child.name?.trim() || "Ребёнок",
                ]),
              ),
            );

      const chatId = item.telegramChatId.toString();

      // -1 reserves a pending status send; it is never a real Telegram message.
      if (item.cardMessageId !== null && item.cardMessageId > 0) {
        try {
          await deps.channel.editMessageText({
            chatId,
            messageId: item.cardMessageId,
            text: card.text,
            replyMarkup: card.replyMarkup,
          });
          return;
        } catch {
          // The progress status may have been deleted or become uneditable.
          // Never leave the user with a permanently pending status.
          console.error("[telegram:capture] code=PREVIEW_EDIT_FAILED");
        }
      }

      const sent = await deps.channel.sendMessage({
        chatId,
        text: card.text,
        replyMarkup: card.replyMarkup,
      });

      await deps.db.inboxItem.updateMany({
        where: {
          id: item.id,
          status: "DRAFT_READY",
          cardMessageId: item.cardMessageId,
        },
        data: { cardMessageId: sent.message_id },
      });
    },
  };
}

export type CaptureCardPresenter = ReturnType<
  typeof createCaptureCardPresenter
>;
