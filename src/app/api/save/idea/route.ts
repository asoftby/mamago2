import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { addIdea, removeIdea } from "@/server/services/idea.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: "activityId is required" },
        { status: 400 }
      );
    }

    const idea = await addIdea(user.id, activityId);

    const cityId = await getActivityCityIdForAnalytics(activityId);
    const sessionRowId = await getSessionRowIdFromCookies();
    void trackUserEvent({
      userId: user.id,
      sessionId: sessionRowId,
      eventType: "SAVE",
      entityType: "EVENT",
      entityId: activityId,
      vertical: "CITY",
      cityId,
      meta: { source: "detail", section: "afisha", targetAction: "ideas" },
    });

    return NextResponse.json({ success: true, idea });
  } catch (error) {
    console.error("Add idea error:", error);
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
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json(
        { error: "activityId is required" },
        { status: 400 }
      );
    }

    await removeIdea(user.id, activityId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove idea error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
