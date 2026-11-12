import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";
import { DaySaveError, saveDayScenarios, saveRequestSchema } from "@/server/services/dayScenarioEngine/save.service";

const KEY_PATTERN = /^[A-Za-z0-9:_-]{8,200}$/;

/**
 * POST /api/plan/day-scenario/save — save one day (or both days of a weekend) of a day-scenario draft into the
 * plan, in one transaction. Behind DAY_SCENARIO_ENGINE_ENABLED (404 when off, before any database work).
 * Needs a signed-in user and an Idempotency-Key header; 10 saves a minute per user.
 */
export async function POST(request: NextRequest) {
  if (!isDayScenarioEngineEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
    if (!KEY_PATTERN.test(idempotencyKey)) return NextResponse.json({ code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const parsed = saveRequestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ code: "INVALID_PAYLOAD", details: parsed.error.flatten() }, { status: 400 });

    const limit = await checkRateLimit(`day-scenario-save:${user.id}`, 10, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });

    const response = await saveDayScenarios(user.id, parsed.data, idempotencyKey);
    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof DaySaveError) return NextResponse.json({ code: error.code, details: error.details }, { status: error.status });
    console.error("[POST /api/plan/day-scenario/save]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
