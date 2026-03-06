import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { getModerationLogs } from "@/server/services/moderation.service";

/**
 * GET /api/admin/places/[id]
 * Get Place details for moderation
 * Admin/Moderator only
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: placeId } = await params;

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            phoneE164: true,
            createdAt: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        parentPlace: {
          select: {
            id: true,
            title: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Get moderation logs
    const moderationLogs = await getModerationLogs("PLACE", placeId);

    return NextResponse.json({
      place: {
        ...place,
        moderationLogs,
      },
    });
  } catch (error) {
    console.error("Error fetching place:", error);
    return NextResponse.json(
      { error: "Failed to fetch place" },
      { status: 500 }
    );
  }
}
