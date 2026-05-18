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

  // Production guard: webhook secret is mandatory in production
  if (process.env.NODE_ENV === "production" && !config.webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  // Validate webhook secret when configured
  if (config.webhookSecret) {
    const incoming = request.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== config.webhookSecret) {
      console.error("[telegram:webhook] ERROR: Invalid webhook secret");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    console.error("[telegram:webhook] ERROR: Invalid JSON in request body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update = rawBody as TelegramUpdate;

  // Dev logging: incoming update
  if (process.env.NODE_ENV !== "production") {
    const msg = update.message;
    const updateId = (rawBody as Record<string, unknown>).update_id ?? "?";
    const updateType = msg ? "message" : update.callback_query ? "callback_query" : "unknown";
    const text = msg?.text ?? "(none)";
    const chatId = msg?.chat?.id ?? "?";
    
    console.log("[telegram:webhook] Received update_id=%s type=%s text=%s chatId=%s",
      updateId, updateType, text, chatId);
  }

  try {
    const service = new TelegramWebhookService();
    await service.handleUpdate(update);
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] Update processed successfully");
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram:webhook] ERROR: Failed to process update", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
