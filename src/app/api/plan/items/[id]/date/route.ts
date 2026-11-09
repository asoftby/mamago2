import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { moveLinkedPlanEntry, parseMoveRequest, PlanEntryMoveError } from "@/server/services/planEntryMove.service";

/**
 * PATCH /api/plan/items/:id/date { date, expectedUpdatedAt } — «Перенести» for an entry that points at a place, an
 * offer or a route (events move through their sessions, notes through /api/plan/manual). Signed-in users, 30 a minute.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const parsed = parseMoveRequest(body);
    const limit = await checkRateLimit(`plan-entry-move:${user.id}`, 30, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
    const { id } = await ctx.params;
    const moved = await moveLinkedPlanEntry(user.id, id, parsed);
    return NextResponse.json({ item: moved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PlanEntryMoveError) return NextResponse.json({ code: error.code }, { status: error.status });
    console.error("[PATCH /api/plan/items/:id/date]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
