import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { listPlanSuggestionsForCity } from "@/server/services/planSuggestions.service";

/**
 * GET /api/plan/suggestions?city=minsk&date=YYYY-MM-DD&exclude=id1,id2&ageRanges=1-3,3-5
 * Стартовые варианты для «Мой план» (город + публичные события), без «ИИ-сценария».
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const citySlug = searchParams.get("city") ?? "minsk";
    const date = searchParams.get("date") ?? undefined;
    const excludeParam =
      searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];
    const ageRangesParam =
      searchParams.get("ageRanges")?.split(",").filter(Boolean) ?? [];

    const plannedIds =
      date != null
        ? (
            await prisma.planItem.findMany({
              where: {
                userId: user.id,
                date,
                activityId: { not: null },
              },
              select: { activityId: true },
            })
          )
            .map((p) => p.activityId)
            .filter((id): id is string => Boolean(id))
        : [];

    const excludeActivityIds = [...new Set([...excludeParam, ...plannedIds])];

    const activities = await listPlanSuggestionsForCity({
      citySlug,
      excludeActivityIds,
      take: 6,
      ...(ageRangesParam.length > 0
        ? { ageRangeValues: ageRangesParam }
        : {}),
    });

    return NextResponse.json({ suggestions: activities });
  } catch (error) {
    console.error("Plan suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
