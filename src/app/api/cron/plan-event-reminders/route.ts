import { NextRequest, NextResponse } from "next/server";
import { runPlanEventReminders } from "@/server/notifications/jobs/run-plan-event-reminders";

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

    const result = await runPlanEventReminders();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[CRON] plan event reminders failed", error);
    return NextResponse.json({ error: "Plan event reminders failed" }, { status: 500 });
  }
}
