import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig, requiresTelegramWebhookSecret } from "@/server/config/telegram.config";
import { TelegramWebhookService, type TelegramUpdate } from "@/server/services/telegram/TelegramWebhookService";
import { runAfterResponse } from "@/server/services/telegram/capture/runAfterResponse";

export const runtime = "nodejs";

/**
 * Canonical Telegram webhook endpoint.
 *
 * Security: validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET_DEV/PROD is set.
 * Register this URL with Telegram via setWebhook, passing the same secret_token.
 */
export async function POST(request: NextRequest) {
  const config = getTelegramConfig();

  // Deployed hosts (DEV/staging/PROD) require a webhook secret. Local next dev may omit it.
  if (requiresTelegramWebhookSecret() && !config.webhookSecret) {
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

    // Message text and chat ids are deliberately not logged: forwarded
    // messages are user content (forward-to-plan spec v1.3, section 13).
    console.log("[telegram:webhook] Received update_id=%s type=%s", updateId, updateType);
  }

  try {
    const service = new TelegramWebhookService();
    const result = await service.handleUpdate(update);

    // Parsing/debounce work runs after the 200; the DB write above already happened.
    if (result.afterResponse) runAfterResponse(result.afterResponse);
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:webhook] Update processed successfully");
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram:webhook] ERROR: Failed to process update", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
