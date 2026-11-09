import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";
import { draftRequestSchema, runDayScenarioDraft } from "@/server/services/dayScenarioEngine/draft.service";
import { chargeGuestScenarioDate } from "@/server/services/dayScenarioEngine/guestQuota.service";
import { resolveGuestUsageKey } from "@/server/services/guestPlanQuota";

/**
 * POST /api/plan/day-scenario/draft — build / rebuild / replace a day-scenario draft.
 * Read-only: nothing is written. Behind DAY_SCENARIO_ENGINE_ENABLED (404 when off,
 * before any database work). Limited to 30 requests a minute per user or IP.
 */
export async function POST(request: NextRequest) {
  if (!isDayScenarioEngineEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = draftRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await getCurrentUser();
    const actor = user?.id ?? getTrustedClientIp(request) ?? "anonymous";
    const limit = await checkRateLimit(`day-scenario-draft:${actor}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited", message: "Слишком частые запросы. Подождите минуту." }, { status: 429 });
    }

    // A guest pays for the FIRST build of a date only; variants, replacements and rebuilds are free. Over the allowance:
    // sign in (the answer is the same "requires_auth" the old guest picks gave).
    if (!user && parsed.data.action === "build") {
      const key = resolveGuestUsageKey(parsed.data.anonymousId, getTrustedClientIp(request), request.headers.get("user-agent"));
      if (key) {
        const charge = await chargeGuestScenarioDate(key, parsed.data.date);
        if (!charge.ok) return NextResponse.json({ error: "requires_auth", message: "Войдите или зарегистрируйтесь, чтобы собрать ещё один день." }, { status: 403 });
      }
    }
    const body = await runDayScenarioDraft(parsed.data, user ? { id: user.id } : null);
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[POST /api/plan/day-scenario/draft]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
