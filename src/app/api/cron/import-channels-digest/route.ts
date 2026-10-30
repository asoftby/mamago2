import { NextRequest, NextResponse } from "next/server";
import { runChannelsDigest } from "@/server/modules/import/services/import-channels-digest.service";

/**
 * Суточная сводка по Telegram-каналам. Вызывается общим планировщиком
 * уведомлений каждые 5 минут; сама отправляет не чаще раза в сутки после
 * 09:00 по Минску и только если есть что сказать.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret?.trim()) {
        return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (cronSecret?.trim() && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runChannelsDigest();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[CRON] import channels digest failed", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Import channels digest failed" }, { status: 500 });
  }
}
