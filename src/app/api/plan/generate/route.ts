import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  listPlanSuggestionsForCity,
  rankPlanSuggestionsForCity,
} from "@/server/services/planSuggestions.service";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";
import { buildManualSubjectsSnapshot } from "@/lib/decision/subjects";
import { sanitizeCanonicalAgeRanges } from "@/lib/decision/decisionContext";
import {
  quickGuestQuotaGate,
  recordGuestSuccessfulGeneration,
  resolveGuestUsageKey,
} from "@/server/services/guestPlanQuota";
import { getTrustedClientIp } from "@/lib/security/clientIp";

const bodySchema = z.object({
  anonymousId: z.string().optional().nullable(),
  city: z.string().min(1).optional().default("minsk"),
  date: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  ageRanges: z.array(z.string()).optional(),
});

/**
 * POST /api/plan/generate — подборка для «Мой план».
 * Авторизованным — без гостевой квоты.
 * Гостям — anonymousId в body (или fallback по IP + UA). Квота списывается после успешной подборки (guestPlanQuota).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { anonymousId, city, date, exclude, ageRanges } = parsed.data;
    const excludeActivityIds = [...new Set((exclude ?? []).filter(Boolean))];
    const ageRangeValues = sanitizeCanonicalAgeRanges(ageRanges ?? []);

    if (user) {
      let plannedIds: string[] = [];
      if (date) {
        plannedIds = (
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
          .filter((id): id is string => Boolean(id));
      }
      const mergedExclude = [...new Set([...excludeActivityIds, ...plannedIds])];
      const activities = await listPlanSuggestionsForCity({
        citySlug: city.toLowerCase(),
        excludeActivityIds: mergedExclude,
        take: 6,
        ...(ageRangeValues.length > 0 ? { ageRangeValues } : {}),
      });
      console.log("[API] real data used", {
        endpoint: "/api/plan/generate",
        authenticated: true,
        count: activities.length,
      });
      return NextResponse.json({
        suggestions: activities,
        scenario: activities,
        ...(activities.length === 0 ? { message: "Нет данных для генерации" } : {}),
        requiresAuth: false,
        remainingGenerations: null,
        authenticated: true,
      });
    }

    const key = resolveGuestUsageKey(
      anonymousId ?? null,
      getTrustedClientIp(request),
      request.headers.get("user-agent"),
    );
    if (!key) {
      return NextResponse.json(
        { error: "missing_identifier", requiresAuth: false },
        { status: 400 },
      );
    }

    const gate = await quickGuestQuotaGate(key);
    if (gate.blocked) {
      if (gate.reason === "requires_auth") {
        return NextResponse.json({
          requiresAuth: true,
          remainingGenerations: 0,
          suggestions: [],
        });
      }
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Слишком частые запросы. Подождите минуту.",
        },
        { status: 429 },
      );
    }

    const batch = await rankPlanSuggestionsForCity({
      citySlug: city.toLowerCase(),
      excludeActivityIds,
      take: 6,
      ...(ageRangeValues.length > 0 ? { ageRangeValues } : {}),
    });
    console.log("[API] real data used", {
      endpoint: "/api/plan/generate",
      authenticated: false,
      count: batch.suggestions.length,
    });

    const recorded = await recordGuestSuccessfulGeneration(key);
    if (!recorded.ok) {
      if (recorded.reason === "requires_auth") {
        return NextResponse.json({
          requiresAuth: true,
          remainingGenerations: 0,
          suggestions: [],
        });
      }
      if (recorded.reason === "rate_limited") {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "Слишком частые запросы. Подождите минуту.",
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "service_unavailable", message: "Попробуйте ещё раз." },
        { status: 503 },
      );
    }

    // anonymousId is the guest's primary product key (FAM-001); the quota
    // `key` above may instead be an IP+UA hash fallback and is not identity.
    const guestAnonymousId = anonymousId?.trim() || null;
    const trace = await recordRecommendationRun({
      anonymousId: guestAnonymousId,
      surface: RecommendationSurface.MY_PLAN,
      citySlug: city.toLowerCase(),
      targetDateFrom: date ?? null,
      targetDateTo: date ?? null,
      algorithmVersion: batch.algorithmVersion,
      candidateCount: batch.candidateCount,
      decisionContext: {
        intent: "guest_plan_generate",
        subjects: buildManualSubjectsSnapshot(ageRangeValues),
        constraints: {
          ...(ageRangeValues.length > 0
            ? { ageRanges: { value: ageRangeValues, source: "manual" as const } }
            : {}),
          excludedActivityCount: { value: excludeActivityIds.length, source: "derived" as const },
          requestedLimit: { value: 6, source: "derived" as const },
        },
        actor: { kind: "guest", id: guestAnonymousId },
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

    const activities = batch.suggestions.map((item, index) => ({
      ...item.activity,
      recommendationRunId: trace?.runId ?? null,
      recommendationExposureId:
        trace?.exposureIdByEntityKey.get(`EVENT:${item.activity.id}`) ?? null,
      recommendationPosition: index + 1,
      recommendationAlgorithmVersion: batch.algorithmVersion,
    }));

    return NextResponse.json({
      suggestions: activities,
      scenario: activities,
      recommendationRunId: trace?.runId ?? null,
      ...(activities.length === 0 ? { message: "Нет данных для генерации" } : {}),
      requiresAuth: false,
      remainingGenerations: recorded.remainingGenerations,
      authenticated: false,
    });
  } catch (error) {
    console.error("[POST /api/plan/generate]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
