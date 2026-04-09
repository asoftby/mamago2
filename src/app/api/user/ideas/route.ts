import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user/ideas
 * Add item to user's ideas
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

    const { entityType, entityId } = await req.json();

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create idea
    const idea = await prisma.idea.create({
      data: {
        userId: session.user.id,
        entityType,
        entityId,
      },
    });

    return NextResponse.json({ success: true, idea });
  } catch (error) {
    console.error("Add to ideas error:", error);
    return NextResponse.json(
      { error: "Failed to add to ideas" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/ideas
 * Get user's ideas
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

    const ideas = await prisma.idea.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ideas });
  } catch (error) {
    console.error("Get ideas error:", error);
    return NextResponse.json(
      { error: "Failed to get ideas" },
      { status: 500 }
    );
  }
}
