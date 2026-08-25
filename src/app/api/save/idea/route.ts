import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import { prisma } from "@/lib/prisma";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import {
  addArticleIdea,
  addIdea,
  addOfferIdea,
  addPlaceIdea,
  hasArticleIdea,
  hasIdea,
  hasOfferIdea,
  hasOfferIdeaSupport,
  hasPlaceIdea,
  removeArticleIdea,
  removeIdea,
  removeOfferIdea,
  removePlaceIdea,
} from "@/server/services/idea.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, offerId, placeId, articleId } = body as {
      activityId?: string;
      offerId?: string;
      placeId?: string;
      articleId?: string;
    };

    if (!activityId && !offerId && !placeId && !articleId) {
      return NextResponse.json(
        { error: "activityId, offerId, placeId or articleId is required" },
        { status: 400 }
      );
    }

    if (articleId) {
      const alreadySaved = await hasArticleIdea(user.id, articleId);
      const idea = await addArticleIdea(user.id, articleId);
      if (!alreadySaved) {
        const article = await prisma.article.findUnique({
          where: { id: articleId },
          select: { cityId: true },
        });
        const sessionRowId = await getSessionRowIdFromCookies();
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "SAVE",
          entityType: "ARTICLE",
          entityId: articleId,
          vertical: "CITY",
          cityId: article?.cityId ?? null,
          meta: { source: "detail", section: "journal", targetAction: "ideas" },
        });
      }
      return NextResponse.json({ success: true, idea });
    }

    if (placeId) {
      const alreadySaved = await hasPlaceIdea(user.id, placeId);
      const idea = await addPlaceIdea(user.id, placeId);
      if (!alreadySaved) {
        const place = await prisma.place.findUnique({
          where: { id: placeId },
          select: { cityId: true },
        });
        const sessionRowId = await getSessionRowIdFromCookies();
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "SAVE",
          entityType: "PLACE",
          entityId: placeId,
          vertical: "CITY",
          cityId: place?.cityId ?? null,
          meta: { source: "detail", section: "places", targetAction: "ideas" },
        });
      }
      return NextResponse.json({ success: true, idea });
    }

    if (activityId) {
      const alreadySaved = await hasIdea(user.id, activityId);
      const idea = await addIdea(user.id, activityId);

      if (!alreadySaved) {
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
      }

      return NextResponse.json({ success: true, idea });
    }

    if (!hasOfferIdeaSupport()) {
      return NextResponse.json(
        { error: "Offer ideas storage is not available yet" },
        { status: 503 }
      );
    }

    const alreadySaved = await hasOfferIdea(user.id, offerId!);
    const idea = await addOfferIdea(user.id, offerId!);
    if (!alreadySaved) {
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
    }

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
    const placeId = searchParams.get("placeId");
    const articleId = searchParams.get("articleId");

    if (!activityId && !offerId && !routeId && !placeId && !articleId) {
      return NextResponse.json(
        { error: "activityId, offerId, routeId, placeId or articleId is required" },
        { status: 400 }
      );
    }

    const sessionRowId = await getSessionRowIdFromCookies();

    if (articleId) {
      const existed = await hasArticleIdea(user.id, articleId);
      const article = existed
        ? await prisma.article.findUnique({
            where: { id: articleId },
            select: { cityId: true },
          })
        : null;
      await removeArticleIdea(user.id, articleId);
      if (existed) {
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "UNSAVE",
          entityType: "ARTICLE",
          entityId: articleId,
          vertical: "CITY",
          cityId: article?.cityId ?? null,
          meta: { source: "detail", section: "journal", targetAction: "ideas" },
        });
      }
    } else if (placeId) {
      const existed = await hasPlaceIdea(user.id, placeId);
      const place = existed
        ? await prisma.place.findUnique({
            where: { id: placeId },
            select: { cityId: true },
          })
        : null;
      await removePlaceIdea(user.id, placeId);
      if (existed) {
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "UNSAVE",
          entityType: "PLACE",
          entityId: placeId,
          vertical: "CITY",
          cityId: place?.cityId ?? null,
          meta: { source: "detail", section: "places", targetAction: "ideas" },
        });
      }
    } else if (activityId) {
      const existed = await hasIdea(user.id, activityId);
      const cityId = existed
        ? await getActivityCityIdForAnalytics(activityId)
        : null;
      await removeIdea(user.id, activityId);
      if (existed) {
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "UNSAVE",
          entityType: "EVENT",
          entityId: activityId,
          vertical: "CITY",
          cityId,
          meta: { source: "detail", section: "afisha", targetAction: "ideas" },
        });
      }
    } else if (offerId) {
      if (!hasOfferIdeaSupport()) {
        return NextResponse.json({ success: true });
      }
      const existed = await hasOfferIdea(user.id, offerId);
      const offer = existed
        ? await prisma.offer.findUnique({
            where: { id: offerId },
            select: { place: { select: { cityId: true } } },
          })
        : null;
      await removeOfferIdea(user.id, offerId);
      if (existed) {
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "UNSAVE",
          entityType: "OFFER",
          entityId: offerId,
          vertical: "CITY",
          cityId: offer?.place?.cityId ?? null,
          meta: { source: "detail", section: "offers", targetAction: "ideas" },
        });
      }
    } else if (routeId) {
      const deleted = await prisma.routeIdea.deleteMany({
        where: { userId: user.id, routeId },
      });
      if (deleted.count > 0) {
        void trackUserEvent({
          userId: user.id,
          sessionId: sessionRowId,
          eventType: "UNSAVE",
          entityType: "ROUTE",
          entityId: routeId,
          meta: { source: "detail", section: "routes", targetAction: "ideas" },
        });
      }
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
