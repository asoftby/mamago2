import { NextRequest, NextResponse } from "next/server";

import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { reconcileFeedbackAggregates } from "@/server/services/feedback/feedbackAggregate.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/feedback-aggregates
 * Daily reconcile of star aggregates (ТЗ Feedback 5★, 5.6). Idempotent: it
 * recomputes every rated target in full and reports how many rows drifted.
 */
export async function GET(req: NextRequest) {
  const rejected = authorizeCronRequest(req.headers.get("authorization"));
  if (rejected) return rejected;
  try {
    const result = await reconcileFeedbackAggregates();
    if (result.changed > 0) console.warn(`[CRON] feedback-aggregates drift corrected rows=${result.changed}`);
    return NextResponse.json({ success: true, ...result });
  } catch {
    console.error("[CRON] feedback-aggregates failed code=FEEDBACK_AGGREGATES_FAILED");
    return NextResponse.json({ error: "Feedback aggregates reconcile failed" }, { status: 500 });
  }
}
