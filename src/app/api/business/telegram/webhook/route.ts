import { NextRequest, NextResponse } from "next/server";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import { consumeBusinessTelegramLink } from "@/server/services/telegram/businessTelegram.service";
import { businessTelegramDeliveryEnabled } from "@/server/services/telegram/businessTelegramDelivery.service";
import { handlePartyTelegramConfirmation } from "@/server/birthday/partyTelegramConfirmAction.service";
import { prismaBase } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = getBusinessTelegramConfig();
  if (!config.configured) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expected = createHmac("sha256", "webhook").update(config.webhookSecret).digest();
  const actual = createHmac("sha256", "webhook").update(received).digest();
  if (!timingSafeEqual(expected, actual)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let update: {
    message?: { text?: string; chat?: { id?: number; type?: string }; from?: { id?: number; username?: string } };
    callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { chat?: { id?: number; type?: string } } };
  };
  try { update = await request.json(); }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const callback = update?.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    const chatId = chat?.id != null ? String(chat.id) : "";
    const telegramUserId = callback.from?.id != null ? String(callback.from.id) : "";
    const callbackId = callback.id ?? "";
    let responseText = "Действие недоступно. Откройте бизнес-кабинет.";

    // This opt-in switch gates both delivery and confirmation. Disabling
    // Business Bot prevents old delivered buttons from changing bookings.
    if (businessTelegramDeliveryEnabled() &&
        chat?.type === "private" && callback.data?.startsWith("pc1:")) {
      try {
        const result = await handlePartyTelegramConfirmation({
          callbackData: callback.data,
          chatId, telegramUserId, callbackQueryId: callbackId,
          secret: config.webhookSecret,
          resolveBusinessBotActor: async (telegramId, telegramChatId) => {
            const connection = await prismaBase.businessTelegramConnection.findFirst({
              where: {
                environment: config.environment,
                telegramUserId: telegramId, telegramChatId,
                isActive: true,
                // Business status and OWNER/MANAGER membership are rechecked
                // against BusinessMember by handlePartyTelegramConfirmation.
              },
              select: { userId: true, businessId: true },
            });
            return connection
              ? { userId: connection.userId, businessId: connection.businessId }
              : null;
          },
        });
        responseText = result.ok
          ? "Заявка подтверждена."
          : result.reason === "STALE_REQUEST"
            ? "Заявка уже изменилась. Откройте бизнес-кабинет."
            : responseText;
      } catch {
        // Never expose Telegram identity, signed token or customer details.
        console.error("[business-telegram] Party confirmation callback failed");
      }
    }

    if (callbackId) {
      try {
        const ack = await fetch(`https://api.telegram.org/bot${config.botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackId, text: responseText, show_alert: true,
          }),
          cache: "no-store",
        });
        if (!ack.ok) console.error("[business-telegram] Callback acknowledgement failed");
      } catch {
        console.error("[business-telegram] Callback acknowledgement unavailable");
      }
    }
    return NextResponse.json({ ok: true });
  }

  const msg = update?.message;
  const match = msg?.text?.match(/^\/start business_([a-f0-9]{48})$/);
  if (!match || msg?.chat?.type !== "private" || !msg.chat.id || !msg.from?.id) {
    return NextResponse.json({ ok: true });
  }
  const accepted = await consumeBusinessTelegramLink(match[1], {
    chatId: String(msg.chat.id), telegramUserId: String(msg.from.id), username: msg.from.username,
  });
  // The sender only receives a minimal reply. No link token or internal data enters logs.
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: msg.chat.id, text: accepted
      ? "mamaGo Business подключён. Уведомления компании будут доступны после включения доставки."
      : "Ссылка недействительна или срок её действия истёк. Создайте новую в бизнес-кабинете." }),
    cache: "no-store",
  });
  if (!response.ok) console.error("[business-telegram] Failed to send link confirmation");
  return NextResponse.json({ ok: true });
}
