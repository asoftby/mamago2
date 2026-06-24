import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getUserBusinessId } from "@/lib/auth/placeAccess";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get("excludeId");
    const ownerBusinessId = await getUserBusinessId(user.id);

    if (!ownerBusinessId) {
      return NextResponse.json(
        { error: "Business context is required" },
        { status: 403 }
      );
    }

    const places = await prisma.place.findMany({
      where: {
        ownerBusinessId,
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
