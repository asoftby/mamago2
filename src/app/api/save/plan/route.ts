import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { addPlanItem, addRoutePlanItem, removePlanItem } from "@/server/services/plan.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, routeId, planRouteSlug, date, startsAt, title, coverImageUrl, selectedPersonaIds, planAddSource } =
      body as {
        activityId?: string;
        routeId?: string;
        planRouteSlug?: string;
        date?: string;
        startsAt?: string;
        title?: string;
        coverImageUrl?: string;
        selectedPersonaIds?: unknown;
        planAddSource?: unknown;
      };

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    // Validate that at least one entity type is provided
    if (!activityId && !routeId && !title) {
      return NextResponse.json(
        { error: "activityId, routeId, or title is required" },
        { status: 400 }
      );
    }

    let planItem;

    // Handle route
    if (routeId) {
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
      planItem = await addPlanItem(
        user.id,
        activityId,
        date,
        startsAt ? new Date(startsAt) : undefined,
        title ?? undefined,
        coverImageUrl ?? undefined
      );

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
    // Handle fallback with title only (for external/demo routes)
    else {
      planItem = await addPlanItem(
        user.id,
        null,
        date,
        startsAt ? new Date(startsAt) : undefined,
        title ?? undefined,
        coverImageUrl ?? undefined
      );
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
