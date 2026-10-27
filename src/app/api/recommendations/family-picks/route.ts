/**
 * GET /api/recommendations/family-picks?city=minsk[&anonymousId=...]
 * Блок «Для вашей семьи»: серверная выдача (жёсткие фильтры, возраст по детям, разнообразие,
 * fallback). Гость получает «Популярное»; авторизованный — персональную выдачу. Каждый ответ с
 * карточками пишется в RecommendationRun/Exposure (exposureId = impressionId).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { parseSafeOpaqueId } from "@/lib/decision/identifiers";
import { loadFamilyPicks } from "@/server/services/recommendations/familyPicks/load";

export const dynamic = "force-dynamic";

const CITY_RE = /^[a-z0-9-]{1,64}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const citySlug = (searchParams.get("city") ?? "minsk").toLowerCase();
    if (!CITY_RE.test(citySlug)) {
      return NextResponse.json({ error: "invalid_city" }, { status: 400 });
    }
    const rawAnonymousId = searchParams.get("anonymousId");
    const anonymousId = rawAnonymousId ? parseSafeOpaqueId(rawAnonymousId) : null;
    if (rawAnonymousId && !anonymousId) {
      return NextResponse.json({ error: "invalid_anonymous_id" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const result = await loadFamilyPicks({
      citySlug,
      userId: user?.id ?? null,
      sessionId: await getSessionRowIdFromCookies(),
      anonymousId,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[API] GET /api/recommendations/family-picks error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
