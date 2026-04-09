import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/plan/items
 * Add item to user's plan
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { entityType, entityId, date } = await req.json();

    if (!entityType || !entityId || !date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create plan item
    const planItem = await prisma.planItem.create({
      data: {
        userId: session.user.id,
        entityType,
        entityId,
        date: new Date(date),
      },
    });

    return NextResponse.json({ success: true, planItem });
  } catch (error) {
    console.error("Add to plan error:", error);
    return NextResponse.json(
      { error: "Failed to add to plan" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/plan/items
 * Get user's plan items
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    const where: any = {
      userId: session.user.id,
    };

    if (date) {
      where.date = new Date(date);
    }

    const planItems = await prisma.planItem.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ planItems });
  } catch (error) {
    console.error("Get plan items error:", error);
    return NextResponse.json(
      { error: "Failed to get plan items" },
      { status: 500 }
    );
  }
}
