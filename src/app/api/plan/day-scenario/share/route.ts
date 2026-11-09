import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";
import { createOrGetShare, parseShareRequest, revokeShares, ShareError } from "@/server/services/dayScenarioEngine/share.service";

/**
 * POST   /api/plan/day-scenario/share?date=YYYY-MM-DD&scope=day|group — the link to a saved «День от mamaGo» (or its
 *        weekend): reuses the open one, else makes a new one. Returns the path `/d/{token}`.
 * DELETE /api/plan/day-scenario/share?date=…&scope=… — closes the open links of that target.
 * Behind DAY_SCENARIO_ENGINE_ENABLED (404 when off, before any database work); signed-in users, 20 a minute.
 */
async function handle(request: NextRequest, action: "create" | "revoke") {
  if (!isDayScenarioEngineEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const { date, scope } = parseShareRequest(request.nextUrl.searchParams.get("date"), request.nextUrl.searchParams.get("scope"));
    const limit = await checkRateLimit(`day-scenario-share:${user.id}`, 20, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
    const body = action === "create" ? { path: `/d/${(await createOrGetShare(user.id, date, scope)).token}` } : await revokeShares(user.id, date, scope);
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ShareError) return NextResponse.json({ code: error.code }, { status: error.status });
    console.error("[day-scenario share]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = (request: NextRequest) => handle(request, "create");
export const DELETE = (request: NextRequest) => handle(request, "revoke");
