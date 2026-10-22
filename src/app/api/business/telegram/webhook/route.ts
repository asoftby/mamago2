import { NextRequest, NextResponse } from "next/server";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import { consumeBusinessTelegramLink } from "@/server/services/telegram/businessTelegram.service";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prismaBase } from "@/lib/prisma";
import { handlePartyTelegramConfirmation } from "@/server/birthday/partyTelegramConfirmAction.service";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = getBusinessTelegramConfig();
  if (!config.configured) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expected = createHmac("sha256", "webhook").update(config.webhookSecret).digest();
  const actual = createHmac("sha256", "webhook").update(received).digest();
  if (!timingSafeEqual(expected, actual)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let update: { message?: { text?: string; chat?: { id?: number; type?: string }; from?: { id?: number; username?: string } }; callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { chat?: { id?: number; type?: string } } } };
  try { update = await request.json(); }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const callback = update?.callback_query;
  if (callback) {
    const chat = callback.message?.chat;
    const callbackId = callback.id ?? "";
    const chatId = chat?.id != null ? String(chat.id) : "";
    const telegramUserId = callback.from?.id != null ? String(callback.from.id) : "";
    let answer = "Действие недоступно. Откройте бизнес-кабинет.";
    if (chat?.type === "private" && callback.data?.startsWith("pc1:")) {
      try {
        const result = await handlePartyTelegramConfirmation({
          callbackData: callback.data, chatId, telegramUserId,
          callbackQueryId: callbackId, secret: config.webhookSecret,
          resolveBusinessBotActor: async (telegramId, telegramChatId) => {
            const connection = await prismaBase.businessTelegramConnection.findFirst({
              where: { environment: config.environment, telegramUserId: telegramId,
                telegramChatId, isActive: true,
                business: { operationalStatus: "ACTIVE" } },
              select: { userId: true, businessId: true },
            });
            return connection ? { userId: connection.userId, businessId: connection.businessId } : null;
          },
        });
        answer = result.ok ? "Заявка подтверждена." :
          result.reason === "STALE_REQUEST" ? "Заявка уже изменилась. Откройте бизнес-кабинет." : answer;
      } catch (error) {
        console.error("[business-telegram] Confirmation failed", error);
      }
    }
    if (callbackId) {
      const ack = await fetch(`https://api.telegram.org/bot${config.botToken}/answerCallbackQuery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId, text: answer, show_alert: true }),
        cache: "no-store",
      });
      if (!ack.ok) console.error("[business-telegram] Callback acknowledgement failed");
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
