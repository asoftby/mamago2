import { NextRequest, NextResponse } from "next/server";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import { consumeBusinessTelegramLink } from "@/server/services/telegram/businessTelegram.service";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const config = getBusinessTelegramConfig();
  if (!config.configured) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expected = createHmac("sha256", "webhook").update(config.webhookSecret).digest();
  const actual = createHmac("sha256", "webhook").update(received).digest();
  if (!timingSafeEqual(expected, actual)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let update: { message?: { text?: string; chat?: { id?: number; type?: string }; from?: { id?: number; username?: string } } };
  try { update = await request.json(); }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
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
