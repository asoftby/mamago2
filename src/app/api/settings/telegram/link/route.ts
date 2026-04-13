import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createTelegramLink } from "@/server/services/telegramLink.service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await createTelegramLink({ userId: user.id });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось подготовить подключение Telegram";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
