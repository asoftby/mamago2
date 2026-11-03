import { NextRequest, NextResponse } from "next/server";
import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import {
  listPlanSuggestionsForCity,
  rankPlanSuggestionsForCity,
} from "@/server/services/planSuggestions.service";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";
import { buildManualSubjectsSnapshot } from "@/lib/decision/subjects";
import { guestGenerateBodySchema } from "@/lib/decision/planRequestSchemas";
import {
  quickGuestQuotaGate,
  recordGuestSuccessfulGeneration,
  resolveGuestUsageKey,
} from "@/server/services/guestPlanQuota";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { canonicalSystemInterestSlugs } from "@/lib/event/eventSystemInterests";
import { firstGuestPlanOccurrence, guestPlanDateWindow } from "@/server/services/guestPlanAvailability";

/**
 * POST /api/plan/generate — подборка для «Мой план».
 * Авторизованным — без гостевой квоты.
 * Гостям — anonymousId в body (или fallback по IP + UA). Квота списывается после успешной подборки (guestPlanQuota).
 */
/**
 * A dated guest plan must be backed by an upcoming real occurrence. A generic
 * ALWAYS/RECURRING offer without a confirmed time belongs in discovery, not
 * in a specific-day itinerary.
 */
async function upcomingSessionByActivity(ids: string[], date?: string, dateTo?: string) {
  if (!date || ids.length === 0) return null;
  const range = guestPlanDateWindow(date, dateTo);
  const now = new Date();
  const rows = await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nextOccurrenceAt: true,
      _count: { select: { sessions: true } },
      sessions: {
        where: { startsAt: { gte: range.start, lt: range.end } },
        select: { startsAt: true, withdrawnAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  return new Map(rows.flatMap((row) => {
    const occurrence = firstGuestPlanOccurrence({
      sessions: row.sessions, hasStoredSessions: row._count.sessions > 0,
      nextOccurrenceAt: row.nextOccurrenceAt, rangeStart: range.start, rangeEnd: range.end, now,
    });
    return occurrence ? [[row.id, occurrence.toISOString()] as const] : [];
  }));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = guestGenerateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { anonymousId, city, date, dateTo, exclude, ageRanges, interests } = parsed.data;
    const dateFilter = date ? (dateTo ? { dateFrom: date, dateTo } : { date }) : {};
    const interestSlugs = canonicalSystemInterestSlugs(interests);
    const excludeActivityIds = [...new Set((exclude ?? []).filter(Boolean))];
    const ageRangeValues = [...new Set(ageRanges ?? [])];

    if (user) {
      let plannedIds: string[] = [];
      if (date) {
        plannedIds = (
          await prisma.planItem.findMany({
            where: {
              ...(await activePlanScopeFor(user.id)),
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
        take: date ? 24 : 6,
        ...dateFilter,
        strictAgeMatching: Boolean(date && ageRangeValues.length > 0),
        ...(ageRangeValues.length > 0 ? { ageRangeValues } : {}),
        ...(interestSlugs.length > 0 ? { profileInterestSlugs: interestSlugs } : {}),
      });
      const matches = await upcomingSessionByActivity(activities.map((a) => a.id), date, dateTo);
      const eligible = activities.filter((a) => !matches || matches.has(a.id)).slice(0, 6)
        .map((a) => ({ ...a, suggestedStartsAt: matches?.get(a.id) ?? null }));
      console.log("[API] real data used", {
        endpoint: "/api/plan/generate",
        authenticated: true,
        count: eligible.length,
      });
      return NextResponse.json({
        suggestions: eligible,
        scenario: eligible,
        ...(eligible.length === 0 ? { message: "Нет данных для генерации" } : {}),
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
      take: date ? 24 : 6,
      ...dateFilter,
      strictAgeMatching: Boolean(date && ageRangeValues.length > 0),
      ...(ageRangeValues.length > 0 ? { ageRangeValues } : {}),
      ...(interestSlugs.length > 0 ? { profileInterestSlugs: interestSlugs } : {}),
    });
    const matches = await upcomingSessionByActivity(batch.suggestions.map((s) => s.activity.id), date, dateTo);
    const eligible = batch.suggestions.filter((s) => !matches || matches.has(s.activity.id)).slice(0, 6);
    console.log("[API] real data used", {
      endpoint: "/api/plan/generate",
      authenticated: false,
      count: eligible.length,
    });
    // Empty days do not spend a guest's limited successful generations.
    if (eligible.length === 0) {
      return NextResponse.json({
        suggestions: [], scenario: [], requiresAuth: false, remainingGenerations: null,
        message: "На выбранные даты подтверждённых сеансов нет",
      });
    }

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
      targetDateTo: dateTo ?? date ?? null,
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
      items: eligible.map((item, index) => ({
        entityType: AnalyticsEntityType.EVENT,
        entityId: item.activity.id,
        position: index + 1,
        score: item.score,
        scoreBreakdown: item.scoreBreakdown,
        reasonCodes: item.reasonCodes,
      })),
    });

    const activities = eligible.map((item, index) => ({
      ...item.activity,
      suggestedStartsAt: matches?.get(item.activity.id) ?? null,
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
