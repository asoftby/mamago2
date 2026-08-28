import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import { listPlanSuggestionsForCity } from "@/server/services/planSuggestions.service";
import { resolveScenarioScheduling } from "@/features/my-plan/lib/scenarioScheduling";
import { formatScenarioPriceLabel } from "@/features/my-plan/lib/scenarioPricing";
import { formatActivityAddressLine } from "@/features/my-plan/lib/formatActivityAddress";
import type { ScenarioReplacementCandidate } from "@/features/my-plan/lib/scenarioDraft";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? "";
  const citySlug = params.get("city") ?? "minsk";
  if (!DATE_PATTERN.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const excludeActivityIds = (params.get("exclude") ?? "").split(",").filter(Boolean);
  const activities = await listPlanSuggestionsForCity({ citySlug, date, excludeActivityIds, take: 12 });
  const activityIds = activities.map((activity) => activity.id);
  const windowStart = new Date(`${addDaysLocal(date, -1)}T00:00:00.000Z`);
  const windowEnd = new Date(`${addDaysLocal(date, 2)}T00:00:00.000Z`);
  const sessions = activityIds.length === 0 ? [] : await prisma.activitySession.findMany({
    where: { activityId: { in: activityIds }, startsAt: { gte: windowStart, lt: windowEnd } },
    select: { id: true, activityId: true, startsAt: true },
    orderBy: { startsAt: "asc" },
  });
  const sameDateSessions = sessions.filter((session) => getLocalDateKey(session.startsAt) === date);

  const candidates: ScenarioReplacementCandidate[] = activities.flatMap((activity) => {
    const occurrences = sameDateSessions.filter((session) => session.activityId === activity.id);
    const source = occurrences.length > 0 ? occurrences : [null];
    return source.map((session) => {
      const timing = {
        effectiveStartsAt: session?.startsAt ?? null,
        isFlexible: session == null,
        timeSource: session ? ("fixed" as const) : ("flexible" as const),
      };
      const scheduling = resolveScenarioScheduling({ activity, timing });
      return {
        activityId: activity.id,
        activitySessionId: session?.id ?? null,
        title: activity.title,
        coverImageUrl: activity.coverImageUrl,
        href: activity.slug ? `/${citySlug}/events/${activity.slug}` : null,
        startsAt: scheduling.startsAt?.toISOString() ?? null,
        endsAt: scheduling.endsAt?.toISOString() ?? null,
        durationMinutes: scheduling.durationMinutes,
        schedulingKind: scheduling.kind,
        canReschedule: scheduling.canReschedule,
        priceLabel: formatScenarioPriceLabel(activity),
        addressLabel: formatActivityAddressLine(activity),
        // Candidates aren't yet on the plan — a real booking-status check
        // would need a per-candidate BookingRequest lookup; not worth the
        // extra query for a swap-suggestion rail, so this is always false.
        isBooked: false,
      };
    });
  });

  return NextResponse.json({ candidates });
}
