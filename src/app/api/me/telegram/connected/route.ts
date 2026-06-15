import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import { markWelcomeNotificationsRead, completeOnboardingNotification } from "@/server/services/notification.service";

/**
 * POST — legacy helper after deep link.
 * В новой схеме connection хранится в TelegramConnection; тут только синхронизируем welcome UI.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getTelegramLinkStatus({ userId: user.id });
    if (!status.linked) {
      return NextResponse.json({ error: "Telegram is not connected" }, { status: 400 });
    }

    await markWelcomeNotificationsRead(user.id);
    await completeOnboardingNotification(user.id, "CONNECT_TELEGRAM");

    return NextResponse.json({ ok: true, message: "Telegram подключён ✅" });
  } catch (e) {
    console.error("[telegram/connected]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
