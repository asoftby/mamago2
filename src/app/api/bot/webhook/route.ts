import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig } from "@/server/config/telegram.config";
import { TelegramWebhookService, type TelegramUpdate } from "@/server/services/telegram/TelegramWebhookService";

export const runtime = "nodejs";

/**
 * Canonical Telegram webhook endpoint.
 *
 * Security: validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET_DEV/PROD is set.
 * Register this URL with Telegram via setWebhook, passing the same secret_token.
 */
export async function POST(request: NextRequest) {
  const config = getTelegramConfig();

  // Validate webhook secret when configured
  if (config.webhookSecret) {
    const incoming = request.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== config.webhookSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = rawBody as TelegramUpdate;

  // Diagnostic logging — remove after confirming /start works end-to-end
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const msg = update.message;
    console.log("[webhook:diag] update_id=%s type=%s text=%s chat_id=%s",
      (rawBody as Record<string, unknown>).update_id ?? "?",
      msg ? "message" : update.callback_query ? "callback_query" : "unknown",
      msg?.text ?? "(none)",
      msg?.chat?.id ?? "?",
    );
  }

  try {
    const service = new TelegramWebhookService();
    await service.handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram webhook]", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
