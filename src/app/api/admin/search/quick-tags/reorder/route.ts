import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/search/quick-tags/reorder
 * Reorder quick tags (drag and drop)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { success: false, error: "tagIds must be an array" },
        { status: 400 }
      );
    }

    // Update sortOrder for each tag
    await Promise.all(
      tagIds.map((id, index) =>
        prisma.searchQuickTag.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: "Tags reordered successfully",
    });
  } catch (error) {
    console.error("POST /api/admin/search/quick-tags/reorder error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
