import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[telegram:status] Unauthorized request");
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:status] Checking status for userId=%s", user.id);
    }

    const status = await getTelegramLinkStatus({ userId: user.id });
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[telegram:status] Status for userId=%s: linked=%s username=%s environment=%s",
        user.id, status.linked, status.username ?? "(none)", status.environment);
    }
    
    return NextResponse.json(status);
  } catch (error) {
    console.error("[telegram:status] ERROR:", error);
    return NextResponse.json({ error: "Не удалось загрузить статус Telegram" }, { status: 500 });
  }
}
