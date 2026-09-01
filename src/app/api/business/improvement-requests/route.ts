import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listActiveImprovementRequestsForBusiness } from "@/server/services/improvementRequest.service";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";
import type { ImprovementRequest } from "@prisma/client";

type ImprovementRequestWithPlace = ImprovementRequest & { entityType: "PLACE" };

/** GET /api/business/improvement-requests */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!(await checkBusinessToolPermission(user, "business.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await listActiveImprovementRequestsForBusiness(user.id);
    const requestsByPlace = requests.reduce<Record<string, ImprovementRequestWithPlace[]>>(
      (acc, request) => {
        if (request.entityType === "PLACE") {
          if (!acc[request.entityId]) acc[request.entityId] = [];
          acc[request.entityId].push(request as ImprovementRequestWithPlace);
        }
        return acc;
      },
      {},
    );

    return NextResponse.json({ requests, requestsByPlace, totalCount: requests.length });
  } catch (error: unknown) {
    console.error("[API] List business improvement requests error:", error);
    return NextResponse.json({ error: "Failed to list improvement requests" }, { status: 500 });
  }
}
