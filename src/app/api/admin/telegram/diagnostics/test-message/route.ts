import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTelegramRuntimeEnvironment } from "@/server/config/telegram.config";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";

export const runtime = "nodejs";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const limit = checkRateLimit(`admin-tg-test-message:${auth.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подожди минуту и повтори." },
      { status: 429 },
    );
  }

  const connection = await getActiveTelegramConnectionForCurrentEnvironment(auth.id);
  if (!connection?.isActive) {
    return NextResponse.json(
      { error: "Сначала привяжи Telegram к своему аккаунту." },
      { status: 400 },
    );
  }

  const environment = getTelegramRuntimeEnvironment();
  const text = `✅ Тест mamaGo: ${environment}, ${new Date().toISOString()}`;

  try {
    await new TelegramChannel().sendMessage({
      chatId: connection.telegramChatId,
      text,
    });
    return NextResponse.json({ ok: true, sentTo: connection.telegramChatId });
  } catch (error) {
    console.error("[admin:telegram:test-message] failed", error);
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
