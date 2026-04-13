import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getTelegramLinkStatus({ userId: user.id });
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить статус Telegram";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
