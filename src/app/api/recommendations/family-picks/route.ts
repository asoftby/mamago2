/**
 * GET /api/recommendations/family-picks?city=minsk[&anonymousId=...]
 * Блок «Для вашей семьи»: серверная выдача (жёсткие фильтры, возраст по детям, разнообразие,
 * fallback). Гость получает «Популярное»; авторизованный — персональную выдачу. Каждый ответ с
 * карточками пишется в RecommendationRun/Exposure (exposureId = impressionId).
 */
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
