import "server-only";

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

export async function getActiveBusinessTelegramRecipient(userId: string) {
  const config = getBusinessTelegramConfig();
  if (!businessTelegramDeliveryEnabled() || !config.configured) return null;
  const connection = await prismaBase.businessTelegramConnection.findUnique({
    where: { userId_environment: { userId, environment: config.environment } },
  });
  if (!connection?.isActive || connection.botUsername !== config.botUsername) return null;

  // Authorization is checked at delivery time, including revocations.
  const membership = await prismaBase.businessMember.findFirst({
    where: { businessId: connection.businessId, userId, isActive: true,
      role: { in: ["OWNER", "MANAGER"] } },
    select: { id: true },
  });
  if (!membership) return null;
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
    method: "POST", cache: "no-store",
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
