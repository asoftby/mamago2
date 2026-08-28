import "server-only";

import {
  confirmDevBusinessApplication,
  getDevBusinessApplication,
  rejectDevBusinessApplication,
} from "@/server/services/telegram/devTelegramBusinessApplication.service";
import { consumeTelegramLinkToken } from "@/server/services/telegramLink.service";
import { initializeTelegramPlanNotificationPreferences } from "@/server/services/telegram/telegramNotificationBootstrap.service";
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

    // Dev logging: received message
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] handleMessage chatId=%s from_id=%s text=%s",
        chatId, message.from?.id ?? "unknown", text ?? "(no text)");
    }

    // Not a /start command at all — ignore silently
    if (!text?.startsWith("/start")) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[telegram:webhook] Not a /start command, ignoring");
      }
      return;
    }

    // Extract optional payload after /start
    const parts = text.split(/\s+/, 2);
    const payload = parts[1]?.trim() || null;

    // Dev logging: extracted payload
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] /start command detected - payload=%s", payload ?? "(none)");
    }

    // Plain /start without link token — greet and explain
    if (!payload || !payload.startsWith("link_")) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[telegram:webhook] Plain /start without link_ payload, sending instructions");
      }
      try {
        await this.channel.sendMessage({
          chatId,
          text: "Откройте ссылку из mamaGo, чтобы подключить Telegram к вашему аккаунту.",
        });
      } catch (e) {
        console.error("[telegram:webhook] Failed to send instructions message", e);
      }
      return;
    }

    const token = payload.slice("link_".length);
    const telegramUserId = String(message.from?.id ?? "");
    const telegramFirstName = message.from?.first_name ?? null;
    const telegramUsername = message.from?.username ?? null;

    // Dev logging: extracted token and user info
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] Extracted link token=%s telegramUserId=%s username=%s firstName=%s",
        token, telegramUserId, telegramUsername ?? "(none)", telegramFirstName ?? "(none)");
    }

    if (!telegramUserId) {
      console.error("[telegram:webhook] ERROR: No telegramUserId in message.from");
      try {
        await this.channel.sendMessage({
          chatId,
          text: "Не удалось определить ваш Telegram-профиль. Попробуйте ещё раз.",
        });
      } catch (e) {
        console.error("[telegram:webhook] Failed to send profile error message", e);
      }
      return;
    }

    // Dev logging: calling consumeTelegramLinkToken
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] Calling consumeTelegramLinkToken with token=%s", token);
    }

    const result = await consumeTelegramLinkToken({
      token,
      telegramUserId,
      telegramChatId: chatId,
      telegramUsername,
      telegramFirstName,
    });

    if (result.ok) {
      try {
        await initializeTelegramPlanNotificationPreferences(result.userId);
      } catch (error) {
        // The Telegram connection itself is already valid. Keep the link and surface
        // the bootstrap failure in logs rather than turning a successful /start into
        // a misleading expired-token response on Telegram retry.
        console.error(
          "[telegram:webhook] Failed to initialize plan Telegram preferences userId=%s",
          result.userId,
          error,
        );
      }
    }

    // Dev logging: result
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] consumeTelegramLinkToken result: ok=%s reason=%s userId=%s",
        result.ok, result.ok ? "success" : (result as { reason: string }).reason, result.ok ? result.userId : "n/a");
    }

    try {
      await this.channel.sendMessage({
        chatId,
        text: result.ok
          ? "✅ Telegram подключён к mamaGo для текущей среды."
          : "Ссылка устарела или уже использована. Запросите новую в настройках уведомлений.",
      });
    } catch (e) {
      console.error("[telegram:webhook] Failed to send reply after link attempt", e);
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
