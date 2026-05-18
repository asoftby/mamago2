import { NextRequest, NextResponse } from "next/server";
import { runPlanTomorrowDigests } from "@/server/notifications/jobs/run-plan-tomorrow-digests";

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

    const result = await runPlanTomorrowDigests();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[CRON] plan tomorrow digests failed", error);
    return NextResponse.json({ error: "Plan tomorrow digests failed" }, { status: 500 });
  }
}
