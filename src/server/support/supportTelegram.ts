import "server-only";

import { getTelegramConfig } from "@/server/config/telegram.config";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { adminPath } from "@/lib/routing/surface";

const telegramChannel = new TelegramChannel();

/**
 * Best-effort Telegram notification to the support chat. Reuses the existing
 * notification bot (TELEGRAM_BOT_TOKEN_DEV/PROD) but targets a separate
 * SUPPORT_TELEGRAM_CHAT_ID, since this is an operational alert, not a
 * per-user notification delivery (unlike sendTelegramNotification).
 *
 * Never throws — a missing config or a Telegram API failure must not block
 * the caller (the BusinessAccessRequest is already created either way).
 */
export async function notifySupportBusinessAccessRequest(params: {
  requestId: string;
  businessId: string;
  unp: string;
  requesterName: string;
  requesterUserId: string;
  phone?: string | null;
  email?: string | null;
  requesterRole: string;
  comment?: string | null;
}): Promise<{ skipped: boolean }> {
  const chatId = process.env.SUPPORT_TELEGRAM_CHAT_ID?.trim();
  const { botToken } = getTelegramConfig();

  if (!chatId || !botToken) {
    console.warn(
      "[supportTelegram] Skipped — SUPPORT_TELEGRAM_CHAT_ID or bot token not configured",
    );
    return { skipped: true };
  }

  const adminUrl = `${getCanonicalPublicAppUrl()}${adminPath(`/b2b/access-requests/${params.requestId}`)}`;

  const text = [
    "🔐 Запрос доступа к бизнесу",
    "",
    `УНП: ${params.unp}`,
    `Business ID: ${params.businessId}`,
    `Заявитель: ${params.requesterName}`,
    `User ID: ${params.requesterUserId}`,
    `Телефон: ${params.phone ?? "—"}`,
    `Email: ${params.email ?? "—"}`,
    `Роль: ${params.requesterRole}`,
    "",
    "Комментарий:",
    params.comment ?? "—",
    "",
    "Открыть в админке:",
    adminUrl,
  ].join("\n");

  try {
    await telegramChannel.sendMessage({ chatId, text });
  } catch (e) {
    console.error("[supportTelegram] sendMessage failed:", e);
  }

  return { skipped: false };
}
