import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { addPlanItem, removePlanItem } from "@/server/services/plan.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, date, startsAt, title, coverImageUrl } = body;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    if (!activityId && !title) {
      return NextResponse.json({ error: "activityId or title is required" }, { status: 400 });
    }

    const planItem = await addPlanItem(
      user.id,
      activityId ?? null,
      date,
      startsAt ? new Date(startsAt) : undefined,
      title ?? undefined,
      coverImageUrl ?? undefined
    );

    if (activityId) {
      const cityId = await getActivityCityIdForAnalytics(activityId);
      const sessionRowId = await getSessionRowIdFromCookies();
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "PLAN_ADD",
        entityType: "EVENT",
        entityId: activityId,
        vertical: "CITY",
        cityId,
        meta: { source: "detail", section: "afisha", targetAction: "plan" },
      });
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
