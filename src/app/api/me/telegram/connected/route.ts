import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { markWelcomeNotificationsRead } from "@/server/services/notification.service";

/**
 * POST — Telegram подключён (webhook бота или ручное подтверждение после deep link).
 * Скрывает welcome в UI через user.telegramConnected + помечает WELCOME прочитанными.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramConnected: true,
        telegramPromptDismissedAt: null,
      },
    });

    await markWelcomeNotificationsRead(user.id);

    return NextResponse.json({ ok: true, message: "Telegram подключён ✅" });
  } catch (e) {
    console.error("[telegram/connected]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
