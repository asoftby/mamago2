import "server-only";

import {
  confirmDevBusinessApplication,
  getDevBusinessApplication,
  rejectDevBusinessApplication,
} from "@/server/services/telegram/devTelegramBusinessApplication.service";
import { consumeTelegramLinkToken } from "@/server/services/telegramLink.service";
import {
  findTelegramConnectionByChatIdForCurrentEnvironment,
  touchTelegramConnectionByChatIdForCurrentEnvironment,
} from "@/server/services/telegram/telegramConnection.service";
import { TelegramChannel } from "./TelegramChannel";
import { renderDevBusinessApplicationMessage } from "./TelegramTemplateRenderer";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type TelegramChat = {
  id: number;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export class TelegramWebhookService {
  constructor(private readonly channel = new TelegramChannel()) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
      return;
    }

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    await touchTelegramConnectionByChatIdForCurrentEnvironment(chatId);

    const text = message.text?.trim();

    // Not a /start command at all — ignore silently
    if (!text?.startsWith("/start")) {
      return;
    }

    // Extract optional payload after /start
    const parts = text.split(/\s+/, 2);
    const payload = parts[1]?.trim() || null;

    // Diagnostic logging — remove after confirming /start works end-to-end
    if (process.env.NODE_ENV !== "production") {
      console.log("[webhook:diag] handleMessage chat_id=%s text=%s extracted_payload=%s",
        chatId, text, payload ?? "(none — plain /start)");
    }

    // Plain /start without link token — greet and explain
    if (!payload || !payload.startsWith("link_")) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[webhook:diag] /start without link_ → sending instructions to chat_id=%s", chatId);
      }
      try {
        await this.channel.sendMessage({
          chatId,
          text: "Откройте ссылку из mamaGo, чтобы подключить Telegram к вашему аккаунту.",
        });
        if (process.env.NODE_ENV !== "production") {
          console.log("[webhook:diag] sendMessage OK for chat_id=%s", chatId);
        }
      } catch (e) {
        console.error("[telegram webhook] failed to send instructions message", e);
      }
      return;
    }

    const token = payload.slice("link_".length);
    const telegramUserId = String(message.from?.id ?? "");
    const telegramFirstName = message.from?.first_name ?? null;
    const telegramUsername = message.from?.username ?? null;

    if (!telegramUserId) {
      try {
        await this.channel.sendMessage({
          chatId,
          text: "Не удалось определить ваш Telegram-профиль. Попробуйте ещё раз.",
        });
      } catch (e) {
        console.error("[telegram webhook] failed to send profile error message", e);
      }
      return;
    }

    const result = await consumeTelegramLinkToken({
      token,
      telegramUserId,
      telegramChatId: chatId,
      telegramUsername,
      telegramFirstName,
    });

    try {
      await this.channel.sendMessage({
        chatId,
        text: result.ok
          ? "✅ Telegram подключён к mamaGo для текущей среды."
          : "Ссылка устарела или уже использована. Запросите новую в настройках уведомлений.",
      });
    } catch (e) {
      console.error("[telegram webhook] failed to send reply after link attempt", e);
    }
  }

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const data = query.data?.trim();
    const message = query.message;
    const chatId = message ? String(message.chat.id) : null;

    if (chatId) {
      await touchTelegramConnectionByChatIdForCurrentEnvironment(chatId);
    }

    if (!data) {
      try {
        await this.channel.answerCallbackQuery({
          callbackQueryId: query.id,
          text: "Пустое действие",
          showAlert: false,
        });
      } catch (e) {
        console.error("[telegram webhook] failed to answer empty callback query", e);
      }
      return;
    }

    const match = /^application:([^:]+):(confirm|reject)$/u.exec(data);
    if (!match || !message || !chatId) {
      try {
        await this.channel.answerCallbackQuery({
          callbackQueryId: query.id,
          text: "Действие не поддерживается",
          showAlert: true,
        });
      } catch (e) {
        console.error("[telegram webhook] failed to answer unsupported callback query", e);
      }
      return;
    }

    const [, applicationId, action] = match;

    const connection = await findTelegramConnectionByChatIdForCurrentEnvironment(chatId);
    if (!connection?.isActive) {
      try {
        await this.channel.answerCallbackQuery({
          callbackQueryId: query.id,
          text: "Telegram не связан с аккаунтом mamaGo для этой среды",
          showAlert: true,
        });
      } catch (e) {
        console.error("[telegram webhook] failed to answer unlinked callback query", e);
      }
      return;
    }

    const existingApplication = await getDevBusinessApplication(applicationId);
    if (!existingApplication || existingApplication.userId !== connection.userId) {
      try {
        await this.channel.answerCallbackQuery({
          callbackQueryId: query.id,
          text: "Заявка не найдена",
          showAlert: true,
        });
      } catch (e) {
        console.error("[telegram webhook] failed to answer not-found callback query", e);
      }
      return;
    }

    let application;
    try {
      application =
        action === "confirm"
          ? await confirmDevBusinessApplication(applicationId)
          : await rejectDevBusinessApplication(applicationId);
    } catch {
      try {
        await this.channel.answerCallbackQuery({
          callbackQueryId: query.id,
          text: "Заявка не найдена",
          showAlert: true,
        });
      } catch (e) {
        console.error("[telegram webhook] failed to answer error callback query", e);
      }
      return;
    }

    const rendered = renderDevBusinessApplicationMessage(application);

    try {
      await this.channel.editMessageText({
        chatId,
        messageId: message.message_id,
        text: rendered.text,
        replyMarkup: rendered.replyMarkup,
      });
    } catch (e) {
      console.error("[telegram webhook] failed to edit message after application action", e);
    }

    try {
      await this.channel.answerCallbackQuery({
        callbackQueryId: query.id,
        text: action === "confirm" ? "Заявка подтверждена" : "Заявка отклонена",
      });
    } catch (e) {
      console.error("[telegram webhook] failed to answer confirmed callback query", e);
    }
  }
}
