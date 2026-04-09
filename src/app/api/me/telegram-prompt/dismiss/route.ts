import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

/**
 * POST — пользователь закрыл soft-prompt; повтор не раньше чем через 7 дней (см. shouldShowTelegramPrompt).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramPromptDismissedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[telegram-prompt/dismiss]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
