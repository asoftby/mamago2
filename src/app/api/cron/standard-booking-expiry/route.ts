import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { expireStandardRequests } from "@/server/services/booking/standardRequestExpiry.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/standard-booking-expiry
 * Moves unanswered STANDARD requests past `responseDueAt` to EXPIRED and
 * notifies the client. Idempotent, bounded batch; counts only in the response.
 */
export async function GET(request: NextRequest) {
  const rejected = authorizeCronRequest(request.headers.get("authorization"));
  if (rejected) return rejected;
  try {
    const result = await expireStandardRequests();
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[CRON] standard-booking-expiry failed");
    return NextResponse.json({ error: "Standard booking expiry failed" }, { status: 500 });
  }
}
