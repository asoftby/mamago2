import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    const places = await prisma.place.findMany({
      where: {
        placeGroupId: groupId,
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        shortAddress: true,
        status: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ places });
  } catch (error) {
    console.error("Failed to fetch group places:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
