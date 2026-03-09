import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listImprovementRequestsForEntity } from "@/server/services/improvementRequest.service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/business/places/[id]/improvement-requests
 * List improvement requests for a specific place (business owner only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify ownership
    const place = await prisma.place.findUnique({
      where: { id: params.id },
      select: { ownerUserId: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (place.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const includeResolved = searchParams.get("includeResolved") === "true";

    const requests = await listImprovementRequestsForEntity(
      "PLACE",
      params.id,
      includeResolved
    );

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("[API] List place improvement requests error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list improvement requests" },
      { status: 500 }
    );
  }
}
