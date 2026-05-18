import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listImprovementRequestsForEntity } from "@/server/services/improvementRequest.service";
import { prisma } from "@/lib/prisma";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

/**
 * GET /api/business/places/[id]/improvement-requests
 * List improvement requests for a specific place (business owner only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    // Verify ownership
    const place = await prisma.place.findUnique({
      where: { id },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const includeResolved = searchParams.get("includeResolved") === "true";

    const requests = await listImprovementRequestsForEntity(
      "PLACE",
      id,
      includeResolved
    );

    return NextResponse.json({ requests });
  } catch (error: unknown) {
    console.error("[API] List place improvement requests error:", error);
    return NextResponse.json({ error: "Failed to list improvement requests" }, { status: 500 });
  }
}
