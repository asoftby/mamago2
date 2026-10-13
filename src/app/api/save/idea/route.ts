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
  hasOfferIdeaSupport,
  removeArticleIdea,
  removeIdea,
  removeOfferIdea,
  removePlaceIdea,
} from "@/server/services/idea.service";
import {
  saveIdeaWithCollections,
  type IdeaTarget,
} from "@/server/services/ideaCollections.service";
import { ideaCollectionErrorResponse } from "@/server/services/ideaCollections.http";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, offerId, placeId, articleId, collectionIds } = body as {
      activityId?: string;
      offerId?: string;
      placeId?: string;
      articleId?: string;
      /** Опционально: сразу положить сохранённую идею в эти коллекции. */
      collectionIds?: string[];
    };

    if (!activityId && !offerId && !placeId && !articleId) {
      return NextResponse.json(
        { error: "activityId, offerId, placeId or articleId is required" },
        { status: 400 }
      );
    }

    const wantedCollectionIds = Array.isArray(collectionIds)
      ? collectionIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const saveTarget: IdeaTarget = articleId
      ? { kind: "ARTICLE", id: articleId }
      : placeId
        ? { kind: "PLACE", id: placeId }
        : activityId
          ? { kind: "ACTIVITY", id: activityId }
          : { kind: "OFFER", id: offerId! };
    // With collections, saving + membership is one transaction, not two.
    const save = async () => {
      if (wantedCollectionIds.length > 0) {
        return saveIdeaWithCollections(user.id, saveTarget, wantedCollectionIds);
      }
      if (articleId) return addArticleIdea(user.id, articleId);
      if (placeId) return addPlaceIdea(user.id, placeId);
      if (activityId) return addIdea(user.id, activityId);
      return addOfferIdea(user.id, offerId!);
    };

    if (articleId) {
      const idea = await save();
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
      return NextResponse.json({ success: true, idea });
    }

    if (placeId) {
      const idea = await save();
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
      return NextResponse.json({ success: true, idea });
    }

    if (activityId) {
      const idea = await save();

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

    const idea = await save();
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
    const collectionError = ideaCollectionErrorResponse(error);
    if (collectionError) return collectionError;
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
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: { cityId: true },
      });
      await removeArticleIdea(user.id, articleId);
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "UNSAVE",
        entityType: "ARTICLE",
        entityId: articleId,
        vertical: "CITY",
        cityId: article?.cityId ?? null,
        meta: { section: "journal", targetAction: "ideas" },
      });
    } else if (placeId) {
      const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: { cityId: true },
      });
      await removePlaceIdea(user.id, placeId);
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "UNSAVE",
        entityType: "PLACE",
        entityId: placeId,
        vertical: "CITY",
        cityId: place?.cityId ?? null,
        meta: { section: "places", targetAction: "ideas" },
      });
    } else if (activityId) {
      const cityId = await getActivityCityIdForAnalytics(activityId);
      await removeIdea(user.id, activityId);
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "UNSAVE",
        entityType: "EVENT",
        entityId: activityId,
        vertical: "CITY",
        cityId,
        meta: { section: "afisha", targetAction: "ideas" },
      });
    } else if (offerId) {
      if (!hasOfferIdeaSupport()) {
        return NextResponse.json({ success: true });
      }
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: { place: { select: { cityId: true } } },
      });
      await removeOfferIdea(user.id, offerId);
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "UNSAVE",
        entityType: "OFFER",
        entityId: offerId,
        vertical: "CITY",
        cityId: offer?.place?.cityId ?? null,
        meta: { section: "offers", targetAction: "ideas" },
      });
    } else if (routeId) {
      await prisma.routeIdea.deleteMany({
        where: { userId: user.id, routeId },
      });
      void trackUserEvent({
        userId: user.id,
        sessionId: sessionRowId,
        eventType: "UNSAVE",
        entityType: "ROUTE",
        entityId: routeId,
        vertical: "CITY",
        cityId: null,
        meta: { section: "routes", targetAction: "ideas" },
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
