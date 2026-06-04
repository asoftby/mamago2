import { NextRequest, NextResponse } from "next/server";
import { publishDueAdminBroadcasts } from "@/server/services/admin/broadcast.service";

export async function POST(req: NextRequest) {
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

    const result = await publishDueAdminBroadcasts();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CRON] publish due broadcasts failed", error);
    return NextResponse.json({ error: "Publish due broadcasts failed" }, { status: 500 });
  }
}
