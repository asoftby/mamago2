import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ownerUserId = searchParams.get("ownerUserId");
    const excludeId = searchParams.get("excludeId");

    if (!ownerUserId) {
      return NextResponse.json(
        { error: "ownerUserId is required" },
        { status: 400 }
      );
    }

    // Verify user owns these places or is admin
    if (user.id !== ownerUserId && user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const places = await prisma.place.findMany({
      where: {
        ownerUserId,
        id: excludeId ? { not: excludeId } : undefined,
        archivedAt: null, // Don't include archived places
      },
      select: {
        id: true,
        title: true,
        shortAddress: true,
        placeGroupId: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ places });
  } catch (error) {
    console.error("Failed to fetch places:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
