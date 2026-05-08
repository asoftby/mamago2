import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/search/synonyms
 * Get all search synonyms
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

    const synonyms = await prisma.searchSynonym.findMany({
      orderBy: [
        { isActive: "desc" },
        { source: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: { synonyms },
    });
  } catch (error) {
    console.error("GET /api/admin/search/synonyms error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/search/synonyms
 * Create a new search synonym
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
    const { source, targets, isActive } = body;

    // Validation
    if (!source || !targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { success: false, error: "Source and at least one target are required" },
        { status: 400 }
      );
    }

    // Normalize source
    const normalizedSource = source.trim().toLowerCase();

    // Check if source already exists
    const existing = await prisma.searchSynonym.findUnique({
      where: { source: normalizedSource },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Synonym with this source already exists" },
        { status: 400 }
      );
    }

    // Normalize targets
    const normalizedTargets = targets
      .map((t: string) => t.trim().toLowerCase())
      .filter((t: string) => t.length > 0);

    if (normalizedTargets.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one valid target is required" },
        { status: 400 }
      );
    }

    const synonym = await prisma.searchSynonym.create({
      data: {
        source: normalizedSource,
        targets: normalizedTargets,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { synonym },
    });
  } catch (error) {
    console.error("POST /api/admin/search/synonyms error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
