import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { unlinkTelegramAccount } from "@/server/services/telegramLink.service";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await unlinkTelegramAccount({ userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось отключить Telegram";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
