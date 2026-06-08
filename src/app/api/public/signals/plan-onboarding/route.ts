import { NextRequest, NextResponse } from "next/server";
import { isSignalUsageType } from "@/lib/signals/signalUsageType";
import {
  getPlanOnboardingSignals,
  getSignalsByUsageType,
} from "@/server/signals/getSignalsByUsageType";

export const runtime = "nodejs";

/**
 * GET /api/public/signals/plan-onboarding
 *
 * Query:
 * - type: PLAN_ADULT_PREFERENCE | PLAN_LEISURE_FORMAT — один набор chips
 * - resolveIds: comma-separated signal ids — titles для summary
 * - limit: max chips (default 12)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const limitRaw = parseInt(searchParams.get("limit") ?? "12", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 24) : 12;
    const resolveIds = (searchParams.get("resolveIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (type) {
      if (!isSignalUsageType(type)) {
        return NextResponse.json({ error: "Unknown signal type" }, { status: 400 });
      }
      const signals = await getSignalsByUsageType(type, limit);
      return NextResponse.json({ type, signals });
    }

    const payload = await getPlanOnboardingSignals({ limit, resolveIds });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[public/signals/plan-onboarding]", error);
    return NextResponse.json(
      { preferences: [], formats: [], resolved: [] },
      { status: 200 },
    );
  }
}
