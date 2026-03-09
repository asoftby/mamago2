import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listActiveImprovementRequestsForBusiness } from "@/server/services/improvementRequest.service";

/**
 * GET /api/business/improvement-requests
 * List active improvement requests for the current business owner
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const requests = await listActiveImprovementRequestsForBusiness(user.id);

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("[API] List business improvement requests error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list improvement requests" },
      { status: 500 }
    );
  }
}
