import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listActiveImprovementRequestsForBusiness } from "@/server/services/improvementRequest.service";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import type { ImprovementRequest } from "@prisma/client";

type ImprovementRequestWithPlace = ImprovementRequest & {
  entityType: "PLACE";
};

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
    const requestsByPlace = requests.reduce<Record<string, ImprovementRequestWithPlace[]>>((acc, request) => {
      if (request.entityType === "PLACE") {
        if (!acc[request.entityId]) {
          acc[request.entityId] = [];
        }
        acc[request.entityId].push(request as ImprovementRequestWithPlace);
      }
      return acc;
    }, {});

    return NextResponse.json({ 
      requests,
      requestsByPlace,
      totalCount: requests.length,
    });
  } catch (error: unknown) {
    console.error("[API] List business improvement requests error:", error);
    const message = error instanceof Error ? error.message : "Failed to list improvement requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
