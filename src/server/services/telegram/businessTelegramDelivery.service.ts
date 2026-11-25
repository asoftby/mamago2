import "server-only";
import { TELEGRAM_REQUEST_TIMEOUT_MS } from "./telegramRequestTimeout";

import { prismaBase } from "@/lib/prisma";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";

/**
 * Business messages are opt-in and isolated from Info Bot. When routing is
 * enabled and a recipient has an active business connection, never silently
 * fall back to the family bot on failure.
 */
export function businessTelegramDeliveryEnabled(): boolean {
  return process.env.TELEGRAM_BUSINESS_DELIVERY_ENABLED === "true";
}

export async function getActiveBusinessTelegramRecipient(userId: string, expectedBusinessId?: string) {
  const config = getBusinessTelegramConfig();
  if (!businessTelegramDeliveryEnabled() || !config.configured) return null;
  const connection = await prismaBase.businessTelegramConnection.findUnique({
    where: { userId_environment: { userId, environment: config.environment } },
  });
  if (!connection?.isActive || connection.botUsername !== config.botUsername) return null;
  // One Telegram connection can belong to another business of this user.
  // Never deliver a booking notice to the wrong business chat.
  if (expectedBusinessId && connection.businessId !== expectedBusinessId) return null;

  // Authorization is checked at delivery time, including revocations.
  const membership = await prismaBase.businessMember.findFirst({
    where: { businessId: connection.businessId, userId, isActive: true,
      role: { in: ["OWNER", "MANAGER"] },
      business: { operationalStatus: "ACTIVE" } },
    select: { id: true },
  });
  // Legacy owner relationships may predate BusinessMember backfill.
  // Retain exact owner authorization without granting access to other staff.
  if (!membership) {
    const business = await prismaBase.business.findFirst({
      where: {
        id: connection.businessId,
        ownerUserId: userId,
        operationalStatus: "ACTIVE",
      },
      select: { id: true },
    });
    if (!business) return null;
  }
  return { chatId: connection.telegramChatId, businessId: connection.businessId };
}

export async function sendBusinessTelegramMessage(params: {
  chatId: string;
  text: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };
  parseMode?: "HTML";
}): Promise<void> {
  const config = getBusinessTelegramConfig();
  if (!businessTelegramDeliveryEnabled() || !config.configured) {
    throw new Error("BUSINESS_TELEGRAM_DELIVERY_DISABLED");
  }
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    signal: AbortSignal.timeout(TELEGRAM_REQUEST_TIMEOUT_MS), cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
      ...(params.parseMode ? { parse_mode: params.parseMode } : {}),
    }),
  });
  if (!response.ok) throw new Error(`BUSINESS_TELEGRAM_HTTP_${response.status}`);
  const body = await response.json() as { ok?: boolean };
  if (!body.ok) throw new Error("BUSINESS_TELEGRAM_API_ERROR");
}
