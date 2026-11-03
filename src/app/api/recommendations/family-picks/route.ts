/**
 * GET /api/recommendations/family-picks?city=minsk[&anonymousId=...]
 * Блок «Для вашей семьи»: серверная выдача (жёсткие фильтры, возраст по детям, разнообразие,
 * fallback). Гость получает «Популярное»; авторизованный — персональную выдачу. Каждый ответ с
 * карточками пишется в RecommendationRun/Exposure (exposureId = impressionId).
 */
import { homeFamilyPicksEnabled } from "@/features/city-home/lib/familyHome";
import { resolveHomeRequest } from "@/server/services/recommendations/familyPicks/homeRequest";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { loadFamilyPicks } from "@/server/services/recommendations/familyPicks/load";
import { loadFamilyPicksProfile } from "@/server/services/recommendations/familyPicks/profile";
import { resolveFamilyPicksRequest } from "@/server/services/recommendations/familyPicks/request";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await resolveFamilyPicksRequest(searchParams, {
      getCurrentUser,
      getSessionId: getSessionRowIdFromCookies,
      loadProfile: loadFamilyPicksProfile,
      loadPicks: loadFamilyPicks,
    });
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (error) {
    console.error("[API] GET /api/recommendations/family-picks error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers });
  }
}

/** v2 is explicit, private POST only; legacy GET remains backwards-compatible. */
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
    const user = await getCurrentUser();
    const result = await resolveHomeRequest(await request.json(), user?.id ?? null, await getSessionRowIdFromCookies(), undefined, homeFamilyPicksEnabled(), request.signal);
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "selection_unavailable") return NextResponse.json({ error: "selection_unavailable" }, { status: 404, headers });
    if (error instanceof Error && error.message === "profile_changed") return NextResponse.json({ error: "profile_changed" }, { status: 409, headers });
    console.error("[family-home] request failed", error);
    return NextResponse.json({ error: "home_unavailable" }, { status: 500, headers });
  }
}
