import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { hasIdea, hasOfferIdea, hasOfferIdeaSupport } from "@/server/services/idea.service";
import { prisma } from "@/lib/prisma";
import { resolveIdeaPlanState } from "@/lib/plan/ideaPlanStatus";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");
    const offerId = searchParams.get("offerId");

    if (!activityId && !offerId) {
      return NextResponse.json(
        { error: "activityId or offerId is required" },
        { status: 400 }
      );
    }

    if (offerId) {
      if (!hasOfferIdeaSupport()) {
        return NextResponse.json({
          isSaved: false,
          isIdea: false,
          inPlan: false,
          planDate: null,
          planStartsAt: null,
        });
      }
      const isIdea = await hasOfferIdea(user.id, offerId);
      return NextResponse.json({
        isSaved: isIdea,
        isIdea,
        inPlan: false,
        planDate: null,
        planStartsAt: null,
      });
    }

    // Check if saved as idea
    const isIdea = await hasIdea(user.id, activityId!);

    // Check if in plan
    const planItems = await prisma.planItem.findMany({
      where: { userId: user.id, activityId: activityId! },
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
  } catch (error) {
    console.error("Check save status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
