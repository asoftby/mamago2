import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { hasIdea } from "@/server/services/idea.service";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    // Check if saved as idea
    const isIdea = await hasIdea(user.id, activityId);

    // Check if in plan
    const planItem = await prisma.planItem.findFirst({
      where: { userId: user.id, activityId },
      select: { id: true, date: true, startsAt: true },
      orderBy: { createdAt: "asc" },
    });

    const isSaved = isIdea || !!planItem;

    return NextResponse.json({
      isSaved,
      isIdea,
      inPlan: !!planItem,
      planDate: planItem?.date ?? null,
      planStartsAt: planItem?.startsAt ?? null,
    });
  } catch (error) {
    console.error("Check save status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
