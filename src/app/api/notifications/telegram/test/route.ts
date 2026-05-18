/**
 * POST /api/notifications/telegram/test
 * 
 * Отправляет тестовое Telegram-уведомление текущему пользователю.
 * Используется для проверки подключения Telegram.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";

export const runtime = "nodejs";

export async function POST() {
  try {
    // 1. Проверить аутентификацию
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // 2. Проверить активное Telegram подключение
    const connection = await getActiveTelegramConnectionForCurrentEnvironment(user.id);
    
    if (!connection?.isActive) {
      return NextResponse.json(
        { ok: false, code: "TELEGRAM_NOT_CONNECTED" },
        { status: 400 }
      );
    }

    // 3. Отправить тестовое сообщение
    const channel = new TelegramChannel();
    
    try {
      await channel.sendMessage({
        chatId: connection.telegramChatId,
        text: "✅ Тестовое уведомление mamaGo. Telegram подключён и работает.",
      });
    } catch (error) {
      console.error("[telegram:test] Failed to send test message:", error);
      
      // Проверяем, настроен ли бот
      if (error instanceof Error && error.message.includes("bot token")) {
        return NextResponse.json(
          { ok: false, code: "TELEGRAM_BOT_NOT_CONFIGURED" },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { ok: false, code: "TELEGRAM_SEND_FAILED" },
        { status: 500 }
      );
    }

    // 4. Успех
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error("[telegram:test] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
