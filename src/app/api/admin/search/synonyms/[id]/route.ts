import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * PATCH /api/admin/search/synonyms/[id]
 * Update a search synonym
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
    const { source, targets, isActive } = body;

    // Check if synonym exists
    const existing = await prisma.searchSynonym.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Synonym not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (source !== undefined) {
      const normalizedSource = source.trim().toLowerCase();
      
      // If source is being changed, check if new source already exists
      if (normalizedSource !== existing.source) {
        const sourceExists = await prisma.searchSynonym.findUnique({
          where: { source: normalizedSource },
        });

        if (sourceExists) {
          return NextResponse.json(
            { success: false, error: "Synonym with this source already exists" },
            { status: 400 }
          );
        }
      }

      updateData.source = normalizedSource;
    }

    if (targets !== undefined) {
      if (!Array.isArray(targets) || targets.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one target is required" },
          { status: 400 }
        );
      }

      const normalizedTargets = targets
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0);

      if (normalizedTargets.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one valid target is required" },
          { status: 400 }
        );
      }

      updateData.targets = normalizedTargets;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const synonym = await prisma.searchSynonym.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { synonym },
    });
  } catch (error) {
    console.error("PATCH /api/admin/search/synonyms/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/search/synonyms/[id]
 * Delete a search synonym
 */
export async function DELETE(
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

    // Check if synonym exists
    const existing = await prisma.searchSynonym.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Synonym not found" },
        { status: 404 }
      );
    }

    await prisma.searchSynonym.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Synonym deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/admin/search/synonyms/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
