import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { prisma } from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import {
  addIdea,
  addOfferIdea,
  hasOfferIdeaSupport,
  removeIdea,
  removeOfferIdea,
} from "@/server/services/idea.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, offerId } = body as {
      activityId?: string;
      offerId?: string;
    };

    if (!activityId && !offerId) {
      return NextResponse.json(
        { error: "activityId or offerId is required" },
        { status: 400 }
      );
    }

    if (activityId) {
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
    }

    const idea = await addOfferIdea(user.id, offerId!);
    const offer = await prisma.offer.findUnique({
      where: { id: offerId! },
      select: {
        place: { select: { cityId: true } },
      },
    });
    const sessionRowId = await getSessionRowIdFromCookies();
    void trackUserEvent({
      userId: user.id,
      sessionId: sessionRowId,
      eventType: "SAVE",
      entityType: "OFFER",
      entityId: offerId!,
      vertical: "CITY",
      cityId: offer?.place?.cityId ?? null,
      meta: { source: "detail", section: "offers", targetAction: "ideas" },
    });

    return NextResponse.json({ success: true, idea });
  } catch (error) {
    if (error instanceof Error && error.message === "offer_ideas_unsupported") {
      return NextResponse.json(
        { error: "Offer ideas storage is not available yet" },
        { status: 503 }
      );
    }
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
    const offerId = searchParams.get("offerId");
    const routeId = searchParams.get("routeId");

    if (!activityId && !offerId && !routeId) {
      return NextResponse.json(
        { error: "activityId, offerId or routeId is required" },
        { status: 400 }
      );
    }

    if (activityId) {
      await removeIdea(user.id, activityId);
    } else if (offerId) {
      if (!hasOfferIdeaSupport()) {
        return NextResponse.json({ success: true });
      }
      await removeOfferIdea(user.id, offerId);
    } else if (routeId) {
      await prisma.routeIdea.deleteMany({
        where: { userId: user.id, routeId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove idea error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
