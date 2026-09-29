import { NextRequest, NextResponse } from "next/server";
import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { prisma } from "@/lib/prisma";
import { rankPlanSuggestionsForCity } from "@/server/services/planSuggestions.service";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";
import { trackFirstOccurrenceEvent } from "@/server/services/analytics/AnalyticsEventService";
import { SUGGESTIONS_PER_BATCH } from "@/features/my-plan/lib/suggestionsConfig";
import { buildSubjectsSnapshot } from "@/lib/decision/subjects";
import { sanitizeCanonicalAgeRanges } from "@/lib/decision/decisionContext";

/**
 * GET /api/plan/suggestions?city=minsk&date=YYYY-MM-DD&exclude=id1,id2&ageRanges=1-3,3-5&personaIds=...
 * Рекомендации для «Мой план» только для **авторизованных**;
 * гость использует POST /api/plan/generate с anonymousId и квотой на сервере.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint: "Используйте POST /api/plan/generate для гостевой подборки.",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const citySlug = searchParams.get("city") ?? "minsk";
    const date = searchParams.get("date") ?? undefined;
    const excludeParam =
      searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];
    const ageRangesParam = sanitizeCanonicalAgeRanges(
      searchParams.get("ageRanges")?.split(",").filter(Boolean) ?? [],
    );
    const personaIds =
      searchParams.get("personaIds")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];

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
            .map((planItem) => planItem.activityId)
            .filter((id): id is string => Boolean(id))
        : [];

    const excludeActivityIds = [...new Set([...excludeParam, ...plannedIds])];

    const batch = await rankPlanSuggestionsForCity({
      citySlug,
      excludeActivityIds,
      take: SUGGESTIONS_PER_BATCH,
      ...(date != null ? { date } : {}),
      ...(ageRangesParam.length > 0
        ? { ageRangeValues: ageRangesParam }
        : {}),
    });

    const sessionRowId = await getSessionRowIdFromCookies();
    const subjects =
      personaIds.length > 0 && date
        ? await buildSubjectsSnapshot({ userId: user.id, personaIds, targetDate: date })
        : [];
    const trace = await recordRecommendationRun({
      userId: user.id,
      sessionId: sessionRowId,
      surface: RecommendationSurface.MY_PLAN,
      citySlug,
      targetDateFrom: date ?? null,
      targetDateTo: date ?? null,
      algorithmVersion: batch.algorithmVersion,
      candidateCount: batch.candidateCount,
      decisionContext: {
        intent: "my_plan_suggestions",
        subjects,
        constraints: {
          ...(ageRangesParam.length > 0
            ? { ageRanges: { value: ageRangesParam, source: "manual" as const } }
            : {}),
          excludedActivityCount: { value: excludeActivityIds.length, source: "derived" as const },
          requestedLimit: { value: SUGGESTIONS_PER_BATCH, source: "derived" as const },
        },
        actor: { kind: "user", id: user.id },
      },
      items: batch.suggestions.map((item, index) => ({
        entityType: AnalyticsEntityType.EVENT,
        entityId: item.activity.id,
        position: index + 1,
        score: item.score,
        scoreBreakdown: item.scoreBreakdown,
        reasonCodes: item.reasonCodes,
      })),
    });

    const suggestions = batch.suggestions.map((item, index) => ({
      ...item.activity,
      recommendationRunId: trace?.runId ?? null,
      recommendationExposureId:
        trace?.exposureIdByEntityKey.get(`EVENT:${item.activity.id}`) ?? null,
      recommendationPosition: index + 1,
      recommendationAlgorithmVersion: batch.algorithmVersion,
    }));

    console.log("[API] real recommendation data used", {
      endpoint: "/api/plan/suggestions",
      count: suggestions.length,
      candidateCount: batch.candidateCount,
      algorithmVersion: batch.algorithmVersion,
      traced: Boolean(trace),
    });

    // A milestone requires an actually-applied personalization input, not
    // just a non-empty result — a generic/default ranking (no resolved
    // subject, no canonical age filter) is not "personalized." An invalid
    // or foreign personaId that resolved to subjects=[] doesn't count either.
    const isPersonalized = subjects.length > 0 || ageRangesParam.length > 0;
    if (suggestions.length > 0 && isPersonalized) {
      void trackFirstOccurrenceEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "FIRST_PERSONALIZED_RESULT",
        meta: { recommendationSurface: "my_plan" },
      });
    }

    return NextResponse.json({
      suggestions,
      recommendationRunId: trace?.runId ?? null,
      algorithmVersion: batch.algorithmVersion,
    });
  } catch (error) {
    console.error("Plan suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
