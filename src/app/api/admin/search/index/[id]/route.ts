import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * PATCH /api/admin/search/index/[id]
 * Update search index record (exclude/include, reindex)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { action } = body;

    // Check if record exists
    const existing = await prisma.searchIndexRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "exclude":
        updateData = {
          searchable: false,
          status: "EXCLUDED",
        };
        break;

      case "include":
        updateData = {
          searchable: true,
          status: "PENDING",
        };
        break;

      case "reindex":
        updateData = {
          status: "PENDING",
          error: null,
        };
        // TODO: Trigger actual reindexing job
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }

    const record = await prisma.searchIndexRecord.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { record },
    });
  } catch (error) {
    console.error("PATCH /api/admin/search/index/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
