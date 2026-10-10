import "server-only";

import type { TelegramEnvironment } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { TelegramReplyMarkup } from "./TelegramChannel";

export const WELCOME_FULL_TEXT = [
  "✅ Telegram подключён к mamaGo. Привет! 👋",
  "",
  "📌 <b>Помогаю семье ничего не забывать.</b>",
  "Перешлите сообщение из чата садика, школы или секции, отправьте скриншот или просто напишите своими словами, что нужно запланировать. Я найду дату, время и важные детали, затем покажу всё на проверку. В «Мой план» добавлю только после вашего подтверждения.",
  "",
  "⏰ <b>Напомню вовремя.</b>",
  "Перед событием пришлю напоминание, а заранее подскажу, что взять с собой или оплатить.",
  "",
  "✨ <b>Скоро: подборки для вашей семьи.</b>",
  "Когда лучше пойму, что вам интересно, буду присылать идеи, куда сходить.",
  "",
  "🔒 Текст пересланного сообщения удаляется, как только вы добавите карточку в план или откажетесь от неё (в любом случае не позже чем через 7 дней).",
  "",
  "Попробуйте прямо сейчас: перешлите сообщение или напишите, например: «Добавь плавание в субботу в 11:00».",
].join("\n");

export const WELCOME_SHORT_TEXT = [
  "✅ Telegram подключён к mamaGo. Привет! 👋",
  "",
  "⏰ Буду присылать напоминания о событиях из вашего плана, чтобы вы ничего не пропустили.",
  "",
  "✨ <b>Скоро: подборки для вашей семьи.</b> Когда лучше пойму, что вам интересно, буду присылать идеи, куда сходить.",
].join("\n");

/** Re-link of a connection that already got its welcome. */
export const RELINKED_TEXT = "✅ Telegram подключён к mamaGo.";

/** /start from a connected user who has already seen the welcome. */
export const ALREADY_CONNECTED_TEXT = "Я на связи 👋";

export const OPEN_PLAN_BUTTON_TEXT = "Открыть Мой план";

export function welcomeTextFor(captureEnabled: boolean): string {
  return captureEnabled ? WELCOME_FULL_TEXT : WELCOME_SHORT_TEXT;
}

/**
 * Inline link button to /me/plan. Telegram rejects the whole message when a
 * button URL is not a public https URL (local DEV origins), so the button is
 * left out in that case instead of losing the text.
 */
export function openPlanReplyMarkup(baseUrl: string = getCanonicalPublicAppUrl()): TelegramReplyMarkup | undefined {
  let url: URL;
  try {
    url = new URL("/me/plan", baseUrl);
  } catch {
    return undefined;
  }
  const host = url.hostname;
  const isLocal = host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || host === "127.0.0.1";
  if (url.protocol !== "https:" || isLocal) return undefined;
  return { inline_keyboard: [[{ text: OPEN_PLAN_BUTTON_TEXT, url: url.toString() }]] };
}

/** Persistence for "welcome sent once"; injectable for tests. */
export type WelcomeStore = {
  /** True only for the caller that flipped welcomeSentAt from NULL (compare-and-set). */
  claim: (connectionId: string, at: Date) => Promise<boolean>;
  /** Undo a claim after a failed send, but only if nobody changed it since. */
  release: (connectionId: string, at: Date) => Promise<void>;
  findByUser: (userId: string, environment: TelegramEnvironment) => Promise<{ id: string } | null>;
};

export function createPrismaWelcomeStore(): WelcomeStore {
  return {
    async claim(connectionId, at) {
      const result = await prismaBase.telegramConnection.updateMany({
        where: { id: connectionId, welcomeSentAt: null },
        data: { welcomeSentAt: at },
      });
      return result.count === 1;
    },
    async release(connectionId, at) {
      await prismaBase.telegramConnection.updateMany({
        where: { id: connectionId, welcomeSentAt: at },
        data: { welcomeSentAt: null },
      });
    },
    findByUser(userId, environment) {
      return prismaBase.telegramConnection.findUnique({
        where: { userId_environment: { userId, environment } },
        select: { id: true },
      });
    },
  };
}
