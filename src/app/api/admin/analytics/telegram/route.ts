import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/server";
import { getTelegramFamilyAnalytics } from "@/server/services/analytics/telegramAnalytics.service";
import type { TelegramAnalyticsPeriod } from "@/lib/analytics/telegramAnalyticsTypes";

export async function GET(request: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);
    const input = request.nextUrl.searchParams.get("period");
    const period: TelegramAnalyticsPeriod =
      input === "today" || input === "7d" || input === "30d" ? input : "7d";
    const data = await getTelegramFamilyAnalytics(period);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("NEXT_REDIRECT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "Insufficient permissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/analytics/telegram failed", error);
    return NextResponse.json({ error: "Не удалось загрузить аналитику Telegram" }, { status: 500 });
  }
}
