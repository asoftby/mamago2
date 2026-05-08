import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/search/quick-tags
 * Get all quick tags
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

    const tags = await prisma.searchQuickTag.findMany({
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: { tags },
    });
  } catch (error) {
    console.error("GET /api/admin/search/quick-tags error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/search/quick-tags
 * Create a new quick tag
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
    const { title, slug, query, filters, cityId, isActive, sortOrder } = body;

    // Validation
    if (!title || !slug || !query) {
      return NextResponse.json(
        { success: false, error: "Title, slug, and query are required" },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existing = await prisma.searchQuickTag.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Slug already exists" },
        { status: 400 }
      );
    }

    const tag = await prisma.searchQuickTag.create({
      data: {
        title,
        slug,
        query,
        filters: filters || null,
        cityId: cityId || null,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder !== undefined ? sortOrder : 0,
      },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { tag },
    });
  } catch (error) {
    console.error("POST /api/admin/search/quick-tags error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
