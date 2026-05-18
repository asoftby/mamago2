import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/search/ranking
 * Get current ranking settings
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

    // Get the most recent settings (or create default if none exist)
    let settings = await prisma.searchRankingSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.searchRankingSettings.create({
        data: {
          nearbyBoost: 50,
          freshnessBoost: 30,
          popularityBoost: 40,
          partnerBoost: 20,
          ageBoost: 60,
          cityBoost: 70,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { settings },
    });
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
 * Update ranking settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nearbyBoost,
      freshnessBoost,
      popularityBoost,
      partnerBoost,
      ageBoost,
      cityBoost,
    } = body;

    // Validate values (0-100)
    const validateBoost = (value: unknown, name: string) => {
      if (value !== undefined && value !== null) {
        const num = parseInt(value as string);
        if (isNaN(num) || num < 0 || num > 100) {
          throw new Error(`${name} must be between 0 and 100`);
        }
      }
    };

    validateBoost(nearbyBoost, "nearbyBoost");
    validateBoost(freshnessBoost, "freshnessBoost");
    validateBoost(popularityBoost, "popularityBoost");
    validateBoost(partnerBoost, "partnerBoost");
    validateBoost(ageBoost, "ageBoost");
    validateBoost(cityBoost, "cityBoost");

    // Get current settings
    let settings = await prisma.searchRankingSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!settings) {
      // Create new settings
      settings = await prisma.searchRankingSettings.create({
        data: {
          nearbyBoost: nearbyBoost ?? 50,
          freshnessBoost: freshnessBoost ?? 30,
          popularityBoost: popularityBoost ?? 40,
          partnerBoost: partnerBoost ?? 20,
          ageBoost: ageBoost ?? 60,
          cityBoost: cityBoost ?? 70,
        },
      });
    } else {
      // Update existing settings
      const updateData: Record<string, number> = {};
      if (nearbyBoost !== undefined) updateData.nearbyBoost = parseInt(nearbyBoost as string);
      if (freshnessBoost !== undefined) updateData.freshnessBoost = parseInt(freshnessBoost as string);
      if (popularityBoost !== undefined) updateData.popularityBoost = parseInt(popularityBoost as string);
      if (partnerBoost !== undefined) updateData.partnerBoost = parseInt(partnerBoost as string);
      if (ageBoost !== undefined) updateData.ageBoost = parseInt(ageBoost as string);
      if (cityBoost !== undefined) updateData.cityBoost = parseInt(cityBoost as string);

      settings = await prisma.searchRankingSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      data: { settings },
    });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/search/ranking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/search/ranking/reset
 * Reset to default settings
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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "reset") {
      // Get current settings
      const current = await prisma.searchRankingSettings.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      if (current) {
        // Update to defaults
        const settings = await prisma.searchRankingSettings.update({
          where: { id: current.id },
          data: {
            nearbyBoost: 50,
            freshnessBoost: 30,
            popularityBoost: 40,
            partnerBoost: 20,
            ageBoost: 60,
            cityBoost: 70,
          },
        });

        return NextResponse.json({
          success: true,
          data: { settings },
        });
      }
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/admin/search/ranking error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
