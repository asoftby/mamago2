import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import {
  addPlacePlanItem,
  addPlanItem,
  addRoutePlanItem,
  removePlanItem,
} from "@/server/services/plan.service";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      activityId,
      routeId,
      planRouteSlug,
      placeId,
      planPlaceSlug,
      articleId,
      date,
      startsAt,
      activitySessionId,
      title,
      coverImageUrl,
      selectedPersonaIds,
      planAddSource,
    } = body as {
        activityId?: string;
        routeId?: string;
        planRouteSlug?: string;
        placeId?: string;
        planPlaceSlug?: string;
        articleId?: string;
        date?: string;
        startsAt?: string;
        /** ActivitySession.id — used to derive startsAt; validated server-side */
        activitySessionId?: string | null;
        title?: string;
        coverImageUrl?: string;
        selectedPersonaIds?: unknown;
        planAddSource?: unknown;
      };

    // Articles have no date semantics — they can only be saved as an idea
    // (see /api/save/idea). Reject before the generic validation below so a
    // direct API call can't create a dated PlanItem for an article.
    if (articleId) {
      return NextResponse.json(
        { error: "articles cannot be saved to a specific date; use /api/save/idea" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    // Validate that at least one entity type is provided
    if (!activityId && !routeId && !placeId) {
      return NextResponse.json(
        { error: "activityId, routeId or placeId is required" },
        { status: 400 }
      );
    }

    let planItem;

    if (placeId) {
      planItem = await addPlacePlanItem(user.id, placeId, date, planPlaceSlug ?? null, {
        title: title ?? null,
        coverImageUrl: coverImageUrl ?? null,
      });

      const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: { cityId: true },
      });
      const sessionRowId = await getSessionRowIdFromCookies();
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "PLAN_ADD",
        entityType: "PLACE",
        entityId: placeId,
        vertical: "CITY",
        cityId: place?.cityId ?? null,
        meta: { source: "detail", section: "places", targetAction: "plan" },
      });
    }
    // Handle route
    else if (routeId) {
      planItem = await addRoutePlanItem(
        user.id,
        routeId,
        date,
        planRouteSlug ?? null,
        { title: title ?? null, coverImageUrl: coverImageUrl ?? null }
      );
    }
    // Handle activity
    else if (activityId) {
      // Resolve startsAt: prefer activitySessionId lookup; fall back to raw startsAt string.
      let resolvedStartsAt: Date | undefined = startsAt ? new Date(startsAt) : undefined;

      if (
        typeof activitySessionId === "string" &&
        activitySessionId.length > 0 &&
        activitySessionId.length < 64
      ) {
        const session = await prisma.activitySession.findUnique({
          where: { id: activitySessionId },
          select: { activityId: true, startsAt: true },
        });
        // Validate session belongs to this activity and falls on the requested date
        if (
          session &&
          session.activityId === activityId &&
          getLocalDateKey(session.startsAt) === date
        ) {
          resolvedStartsAt = session.startsAt;
        }
        // If mismatch: silently ignore — PlanItem saved without time
      }

      planItem = await addPlanItem(
        user.id,
        activityId,
        date,
        resolvedStartsAt,
        title ?? undefined,
        coverImageUrl ?? undefined
      );

      if (planItem.created) {
        const cityId = await getActivityCityIdForAnalytics(activityId);
        const sessionRowId = await getSessionRowIdFromCookies();
        const personaIds =
          Array.isArray(selectedPersonaIds) ?
            selectedPersonaIds.filter((x): x is string => typeof x === "string")
          : [];
        const sourceTag =
          planAddSource === "recommendation" || planAddSource === "idea" ?
            ("plan" as const)
          : ("detail" as const);
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "PLAN_ADD",
          entityType: "EVENT",
          entityId: activityId,
          vertical: "CITY",
          cityId,
          meta: {
            source: sourceTag,
            section: "afisha",
            targetAction: "plan",
            ...(personaIds.length > 0 ? { selectedPersonaIds: personaIds } : {}),
          },
        });
      }
    }
    return NextResponse.json({ success: true, planItem });
  } catch (error) {
    console.error("Add plan item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const planItemId = searchParams.get("planItemId");

    if (!planItemId) {
      return NextResponse.json(
        { error: "planItemId is required" },
        { status: 400 }
      );
    }

    await removePlanItem(user.id, planItemId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove plan item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
