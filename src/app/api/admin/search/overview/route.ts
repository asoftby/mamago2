import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { computeSearchOverview } from "@/server/services/search/adminSearchOverviewHandlers";

/**
 * GET /api/admin/search/overview
 * Real SearchQueryLog aggregates for the last 7 days — see
 * computeSearchOverview() for the query logic (unit-tested separately).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await computeSearchOverview();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/search/overview error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
