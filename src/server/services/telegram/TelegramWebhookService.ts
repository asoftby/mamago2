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
import { decodeCallback } from "./capture/callbackCodec";
import { createDefaultCaptureRoutingDeps, type CaptureRoutingDeps } from "./capture/captureWiring";
import { parseTelegramUpdate, type ParsedCapture, type RawTelegramUpdate } from "./capture/telegramUpdateParser";
import { planOwnerWithoutFamily } from "@/server/services/planOwner";
import { renderDevBusinessApplicationMessage } from "./TelegramTemplateRenderer";
import {
  ALREADY_CONNECTED_TEXT,
  RELINKED_TEXT,
  createPrismaWelcomeStore,
  openPlanReplyMarkup,
  welcomeTextFor,
  type WelcomeStore,
} from "./botWelcome";


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
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

/** What the webhook route should do after answering 200. */
export type HandleUpdateResult = {
  afterResponse?: () => Promise<void>;
};

export class TelegramWebhookService {
  private readonly capture: CaptureRoutingDeps;

  private readonly welcomeStore: WelcomeStore;

  constructor(
    private readonly channel = new TelegramChannel(),
    capture?: CaptureRoutingDeps,
    welcomeStore?: WelcomeStore,
  ) {
    this.capture = capture ?? createDefaultCaptureRoutingDeps();
    this.welcomeStore = welcomeStore ?? createPrismaWelcomeStore();
  }

  /** Full text for pilot (capture allowlist) users, short for everyone else. */
  private welcomeText(userId: string): string {
    return welcomeTextFor(this.capture.getAllowlist().has(userId));
  }

  private async sendWelcome(chatId: string, userId: string): Promise<void> {
    await this.channel.sendMessage({
      chatId,
      text: this.welcomeText(userId),
      parseMode: "HTML",
      replyMarkup: openPlanReplyMarkup(),
    });
  }

  /**
   * Sends the welcome at most once per connection: the compare-and-set on
   * welcomeSentAt picks a single winner among parallel /start deliveries.
   * Returns false when someone else already claimed it. A failed send gives
   * the claim back so the next /start can retry.
   */
  private async sendWelcomeOnce(chatId: string, userId: string, connectionId: string): Promise<boolean> {
    const at = new Date();
    if (!(await this.welcomeStore.claim(connectionId, at))) return false;
    try {
      await this.sendWelcome(chatId, userId);
    } catch (e) {
      console.error("[telegram:webhook] Failed to send welcome message", e);
      try {
        await this.welcomeStore.release(connectionId, at);
      } catch (releaseError) {
        console.error("[telegram:webhook] Failed to release welcome claim", releaseError);
      }
    }
    return true;
  }

  private async sendShortReply(chatId: string, text: string): Promise<void> {
    try {
      await this.channel.sendMessage({ chatId, text, replyMarkup: openPlanReplyMarkup() });
    } catch (e) {
      console.error("[telegram:webhook] Failed to send reply", e);
    }
  }

  async handleUpdate(update: TelegramUpdate): Promise<HandleUpdateResult> {
    // The raw payload carries more fields than the narrow legacy type.
    const parsed = parseTelegramUpdate(update as unknown as RawTelegramUpdate);

    if (parsed.kind === "callback") {
      const decoded = decodeCallback(parsed.data);
      if (decoded) {
        if (parsed.chatId == null) {
          await this.capture.acknowledgeCallback(parsed.callbackQueryId);
          return {};
        }

        const chatId = String(parsed.chatId);
        const allowlist = this.capture.getAllowlist();
        const connection =
          allowlist.size > 0
            ? await this.capture.findActiveConnection(chatId)
            : null;

        if (!connection || !allowlist.has(connection.userId)) {
          await this.capture.acknowledgeCallback(parsed.callbackQueryId);
          return {};
        }

        await this.capture.touchConnection(chatId);
        await this.capture.handleCallback(
          planOwnerWithoutFamily(connection.userId),
          parsed,
          decoded,
        );
        return {};
      }
    }

    if (parsed.kind === "capture") {
      const handled = await this.tryCapture(parsed);
      if (handled) return handled;
      // Not enabled / not linked / not allowlisted: behave exactly as before.
    }

    if (update.message) {
      await this.handleMessage(update.message);
      return {};
    }

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
    return {};
  }

  /**
   * Gate: capture runs only for a private chat with an active connection whose
   * userId is on TELEGRAM_CAPTURE_USER_IDS. Returns null when the gate is
   * closed so the caller falls through to the legacy path. An empty allowlist
   * returns before any database access.
   */
  private async tryCapture(parsed: ParsedCapture): Promise<HandleUpdateResult | null> {
    const allowlist = this.capture.getAllowlist();
    if (allowlist.size === 0) return null;

    const chatId = String(parsed.chatId);
    const connection = await this.capture.findActiveConnection(chatId);
    if (!connection || !allowlist.has(connection.userId)) return null;

    await this.capture.touchConnection(chatId);
    const owner = planOwnerWithoutFamily(connection.userId);
    const environment = this.capture.getEnvironment();

    const edit = await this.capture.tryEdit(owner, environment, parsed);
    if (edit) {
      return edit.afterResponse ? { afterResponse: edit.afterResponse } : {};
    }

    const result = await this.capture.receive(owner, environment, parsed);
    return result.afterResponse ? { afterResponse: result.afterResponse } : {};
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    await touchTelegramConnectionByChatIdForCurrentEnvironment(chatId);

    const text = message.text?.trim();

    // Dev logging: received message
    if (process.env.NODE_ENV !== "production") {
      // No chat id, sender id or message text: forwarded messages are user content.
      console.log("[telegram:webhook] handleMessage type=message");
    }

    if (text && /^\/help(?:@\w+)?(?:\s|$)/u.test(text)) {
      await this.handleHelp(chatId);
      return;
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
      console.log("[telegram:webhook] /start command detected - hasPayload=%s", payload !== null);
    }

    // Plain /start without link token: welcome a connected user, otherwise explain
    if (!payload || !payload.startsWith("link_")) {
      const connection = await findTelegramConnectionByChatIdForCurrentEnvironment(chatId);
      if (connection?.isActive) {
        const sent = !connection.welcomeSentAt
          ? await this.sendWelcomeOnce(chatId, connection.userId, connection.id)
          : false;
        if (!sent) await this.sendShortReply(chatId, ALREADY_CONNECTED_TEXT);
        return;
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

    if (!result.ok) {
      await this.sendShortReply(
        chatId,
        "Ссылка устарела или уже использована. Запросите новую в настройках уведомлений.",
      );
      return;
    }

    // The welcome replaces the old one-line confirmation; a re-link of a
    // connection that already got it keeps the short confirmation.
    try {
      const connection = await this.welcomeStore.findByUser(result.userId, this.capture.getEnvironment());
      const welcomed = connection
        ? await this.sendWelcomeOnce(chatId, result.userId, connection.id)
        : false;
      if (!welcomed) await this.sendShortReply(chatId, RELINKED_TEXT);
    } catch (e) {
      console.error("[telegram:webhook] Failed to send reply after link attempt", e);
    }
  }

  /** /help: the welcome text again, any number of times, for a connected chat. */
  private async handleHelp(chatId: string): Promise<void> {
    const connection = await findTelegramConnectionByChatIdForCurrentEnvironment(chatId);
    try {
      if (connection?.isActive) {
        await this.sendWelcome(chatId, connection.userId);
      } else {
        await this.channel.sendMessage({
          chatId,
          text: "Откройте ссылку из mamaGo, чтобы подключить Telegram к вашему аккаунту.",
        });
      }
    } catch (e) {
      console.error("[telegram:webhook] Failed to send help message", e);
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
