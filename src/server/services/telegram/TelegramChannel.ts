import "server-only";

import { requireTelegramConfig } from "@/server/config/telegram.config";

export type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramReplyMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

type SendMessageInput = {
  chatId: string;
  text: string;
  replyMarkup?: TelegramReplyMarkup;
};

type EditMessageInput = {
  chatId: string;
  messageId: number;
  text: string;
  replyMarkup?: TelegramReplyMarkup;
};

type AnswerCallbackInput = {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
};

type TelegramSendResult = {
  message_id: number;
};

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const config = requireTelegramConfig();
  const url = `https://api.telegram.org/bot${config.botToken}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    // Log the full Telegram error body for diagnostics
    let errorBody = "";
    try { errorBody = await response.text(); } catch { /* ignore */ }
    console.error(`[telegram api] ${method} HTTP ${response.status}: ${errorBody}`);
    throw new Error(`Telegram API ${method} failed with HTTP ${response.status}: ${errorBody}`);
  }

  const json = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok || json.result === undefined) {
    console.error(`[telegram api] ${method} not ok: ${json.description ?? "unknown"}`);
    throw new Error(json.description || `Telegram API ${method} failed`);
  }

  return json.result;
}

export class TelegramChannel {
  async sendMessage(input: SendMessageInput): Promise<TelegramSendResult> {
    return callTelegramApi<TelegramSendResult>("sendMessage", {
      chat_id: input.chatId,
      text: input.text,
      reply_markup: input.replyMarkup,
    });
  }

  async editMessageText(input: EditMessageInput): Promise<void> {
    await callTelegramApi("editMessageText", {
      chat_id: input.chatId,
      message_id: input.messageId,
      text: input.text,
      reply_markup: input.replyMarkup,
    });
  }

  async answerCallbackQuery(input: AnswerCallbackInput): Promise<void> {
    await callTelegramApi("answerCallbackQuery", {
      callback_query_id: input.callbackQueryId,
      text: input.text,
      show_alert: input.showAlert ?? false,
    });
  }
}
