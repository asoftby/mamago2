import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  hasArticleIdea,
  hasIdea,
  hasOfferIdea,
  hasOfferIdeaSupport,
  hasPlaceIdea,
} from "@/server/services/idea.service";
import { prisma } from "@/lib/prisma";
import { resolveIdeaPlanState } from "@/lib/plan/ideaPlanStatus";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingMomentIso,
  type OwnEventBooking,
} from "@/lib/event/ownEventBooking";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        isSaved: false,
        isIdea: false,
        inPlan: false,
        planDate: null,
        planStartsAt: null,
        planItemId: null,
        ownBookings: [],
      }, { headers: PRIVATE_HEADERS });
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");
    const offerId = searchParams.get("offerId");
    const placeId = searchParams.get("placeId");
    const articleId = searchParams.get("articleId");

    if (!activityId && !offerId && !placeId && !articleId) {
      return NextResponse.json(
        { error: "activityId, offerId, placeId or articleId is required" },
        { status: 400 }
      );
    }

    if (articleId) {
      const isIdea = await hasArticleIdea(user.id, articleId);
      const planItems = await prisma.planItem.findMany({
        where: { ...(await activePlanScopeFor(user.id)), articleId },
        select: { id: true, date: true, startsAt: true },
        orderBy: { date: "asc" },
      });
      const planState = resolveIdeaPlanState(
        planItems.map((item) => ({ id: item.id, date: item.date })),
      );
      const relevantPlanItem =
        planItems.find((item) => item.id === planState.planItemId) ?? null;
      const isSaved = isIdea || planItems.length > 0;

      return NextResponse.json({
        isSaved,
        isIdea,
        inPlan: planState.isPlanned,
        planStatus: planState.planStatus,
        planDate: planState.plannedDate ?? null,
        planStartsAt: relevantPlanItem?.startsAt ?? null,
        planItemId: planState.planItemId ?? null,
      });
    }

    if (placeId) {
      const isIdea = await hasPlaceIdea(user.id, placeId);
      const planItems = await prisma.planItem.findMany({
        where: { ...(await activePlanScopeFor(user.id)), placeId },
        select: { id: true, date: true, startsAt: true },
        orderBy: { date: "asc" },
      });
      const planState = resolveIdeaPlanState(
        planItems.map((item) => ({ id: item.id, date: item.date })),
      );
      const relevantPlanItem =
        planItems.find((item) => item.id === planState.planItemId) ?? null;
      const isSaved = isIdea || planItems.length > 0;

      return NextResponse.json({
        isSaved,
        isIdea,
        inPlan: planState.isPlanned,
        planStatus: planState.planStatus,
        planDate: planState.plannedDate ?? null,
        planStartsAt: relevantPlanItem?.startsAt ?? null,
        planItemId: planState.planItemId ?? null,
      });
    }

    if (offerId) {
      const planScope = await activePlanScopeFor(user.id);
      const [isIdea, planItems, savedBirthdayOffer] = await Promise.all([
        hasOfferIdeaSupport() ? hasOfferIdea(user.id, offerId) : Promise.resolve(false),
        prisma.planItem.findMany({
          where: { ...planScope, offerId },
          select: { id: true, date: true, startsAt: true },
          orderBy: { date: "asc" },
        }),
        prisma.partySavedOffer.findFirst({
          where: { offerId, partyOrder: { ownerUserId: user.id, status: { not: "CANCELLED" } } },
          select: { id: true },
        }),
      ]);
      const inBirthday = Boolean(savedBirthdayOffer);
      const planState = resolveIdeaPlanState(planItems.map((item) => ({ id: item.id, date: item.date })));
      return NextResponse.json({
        isSaved: isIdea || planItems.length > 0 || inBirthday,
        isIdea,
        inBirthday,
        inPlan: planState.isPlanned,
        planDate: planState.plannedDate ?? null,
        planStartsAt: planItems.find((item) => item.id === planState.planItemId)?.startsAt ?? null,
        planItemId: planState.planItemId ?? null,
      });
    }

    // Check if saved as idea
    const isIdea = await hasIdea(user.id, activityId!);

    // Plan items + the user's own active booking requests (private, one light query).
    const [planItems, bookingRows] = await Promise.all([
      (async () =>
        prisma.planItem.findMany({
          where: { ...(await activePlanScopeFor(user.id)), activityId: activityId! },
          select: { id: true, date: true, startsAt: true },
          orderBy: { date: "asc" },
        }))(),
      prisma.bookingRequest.findMany({
        where: {
          userId: user.id,
          activityId: activityId!,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
        select: {
          id: true,
          status: true,
          selectedSessionId: true,
          startsAt: true,
          requestedDate: true,
          requestedTime: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    const ownBookings: OwnEventBooking[] = [];
    for (const row of bookingRows) {
      const at = bookingMomentIso(row);
      if (!at || (row.status !== "NEW" && row.status !== "CONFIRMED")) continue;
      ownBookings.push({ id: row.id, status: row.status, sessionId: row.selectedSessionId, at });
    }
    const planState = resolveIdeaPlanState(
      planItems.map((item) => ({ id: item.id, date: item.date })),
    );
    const relevantPlanItem =
      planItems.find((item) => item.id === planState.planItemId) ?? null;

    const isSaved = isIdea || planItems.length > 0;

    return NextResponse.json({
      isSaved,
      isIdea,
      inPlan: planState.isPlanned,
      planStatus: planState.planStatus,
      planDate: planState.plannedDate ?? null,
      planStartsAt: relevantPlanItem?.startsAt ?? null,
      planItemId: planState.planItemId ?? null,
      ownBookings,
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("Check save status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
