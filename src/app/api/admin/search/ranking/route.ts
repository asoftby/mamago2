import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  handleSearchRankingGet,
  handleSearchRankingMutation,
} from "@/server/services/search/adminSearchRankingHandlers";

/**
 * GET /api/admin/search/ranking
 * Get current ranking settings
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const result = await handleSearchRankingGet(user);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET /api/admin/search/ranking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/search/ranking
 * Locked read-only — see audit finding in adminSearchRankingHandlers.ts.
 */
export async function PATCH() {
  const user = await getCurrentUser();
  const result = handleSearchRankingMutation(user);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * POST /api/admin/search/ranking?action=reset
 * Locked read-only — see audit finding in adminSearchRankingHandlers.ts.
 */
export async function POST() {
  const user = await getCurrentUser();
  const result = handleSearchRankingMutation(user);
  return NextResponse.json(result.body, { status: result.status });
}
