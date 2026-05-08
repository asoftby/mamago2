import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/search/zero-results
 * Get aggregated zero-result queries
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const minCount = parseInt(searchParams.get("minCount") || "1");

    // Aggregate zero-result queries
    const zeroResults = await prisma.$queryRaw<
      Array<{
        query: string;
        count: bigint;
        lastSearched: Date;
      }>
    >`
      SELECT 
        query,
        COUNT(*) as count,
        MAX("createdAt") as "lastSearched"
      FROM "SearchQueryLog"
      WHERE "resultsCount" = 0
      GROUP BY query
      HAVING COUNT(*) >= ${minCount}
      ORDER BY count DESC, "lastSearched" DESC
      LIMIT ${limit}
    `;

    // Convert BigInt to number for JSON serialization
    const formattedResults = zeroResults.map((row) => ({
      query: row.query,
      count: Number(row.count),
      lastSearched: row.lastSearched,
    }));

    // Get total stats
    const totalZeroResults = await prisma.searchQueryLog.count({
      where: { resultsCount: 0 },
    });

    const uniqueZeroQueries = await prisma.searchQueryLog.groupBy({
      by: ["query"],
      where: { resultsCount: 0 },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        queries: formattedResults,
        stats: {
          totalZeroResults,
          uniqueQueries: uniqueZeroQueries.length,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/search/zero-results error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
