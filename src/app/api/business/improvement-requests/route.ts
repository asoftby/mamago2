import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listActiveImprovementRequestsForBusiness } from "@/server/services/improvementRequest.service";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

/**
 * GET /api/business/improvement-requests
 * List all active improvement requests for the business owner
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const requests = await listActiveImprovementRequestsForBusiness(user.id);

    // Group by place for easier consumption
    const requestsByPlace = requests.reduce((acc: any, request: any) => {
      if (request.entityType === "PLACE") {
        if (!acc[request.entityId]) {
          acc[request.entityId] = [];
        }
        acc[request.entityId].push(request);
      }
      return acc;
    }, {});

    return NextResponse.json({ 
      requests,
      requestsByPlace,
      totalCount: requests.length,
    });
  } catch (error: any) {
    console.error("[API] List business improvement requests error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list improvement requests" },
      { status: 500 }
    );
  }
}
